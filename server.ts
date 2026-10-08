import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import type {
  Challenge,
  Team,
  CompetitionState,
  ActivityFeedEvent,
  SecurityLog,
  LeaderboardEntry,
  PublicChallengeView,
} from './src/types.ts';
import {
  TeamRegistrationSchema,
  TeamSignupSchema,
  TeamLoginSchema,
  AdminLoginSchema,
  FlagSubmissionSchema,
  HintUnlockSchema,
  ChallengeAdminSchema,
  ScoreAdjustSchema,
  AnnouncementSchema,
  sanitizeInput,
  sanitizeFilename,
} from './src/security/validation.ts';
import {
  createSignedToken,
  verifySignedToken,
  hashPassword,
  verifyPassword,
} from './src/security/cryptoSession.ts';
import {
  checkRateLimitTier,
} from './src/security/rateLimiter.ts';
import {
  validateFileAttachment,
  getSafeAttachmentHeaders,
} from './src/security/fileSecurity.ts';
import {
  createFlagSubmissionRateLimiter,
  createAuthRateLimiter,
} from './src/security/expressRateLimitRedis.ts';
import { redisCache } from './src/security/redisCache.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Load Balancer & Reverse Proxy Readiness: Trust first proxy hop
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
  },
});

// ======================== SECURITY HARDENING & LOAD BALANCING ========================
// 6.) Information Leak Prevention: Disable Express default fingerprint header
app.disable('x-powered-by');

// Load Balancer Health Probe
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.json({
    status: 'UP',
    nodeId: redisCache.getNodeId(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    memory: process.memoryUsage(),
    loadBalancer: {
      trustProxy: true,
      forwardedFor: req.headers['x-forwarded-for'] || null,
      clientIp: getClientIp(req),
    },
    cacheMetrics: redisCache.getMetrics(),
    totalTeams: teams.size,
  });
});

// Strict payload body parser with 5MB ceiling
app.use(express.json({ limit: '5mb' }));

// 4.) Secret Management: Environment variables with secure derivation
const PORT = 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CyberZero#2026!';

// --- In-Memory State & Cache Store (Redis-grade performance) ---
let challenges: Challenge[] = [];
const teams = new Map<string, Team>();
let activityFeed: ActivityFeedEvent[] = [];
let securityLogs: SecurityLog[] = [];

// Competition State
const competitionState: CompetitionState = {
  status: 'running',
  startTime: Date.now(),
  durationSeconds: 7200, // 2 hours
  remainingSeconds: 7200,
  writeupMode: false,
  announcement: null,
};

// --- Helper Functions ---
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function logSecurityEvent(
  type: SecurityLog['type'],
  details: string,
  ip: string,
  teamName?: string,
  severity: SecurityLog['severity'] = 'medium'
) {
  const log: SecurityLog = {
    id: 'sec-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type,
    details,
    ip,
    teamName,
    severity,
  };
  securityLogs.unshift(log);
  if (securityLogs.length > 300) securityLogs.pop();
  io.emit('security_alert', log);
}

// 1.) Global API Rate Limiter Middleware
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIp(req);
  const result = checkRateLimitTier('GLOBAL_API', ip);

  res.setHeader('X-RateLimit-Limit', result.limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetSeconds);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.resetSeconds);
    logSecurityEvent('RATE_LIMIT', `Global IP flood throttled: ${ip}`, ip, undefined, 'high');
    return res.status(429).json({
      success: false,
      error: result.reason || 'Too many requests. Cooldown engaged.',
    });
  }

  next();
});

// Tie-Breaker algorithm:
// 1. Disqualified teams pushed to bottom
// 2. Highest score
// 3. Earliest timestamp reaching that score
// 4. Fewer total incorrect attempts
function getSortedLeaderboard(): LeaderboardEntry[] {
  const teamList = Array.from(teams.values());

  teamList.sort((a, b) => {
    // Disqualified teams placed at bottom
    if (Boolean(a.isDisqualified) !== Boolean(b.isDisqualified)) {
      return a.isDisqualified ? 1 : -1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.lastSolveTime !== b.lastSolveTime) {
      return a.lastSolveTime - b.lastSolveTime;
    }
    if (a.totalFailedAttempts !== b.totalFailedAttempts) {
      return a.totalFailedAttempts - b.totalFailedAttempts;
    }
    return a.registeredAt - b.registeredAt;
  });

  return teamList.map((team, idx) => ({
    rank: idx + 1,
    teamId: team.id,
    teamName: team.teamName,
    members: team.members,
    score: team.score,
    solvesCount: Object.keys(team.solves).length,
    totalFailedAttempts: team.totalFailedAttempts,
    lastSolveTime: team.lastSolveTime,
    strikes: team.strikes || 0,
    isDisqualified: Boolean(team.isDisqualified),
    isFlaggedAnomaly: team.isFlaggedAnomaly,
  }));
}

function broadcastLeaderboard() {
  io.emit('leaderboard_update', getSortedLeaderboard());
}

function broadcastState() {
  io.emit('state_update', {
    competitionState,
    leaderboard: getSortedLeaderboard(),
  });
}

function getPublicChallengesForTeam(team?: Team): PublicChallengeView[] {
  return challenges
    .filter((c) => c.isEnabled)
    .map((c) => {
      const isSolved = team ? Boolean(team.solves[c.id]) : false;
      const attemptsUsed = team ? team.failedAttempts[c.id] || 0 : 0;
      const isLocked = attemptsUsed >= c.maxAttempts && !isSolved;
      const unlockedHintIds = team?.hintsUnlocked[c.id] || [];

      return {
        id: c.id,
        title: c.title,
        section: c.section,
        category: c.category,
        points: c.points,
        difficulty: c.difficulty,
        description: c.description,
        flagFormat: c.flagFormat,
        maxAttempts: c.maxAttempts,
        hasAttachment: Boolean(c.attachment),
        attachmentInfo: c.attachment
          ? {
              fileName: c.attachment.fileName,
              size: c.attachment.size,
            }
          : undefined,
        hints: c.hints.map((h) => ({
          id: h.id,
          title: h.title,
          cost: h.cost,
          isUnlocked: unlockedHintIds.includes(h.id),
          content: unlockedHintIds.includes(h.id) ? h.content : undefined,
        })),
        isSolved,
        isLocked,
        attemptsUsed,
        attemptsRemaining: Math.max(0, c.maxAttempts - attemptsUsed),
        firstBloodTeam: c.firstBloodTeam,
        writeup: competitionState.writeupMode ? c.writeup : undefined,
      };
    });
}

// Seed Initial Questions from questions.json
function loadInitialQuestions() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf-8');
    const parsed: Partial<Challenge>[] = JSON.parse(raw);
    challenges = parsed.map((p) => ({
      id: p.id || 'chal-' + crypto.randomUUID().slice(0, 6),
      title: p.title || 'Untitled Challenge',
      section: p.section || 'Section A (Find the Clue, Find the Key)',
      category: p.category || 'MISC',
      points: p.points || 100,
      difficulty: p.difficulty || 'Medium',
      description: p.description || '',
      flag: p.flag || 'CTF{dummy}',
      flagFormat: p.flagFormat || 'CTF{...}',
      maxAttempts: p.maxAttempts || 5,
      attachment: p.attachment,
      hints: p.hints || [],
      writeup: p.writeup,
      isEnabled: true,
      solvesCount: 0,
      firstBloodTeam: null,
    }));
    console.log(`[CTF Core] Loaded ${challenges.length} challenges from questions.json`);
  } catch (err) {
    console.error('[CTF Core] Failed to load questions.json, initializing default array', err);
  }
}

// Seed Demo Competitor Teams for Realism
function seedDemoTeams() {
  const demoSeed = [
    {
      teamName: '0xDeadBeef',
      members: ['Alice (Lead)', 'Bob', 'CipherX'],
      score: 470,
      solves: ['chal-01', 'chal-03', 'chal-05'],
      firstBloods: ['chal-01'],
      totalFailedAttempts: 1,
    },
    {
      teamName: 'NullPointerCrew',
      members: ['RootKit', 'ZeroDay', 'Neo'],
      score: 320,
      solves: ['chal-02', 'chal-03'],
      firstBloods: ['chal-02'],
      totalFailedAttempts: 3,
    },
    {
      teamName: 'BinaryShadows',
      members: ['Ghost', 'Spectre'],
      score: 270,
      solves: ['chal-01', 'chal-03'],
      firstBloods: [],
      totalFailedAttempts: 2,
    },
    {
      teamName: 'ViperSec',
      members: ['Viper', 'Krypton', 'ByteStorm', 'Hex'],
      score: 180,
      solves: ['chal-04'],
      firstBloods: ['chal-04'],
      totalFailedAttempts: 4,
    },
    {
      teamName: 'CyberValkyrie',
      members: ['Freya', 'Sigrun'],
      score: 120,
      solves: ['chal-03'],
      firstBloods: ['chal-03'],
      totalFailedAttempts: 0,
    },
  ];

  demoSeed.forEach((d, idx) => {
    const id = 'seed-team-' + idx;
    const now = Date.now() - (demoSeed.length - idx) * 180000;
    const teamSolves: Record<string, { solvedAt: number; pointsAwarded: number; isFirstBlood: boolean }> = {};

    d.solves.forEach((chalId) => {
      const chal = challenges.find((c) => c.id === chalId);
      if (chal) {
        chal.solvesCount++;
        const isFB = d.firstBloods.includes(chalId);
        if (isFB && !chal.firstBloodTeam) {
          chal.firstBloodTeam = d.teamName;
        }
        teamSolves[chalId] = {
          solvedAt: now,
          pointsAwarded: chal.points + (isFB ? 50 : 0),
          isFirstBlood: isFB,
        };
      }
    });

    teams.set(id, {
      id,
      teamName: d.teamName,
      members: d.members,
      score: d.score,
      solves: teamSolves,
      hintsUnlocked: {},
      failedAttempts: {},
      totalFailedAttempts: d.totalFailedAttempts,
      lastSolveTime: now,
      registeredAt: now - 3600000,
      ip: `192.168.1.${10 + idx}`,
      strikes: 0,
      isDisqualified: false,
      isFlaggedAnomaly: false,
    });
  });

  activityFeed = [
    {
      id: 'act-1',
      timestamp: Date.now() - 600000,
      type: 'first_blood',
      teamName: '0xDeadBeef',
      challengeTitle: 'Phantom Pixel Spectra',
      points: 200,
      message: 'Claimed [FIRST BLOOD] on Phantom Pixel Spectra (+200 pts)!',
    },
    {
      id: 'act-2',
      timestamp: Date.now() - 480000,
      type: 'first_blood',
      teamName: 'NullPointerCrew',
      challengeTitle: "Memory Dump: Infiltrator's Footprint",
      points: 250,
      message: "Claimed [FIRST BLOOD] on Memory Dump: Infiltrator's Footprint (+250 pts)!",
    },
    {
      id: 'act-3',
      timestamp: Date.now() - 320000,
      type: 'solve',
      teamName: 'BinaryShadows',
      challengeTitle: 'Phantom Pixel Spectra',
      points: 150,
      message: 'Decrypted Phantom Pixel Spectra (+150 pts)!',
    },
    {
      id: 'act-4',
      timestamp: Date.now() - 150000,
      type: 'first_blood',
      teamName: 'ViperSec',
      challengeTitle: 'Subcarrier Spectrogram: Sonic Mirage',
      points: 230,
      message: 'Claimed [FIRST BLOOD] on Subcarrier Spectrogram: Sonic Mirage (+230 pts)!',
    },
  ];
}

function clearDemoTeams() {
  for (const [id] of teams.entries()) {
    if (id.startsWith('seed-team-')) {
      teams.delete(id);
    }
  }

  // Recalculate challenge solves and first bloods based purely on remaining teams
  challenges.forEach((chal) => {
    let solves = 0;
    let fbTeam: string | null = null;
    let earliest = Infinity;

    for (const team of teams.values()) {
      if (team.solves[chal.id]) {
        solves++;
        if (team.solves[chal.id].solvedAt < earliest) {
          earliest = team.solves[chal.id].solvedAt;
          fbTeam = team.teamName;
        }
      }
    }

    chal.solvesCount = solves;
    chal.firstBloodTeam = fbTeam;
  });

  activityFeed = activityFeed.filter(
    (ev) => !['0xDeadBeef', 'NullPointerCrew', 'BinaryShadows', 'ViperSec', 'CyberValkyrie'].includes(ev.teamName)
  );

  broadcastLeaderboard();
  broadcastState();
}

loadInitialQuestions();
// Arena starts with clean state (no fake or pre-seeded teams)

// --- Server-Authoritative Timer & Auto-Submit Engine ---
setInterval(() => {
  if (competitionState.status === 'running') {
    if (competitionState.remainingSeconds > 0) {
      competitionState.remainingSeconds--;
      if (competitionState.remainingSeconds === 0) {
        competitionState.status = 'ended';
        competitionState.writeupMode = true; // Auto-transition to writeup mode!
        const alertEvent: ActivityFeedEvent = {
          id: 'act-' + crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'announcement',
          teamName: 'SYSTEM',
          message: 'COMPETITION TIME EXPIRED! All submissions locked. Official challenge writeups are now available.',
        };
        activityFeed.unshift(alertEvent);
        io.emit('activity_event', alertEvent);
        io.emit('competition_ended');
      }
    }
  }

  // Periodic heartbeat tick
  io.emit('timer_tick', {
    status: competitionState.status,
    remainingSeconds: competitionState.remainingSeconds,
    writeupMode: competitionState.writeupMode,
    serverTime: Date.now(),
  });
}, 1000);

// ======================== AUTH & RBAC MIDDLEWARE ========================
// 3.) Cryptographic Token Verification & RBAC Enforcement
function requireTeamAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const ip = getClientIp(req);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
  }

  const result = verifySignedToken(token);
  if (!result.valid || !result.payload) {
    logSecurityEvent('TAMPERED_TOKEN', `Invalid/Tampered token presented: ${result.error}`, ip, undefined, 'high');
    return res.status(401).json({ success: false, error: result.error || 'Invalid session credentials.' });
  }

  if (result.payload.role !== 'team') {
    logSecurityEvent('INVALID_AUTH', 'Role escalation violation: team role required', ip, undefined, 'high');
    return res.status(403).json({ success: false, error: 'Access denied: Team operator credentials required.' });
  }

  const team = teams.get(result.payload.subjectId);
  if (!team) {
    return res.status(401).json({ success: false, error: 'Team session not found. Please re-register.' });
  }

  (req as any).team = team;
  (req as any).tokenPayload = result.payload;
  next();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const rawToken = req.headers['x-admin-token'] || req.headers.authorization?.replace('Bearer ', '');
  const ip = getClientIp(req);

  if (!rawToken || typeof rawToken !== 'string') {
    logSecurityEvent('INVALID_AUTH', 'Unauthorized access attempt to /admin route', ip, undefined, 'high');
    return res.status(403).json({ success: false, error: 'Forbidden: Administrator credentials required.' });
  }

  const result = verifySignedToken(rawToken);
  if (!result.valid || !result.payload || result.payload.role !== 'admin') {
    logSecurityEvent('INVALID_AUTH', `Admin RBAC authorization failed: ${result.error || 'Role mismatch'}`, ip, undefined, 'high');
    return res.status(403).json({ success: false, error: 'Forbidden: Master administrator privileges required.' });
  }

  next();
}

// Rate Limiters backed by express-rate-limit and rate-limit-redis
const flagSubmissionRateLimiter = createFlagSubmissionRateLimiter((ip, teamName) => {
  logSecurityEvent('RATE_LIMIT', 'express-rate-limit [rate-limit-redis]: Exceeded 5 flag attempts per 10s', ip, teamName, 'high');
});

const authRateLimiter = createAuthRateLimiter((ip, target) => {
  logSecurityEvent('RATE_LIMIT', `express-rate-limit [rate-limit-redis]: Exceeded 5 auth attempts per 10s for ${target}`, ip, undefined, 'high');
});

// ======================== API ROUTES ========================

// Protect all /api/auth routes with express-rate-limit + rate-limit-redis (5 attempts / 10s per team/IP)
app.use('/api/auth', authRateLimiter);

// 1.) Dedicated Secure Team Sign Up
app.post('/api/auth/signup', (req: Request, res: Response) => {
  const ip = getClientIp(req);

  // Input Validation with Zod (enforces min 8 chars with letter + number, 1-4 members)
  const validation = TeamSignupSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid registration parameters.',
    });
  }

  const { teamName, password, members } = validation.data;
  const sanitizedTeamName = sanitizeInput(teamName);
  const sanitizedMembers = members.map((m) => sanitizeInput(m));

  // Check if team name is already taken
  for (const t of teams.values()) {
    if (t.teamName.toLowerCase() === sanitizedTeamName.toLowerCase()) {
      return res.status(409).json({
        success: false,
        error: 'Team name is already registered. Please select a different name or log in.',
      });
    }
  }

  // Salt & Hash Password with PBKDF2 (100,000 iterations)
  const { salt, hash } = hashPassword(password);
  const id = 'team-' + crypto.randomUUID();

  const team: Team = {
    id,
    teamName: sanitizedTeamName,
    passwordHash: hash,
    passwordSalt: salt,
    members: sanitizedMembers,
    score: 0,
    solves: {},
    hintsUnlocked: {},
    failedAttempts: {},
    totalFailedAttempts: 0,
    lastSolveTime: Date.now(),
    registeredAt: Date.now(),
    ip,
    strikes: 0,
    isDisqualified: false,
    isFlaggedAnomaly: false,
  };
  teams.set(id, team);

  const joinEvent: ActivityFeedEvent = {
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'system',
    teamName: team.teamName,
    message: `Team [${team.teamName}] registered (${team.members.length} members).`,
  };
  activityFeed.unshift(joinEvent);
  io.emit('activity_event', joinEvent);
  broadcastLeaderboard();

  // Cryptographically signed HMAC-SHA256 session token
  const token = createSignedToken('team', team.id);

  res.json({
    success: true,
    token,
    team: {
      id: team.id,
      teamName: team.teamName,
      members: team.members,
      score: team.score,
    },
  });
});

// 2.) Dedicated Secure Team Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const ip = getClientIp(req);

  const validation = TeamLoginSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || 'Team name and password required.',
    });
  }

  const { teamName, password } = validation.data;
  const cleanName = sanitizeInput(teamName).toLowerCase();

  let matchedTeam: Team | undefined;
  for (const t of teams.values()) {
    if (t.teamName.toLowerCase() === cleanName) {
      matchedTeam = t;
      break;
    }
  }

  // Prevent user enumeration: generic error message if not found or password incorrect
  if (!matchedTeam) {
    logSecurityEvent('INVALID_AUTH', `Failed login attempt for nonexistent team [${teamName}]`, ip, teamName, 'low');
    return res.status(401).json({
      success: false,
      error: 'Invalid team name or password credentials.',
    });
  }

  // If team was registered with password, verify with constant-time equality
  if (matchedTeam.passwordHash && matchedTeam.passwordSalt) {
    const isPasswordValid = verifyPassword(password, matchedTeam.passwordSalt, matchedTeam.passwordHash);
    if (!isPasswordValid) {
      logSecurityEvent('INVALID_AUTH', `Incorrect password for team [${matchedTeam.teamName}]`, ip, matchedTeam.teamName, 'medium');
      return res.status(401).json({
        success: false,
        error: 'Invalid team name or password credentials.',
      });
    }
  }

  // Cryptographically signed session token
  const token = createSignedToken('team', matchedTeam.id);

  res.json({
    success: true,
    token,
    team: {
      id: matchedTeam.id,
      teamName: matchedTeam.teamName,
      members: matchedTeam.members,
      score: matchedTeam.score,
    },
  });
});

// Participant Registration / Login with Zod & Rate Limiting (Legacy compatibility)
app.post('/api/auth/team', (req: Request, res: Response) => {
  const ip = getClientIp(req);

  // Rate Limiting: Max 10 team creations per minute per IP
  const rateResult = checkRateLimitTier('TEAM_AUTH', ip);
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', rateResult.resetSeconds);
    logSecurityEvent('RATE_LIMIT', `Team registration throttled: ${ip}`, ip, undefined, 'medium');
    return res.status(429).json({ success: false, error: rateResult.reason });
  }

  // 2.) Strict Input Validation with Zod
  const validation = TeamRegistrationSchema.safeParse(req.body);
  if (!validation.success) {
    logSecurityEvent('INPUT_VALIDATION_ERROR', `Team validation rejected: ${validation.error.issues[0]?.message}`, ip);
    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid registration parameters.',
    });
  }

  const { teamName, members } = validation.data;
  const sanitizedTeamName = sanitizeInput(teamName);
  const sanitizedMembers = members.map((m) => sanitizeInput(m));

  // Check existing team with same name
  let existingTeam: Team | undefined;
  for (const t of teams.values()) {
    if (t.teamName.toLowerCase() === sanitizedTeamName.toLowerCase()) {
      existingTeam = t;
      break;
    }
  }

  let team: Team;
  if (existingTeam) {
    team = existingTeam;
    if (sanitizedMembers.length > team.members.length) {
      team.members = sanitizedMembers;
    }
  } else {
    const id = 'team-' + crypto.randomUUID();
    team = {
      id,
      teamName: sanitizedTeamName,
      members: sanitizedMembers,
      score: 0,
      solves: {},
      hintsUnlocked: {},
      failedAttempts: {},
      totalFailedAttempts: 0,
      lastSolveTime: Date.now(),
      registeredAt: Date.now(),
      ip,
      strikes: 0,
      isDisqualified: false,
      isFlaggedAnomaly: false,
    };
    teams.set(id, team);

    const joinEvent: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'system',
      teamName: team.teamName,
      message: `Team [${team.teamName}] registered (${team.members.length} members).`,
    };
    activityFeed.unshift(joinEvent);
    io.emit('activity_event', joinEvent);
    broadcastLeaderboard();
  }

  // 3.) Issue cryptographic signed session token
  const token = createSignedToken('team', team.id);

  res.json({
    success: true,
    token,
    team: {
      id: team.id,
      teamName: team.teamName,
      members: team.members,
      score: team.score,
    },
  });
});

// 1.) & 3.) Admin Master Authentication with Timing-Safe Comparison & Lockout
app.post('/api/auth/admin', (req: Request, res: Response) => {
  const ip = getClientIp(req);

  // Rate Limiting: Max 5 attempts per 60s with 5-minute lockout on breach
  const rateResult = checkRateLimitTier('ADMIN_LOGIN', ip);
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', rateResult.resetSeconds);
    logSecurityEvent('BRUTE_FORCE_LOCKOUT', `Master admin login brute-force lockout: ${ip}`, ip, undefined, 'high');
    return res.status(429).json({ success: false, error: rateResult.reason });
  }

  // Input Validation with Zod
  const validation = AdminLoginSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: validation.error.issues[0]?.message });
  }

  const { password } = validation.data;

  // Timing-safe comparison to prevent timing side-channel attacks
  const givenBuffer = Buffer.from(password);
  const targetBuffer = Buffer.from(ADMIN_PASSWORD);
  const isMatch =
    givenBuffer.length === targetBuffer.length &&
    crypto.timingSafeEqual(givenBuffer, targetBuffer);

  if (isMatch) {
    const token = createSignedToken('admin', 'admin-master', 43200000); // 12 hours
    res.json({ success: true, token });
  } else {
    logSecurityEvent('INVALID_AUTH', 'Failed master admin passkey entry', ip, undefined, 'high');
    res.status(401).json({ success: false, error: 'Invalid master passkey credentials.' });
  }
});

// Public Sync State with Redis Cache
app.get('/api/state', async (req: Request, res: Response) => {
  const rawToken = req.headers.authorization?.replace('Bearer ', '');
  let team: Team | undefined;

  if (rawToken) {
    const verified = verifySignedToken(rawToken);
    if (verified.valid && verified.payload && verified.payload.role === 'team') {
      team = teams.get(verified.payload.subjectId);
    }
  }

  // Fast path: for public requests, check Redis cache first
  if (!team) {
    const cachedState = await redisCache.get<any>('cache:state:public');
    if (cachedState) {
      return res.json(cachedState);
    }
  }

  const responsePayload = {
    competitionState,
    team: team
      ? {
          id: team.id,
          teamName: team.teamName,
          members: team.members,
          score: team.score,
          solves: team.solves,
          hintsUnlocked: team.hintsUnlocked,
          failedAttempts: team.failedAttempts,
          totalFailedAttempts: team.totalFailedAttempts,
          strikes: team.strikes || 0,
          isDisqualified: Boolean(team.isDisqualified),
          disqualifiedReason: team.disqualifiedReason,
        }
      : null,
    challenges: getPublicChallengesForTeam(team),
    leaderboard: getSortedLeaderboard(),
    activityFeed: activityFeed.slice(0, 30),
    hasDemoTeams: Array.from(teams.keys()).some((k) => k.startsWith('seed-team-')),
  };

  // Cache public state for 5 seconds to handle 100+ concurrent teams without DB load
  if (!team) {
    await redisCache.set('cache:state:public', responsePayload, 5);
  }

  res.json(responsePayload);
});

// Toggle Demo Teams vs Clean Slate
app.post('/api/scoreboard/mode', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode === 'clean') {
    clearDemoTeams();
  } else if (mode === 'seed') {
    clearDemoTeams();
    seedDemoTeams();
    broadcastLeaderboard();
    broadcastState();
  }
  res.json({
    success: true,
    leaderboard: getSortedLeaderboard(),
    hasDemoTeams: Array.from(teams.keys()).some((k) => k.startsWith('seed-team-')),
  });
});

// 1.) & 2.) Flag Submission with Zod, express-rate-limit [rate-limit-redis] & Velocity Checks
app.post('/api/submit-flag', requireTeamAuth, flagSubmissionRateLimiter, (req: Request, res: Response) => {
  const team: Team = (req as any).team;
  const ip = getClientIp(req);

  // Rate Limiting: Max 5 submissions per 10s per team
  const rateResult = checkRateLimitTier('FLAG_SUBMISSION', team.id);
  res.setHeader('X-RateLimit-Limit', rateResult.limit);
  res.setHeader('X-RateLimit-Remaining', rateResult.remaining);
  res.setHeader('X-RateLimit-Reset', rateResult.resetSeconds);

  if (!rateResult.allowed) {
    res.setHeader('Retry-After', rateResult.resetSeconds);
    logSecurityEvent('RATE_LIMIT', `Team flag submission throttled: ${rateResult.reason}`, ip, team.teamName, 'high');
    return res.status(429).json({ success: false, error: rateResult.reason });
  }

  // Validation with Zod
  const validation = FlagSubmissionSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid flag syntax format.',
    });
  }

  // 1.) Disqualification Guard
  if (team.isDisqualified) {
    return res.status(403).json({
      success: false,
      error: 'Team has been DISQUALIFIED due to security infractions. Submissions locked.',
    });
  }

  const { challengeId, flag } = validation.data;

  if (competitionState.status !== 'running') {
    return res.status(403).json({ success: false, error: `Competition is ${competitionState.status}. Submissions locked.` });
  }

  const chal = challenges.find((c) => c.id === challengeId);
  if (!chal || !chal.isEnabled) {
    return res.status(404).json({ success: false, error: 'Challenge not found or disabled.' });
  }

  if (team.solves[challengeId]) {
    return res.status(400).json({ success: false, error: 'Challenge already decrypted by your team.' });
  }

  const currentAttempts = team.failedAttempts[challengeId] || 0;
  if (currentAttempts >= chal.maxAttempts) {
    return res.status(403).json({ success: false, error: 'Maximum attempts exhausted. Challenge card locked.' });
  }

  const submittedFlag = flag.trim();
  const isCorrect = submittedFlag === chal.flag.trim();

  // Behavioral Velocity Anomaly Check (< 4 seconds between distinct challenge solves)
  const timeSinceLastSolve = Date.now() - team.lastSolveTime;
  if (isCorrect && timeSinceLastSolve < 4000 && Object.keys(team.solves).length > 0) {
    team.isFlaggedAnomaly = true;
    team.anomalyReason = `Velocity anomaly: Solve gap ${Math.round(timeSinceLastSolve / 1000)}s between challenges.`;
    logSecurityEvent(
      'VELOCITY_ANOMALY',
      `Suspicious solve velocity: Solved in ${timeSinceLastSolve}ms for chal ${chal.title}`,
      ip,
      team.teamName,
      'high'
    );
  }

  if (isCorrect) {
    const isFirstBlood = chal.solvesCount === 0 && !chal.firstBloodTeam;
    if (isFirstBlood) {
      chal.firstBloodTeam = team.teamName;
    }
    chal.solvesCount++;

    // Calculate deducted hints
    const hintsUnlocked = team.hintsUnlocked[challengeId] || [];
    let hintPenalties = 0;
    chal.hints.forEach((h) => {
      if (hintsUnlocked.includes(h.id)) {
        hintPenalties += h.cost;
      }
    });

    const basePoints = Math.max(10, chal.points - hintPenalties);
    const bonusPoints = isFirstBlood ? 50 : 0;
    const finalPoints = basePoints + bonusPoints;

    const now = Date.now();
    team.score += finalPoints;
    team.lastSolveTime = now;
    team.solves[challengeId] = {
      solvedAt: now,
      pointsAwarded: finalPoints,
      isFirstBlood,
    };

    const eventType = isFirstBlood ? 'first_blood' : 'solve';
    const message = isFirstBlood
      ? `Claimed [FIRST BLOOD] on ${chal.title} (+${finalPoints} pts)!`
      : `Decrypted ${chal.title} (+${finalPoints} pts)!`;

    const feedEvent: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: now,
      type: eventType,
      teamName: team.teamName,
      challengeTitle: chal.title,
      points: finalPoints,
      message,
    };

    activityFeed.unshift(feedEvent);
    if (activityFeed.length > 50) activityFeed.pop();

    io.emit('activity_event', feedEvent);
    broadcastLeaderboard();
    broadcastState();

    return res.json({
      success: true,
      isFirstBlood,
      pointsAwarded: finalPoints,
      message: isFirstBlood
        ? `FIRST BLOOD! +${finalPoints} pts (+50 bonus) awarded.`
        : `FLAG ACCEPTED! +${finalPoints} pts added to team score.`,
    });
  } else {
    // Incorrect Attempt
    const newCount = (team.failedAttempts[challengeId] || 0) + 1;
    team.failedAttempts[challengeId] = newCount;
    team.totalFailedAttempts++;

    const remaining = Math.max(0, chal.maxAttempts - newCount);
    broadcastLeaderboard();

    return res.status(400).json({
      success: false,
      error: remaining > 0 ? `INVALID FLAG! Attempts remaining: ${remaining}/${chal.maxAttempts}` : 'INVALID FLAG! Card locked.',
      attemptsRemaining: remaining,
      isLocked: remaining === 0,
    });
  }
});

// 2.) Unlock Hint Marketplace with Zod
app.post('/api/unlock-hint', requireTeamAuth, (req: Request, res: Response) => {
  const team: Team = (req as any).team;

  const validation = HintUnlockSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: validation.error.issues[0]?.message });
  }

  const { challengeId, hintId } = validation.data;

  if (competitionState.status === 'ended') {
    return res.status(403).json({ success: false, error: 'Competition ended. Hint purchases closed.' });
  }

  const chal = challenges.find((c) => c.id === challengeId);
  if (!chal || !chal.isEnabled) {
    return res.status(404).json({ success: false, error: 'Challenge not found' });
  }

  const hint = chal.hints.find((h) => h.id === hintId);
  if (!hint) {
    return res.status(404).json({ success: false, error: 'Hint not found' });
  }

  if (!team.hintsUnlocked[challengeId]) {
    team.hintsUnlocked[challengeId] = [];
  }

  if (team.hintsUnlocked[challengeId].includes(hintId)) {
    return res.json({ success: true, hintContent: hint.content, message: 'Hint already purchased.' });
  }

  team.hintsUnlocked[challengeId].push(hintId);

  const event: ActivityFeedEvent = {
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'hint_unlocked',
    teamName: team.teamName,
    challengeTitle: chal.title,
    points: -hint.cost,
    message: `Unlocked Hint for ${chal.title} (-${hint.cost} reward penalty).`,
  };
  activityFeed.unshift(event);
  io.emit('activity_event', event);

  res.json({
    success: true,
    hintContent: hint.content,
    penalty: hint.cost,
    message: `Hint unlocked! -${hint.cost} pts deducted from final reward upon decryption.`,
  });
});

// 5.) Download Challenge Attachment with Secure Headers & Path Traversal Guards
app.get('/api/challenges/:id/attachment', (req: Request, res: Response) => {
  const chal = challenges.find((c) => c.id === req.params.id);
  if (!chal || !chal.attachment) {
    return res.status(404).json({ success: false, error: 'Artifact attachment not found.' });
  }

  const validation = validateFileAttachment(
    chal.attachment.fileName,
    Buffer.byteLength(chal.attachment.content)
  );

  if (!validation.valid) {
    logSecurityEvent(
      'FILE_SECURITY_VIOLATION',
      `Blocked unsafe attachment download: ${validation.error}`,
      getClientIp(req),
      undefined,
      'high'
    );
    return res.status(400).json({ success: false, error: validation.error });
  }

  // Set protective Content-Security-Policy & anti-sniff headers
  const headers = getSafeAttachmentHeaders(validation.sanitizedFilename, chal.attachment.mimeType);
  for (const [key, val] of Object.entries(headers)) {
    res.setHeader(key, val);
  }

  res.send(chal.attachment.content);
});

// 5-Strike Infraction Telemetry & Elimination Engine
app.post('/api/telemetry/strike', requireTeamAuth, async (req: Request, res: Response) => {
  const team: Team = (req as any).team;
  const ip = getClientIp(req);
  const { reason, key } = req.body;

  if (team.isDisqualified) {
    return res.json({
      success: true,
      strikes: 5,
      isDisqualified: true,
      reason: team.disqualifiedReason || 'Already disqualified',
    });
  }

  team.strikes = (team.strikes || 0) + 1;
  const infractionReason = sanitizeInput(reason || 'Security infraction detected');

  logSecurityEvent(
    'SECURITY_STRIKE',
    `Strike ${team.strikes}/5 issued: ${infractionReason}${key ? ` [Key: ${sanitizeInput(key)}]` : ''}`,
    ip,
    team.teamName,
    team.strikes >= 4 ? 'high' : 'medium'
  );

  if (team.strikes >= 5) {
    team.isDisqualified = true;
    team.disqualifiedAt = Date.now();
    team.disqualifiedReason = infractionReason;

    logSecurityEvent(
      'TEAM_DISQUALIFIED',
      `Team [${team.teamName}] permanently DISQUALIFIED (5 strikes accumulated). Session revoked.`,
      ip,
      team.teamName,
      'high'
    );

    const alertEvent: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'system',
      teamName: team.teamName,
      message: `Team [${team.teamName}] was DISQUALIFIED (5 strikes accumulated).`,
    };
    activityFeed.unshift(alertEvent);

    io.emit('team_disqualified', {
      teamId: team.id,
      teamName: team.teamName,
      reason: infractionReason,
    });
    io.emit('activity_event', alertEvent);
  }

  await redisCache.invalidate('cache:');
  broadcastLeaderboard();
  broadcastState();

  res.json({
    success: true,
    strikes: team.strikes,
    isDisqualified: Boolean(team.isDisqualified),
    reason: infractionReason,
  });
});

// Telemetry DevTools Alert Endpoint
app.post('/api/telemetry/devtools-alert', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const { teamName, key } = req.body;
  logSecurityEvent(
    'DEVTOOLS_ATTEMPT',
    `Shortcut/Key interception trigger: [${sanitizeInput(key || 'F12/Inspect')}]`,
    ip,
    sanitizeInput(teamName || 'UNAUTHENTICATED'),
    'low'
  );
  res.json({ logged: true });
});

// ======================== ADMIN ENDPOINTS ========================

// Timer Controls
app.post('/api/admin/timer', requireAdminAuth, (req: Request, res: Response) => {
  const { action, seconds } = req.body;

  if (action === 'start') {
    competitionState.status = 'running';
  } else if (action === 'pause') {
    competitionState.status = 'paused';
  } else if (action === 'set' && typeof seconds === 'number') {
    competitionState.remainingSeconds = Math.max(0, seconds);
  } else if (action === 'add' && typeof seconds === 'number') {
    competitionState.remainingSeconds += seconds;
  }

  io.emit('timer_tick', {
    status: competitionState.status,
    remainingSeconds: competitionState.remainingSeconds,
    writeupMode: competitionState.writeupMode,
    serverTime: Date.now(),
  });

  res.json({ success: true, state: competitionState });
});

// 2.) Broadcast Announcement Modal with Zod
app.post('/api/admin/announcement', requireAdminAuth, (req: Request, res: Response) => {
  const validation = AnnouncementSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: validation.error.issues[0]?.message });
  }

  const { title, message } = validation.data;
  const announcement = {
    id: 'ann-' + crypto.randomUUID(),
    title: sanitizeInput(title || 'COMMAND HQ BROADCAST'),
    message: sanitizeInput(message),
    timestamp: Date.now(),
  };

  competitionState.announcement = announcement;

  const event: ActivityFeedEvent = {
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'announcement',
    teamName: 'ADMIN HQ',
    message: `[HQ ANNOUNCEMENT] ${announcement.title}: ${announcement.message}`,
  };
  activityFeed.unshift(event);

  io.emit('announcement_broadcast', announcement);
  io.emit('activity_event', event);

  res.json({ success: true, announcement });
});

// Clear Announcement
app.delete('/api/admin/announcement', requireAdminAuth, (req: Request, res: Response) => {
  competitionState.announcement = null;
  io.emit('announcement_cleared');
  res.json({ success: true });
});

// Writeup Mode Toggle
app.post('/api/admin/writeup-mode', requireAdminAuth, (req: Request, res: Response) => {
  const { enabled } = req.body;
  competitionState.writeupMode = Boolean(enabled);
  broadcastState();
  res.json({ success: true, writeupMode: competitionState.writeupMode });
});

// Competition Reset Option
app.post('/api/admin/reset', requireAdminAuth, (req: Request, res: Response) => {
  teams.clear();
  activityFeed = [];
  securityLogs = [];

  // Reset challenge solve stats
  challenges.forEach((c) => {
    c.solvesCount = 0;
    c.firstBloodTeam = null;
  });

  competitionState.status = 'running';
  competitionState.remainingSeconds = competitionState.durationSeconds;
  competitionState.writeupMode = false;
  competitionState.announcement = null;

  // Reset to clean state (no fake teams)
  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, message: 'Competition state reset successfully.' });
});

// Admin Challenge CRUD
app.get('/api/admin/challenges', requireAdminAuth, (req: Request, res: Response) => {
  res.json(challenges);
});

// 2.) Admin Challenge Creation with Zod
app.post('/api/admin/challenges', requireAdminAuth, (req: Request, res: Response) => {
  const validation = ChallengeAdminSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: validation.error.issues[0]?.message });
  }

  const data = validation.data;
  const newChallenge: Challenge = {
    id: 'chal-' + crypto.randomUUID().slice(0, 8),
    title: sanitizeInput(data.title),
    section: data.section,
    category: data.category,
    points: data.points,
    difficulty: data.difficulty,
    description: sanitizeInput(data.description),
    flag: data.flag.trim(),
    flagFormat: data.flagFormat || 'CTF{...}',
    maxAttempts: data.maxAttempts || 5,
    hints: Array.isArray(req.body.hints) ? req.body.hints : [],
    writeup: req.body.writeup || { summary: '', steps: [] },
    isEnabled: true,
    solvesCount: 0,
    firstBloodTeam: null,
  };

  challenges.push(newChallenge);
  broadcastState();
  res.json({ success: true, challenge: newChallenge });
});

app.put('/api/admin/challenges/:id', requireAdminAuth, (req: Request, res: Response) => {
  const chal = challenges.find((c) => c.id === req.params.id);
  if (!chal) return res.status(404).json({ success: false, error: 'Challenge not found' });

  const { title, section, category, points, difficulty, description, flag, maxAttempts, isEnabled } = req.body;
  if (title) chal.title = sanitizeInput(title);
  if (section) chal.section = section;
  if (category) chal.category = category;
  if (typeof points === 'number') chal.points = Math.max(10, Math.min(1000, points));
  if (difficulty) chal.difficulty = difficulty;
  if (description) chal.description = sanitizeInput(description);
  if (flag) chal.flag = flag.trim();
  if (typeof maxAttempts === 'number') chal.maxAttempts = Math.max(1, Math.min(20, maxAttempts));
  if (typeof isEnabled === 'boolean') chal.isEnabled = isEnabled;

  broadcastState();
  res.json({ success: true, challenge: chal });
});

app.delete('/api/admin/challenges/:id', requireAdminAuth, (req: Request, res: Response) => {
  const idx = challenges.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Challenge not found' });

  challenges.splice(idx, 1);
  broadcastState();
  res.json({ success: true });
});

// 5.) Admin Attachment Upload / Security Validation for Challenge
app.post('/api/admin/challenges/:id/attachment', requireAdminAuth, (req: Request, res: Response) => {
  const chal = challenges.find((c) => c.id === req.params.id);
  if (!chal) return res.status(404).json({ success: false, error: 'Challenge not found' });

  const { fileName, mimeType, content } = req.body;
  if (!fileName || !content) {
    return res.status(400).json({ success: false, error: 'Missing fileName or content payload' });
  }

  const validation = validateFileAttachment(fileName, Buffer.byteLength(content));
  if (!validation.valid) {
    logSecurityEvent('FILE_SECURITY_VIOLATION', `Admin upload rejected: ${validation.error}`, getClientIp(req), undefined, 'high');
    return res.status(400).json({ success: false, error: validation.error });
  }

  const cleanFilename = sanitizeFilename(fileName);
  const sizeKb = (Buffer.byteLength(content) / 1024).toFixed(1) + ' KB';

  chal.attachment = {
    fileName: cleanFilename,
    mimeType: mimeType || 'application/octet-stream',
    size: sizeKb,
    content: String(content),
  };

  broadcastState();
  res.json({ success: true, attachment: { fileName: cleanFilename, size: sizeKb } });
});

// Admin Team Management
app.get('/api/admin/teams', requireAdminAuth, (req: Request, res: Response) => {
  res.json(Array.from(teams.values()));
});

// 2.) Admin Score Adjust with Zod
app.post('/api/admin/teams/:id/adjust-score', requireAdminAuth, (req: Request, res: Response) => {
  const team = teams.get(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  const validation = ScoreAdjustSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: validation.error.issues[0]?.message });
  }

  const { delta, reason } = validation.data;
  team.score += delta;

  const event: ActivityFeedEvent = {
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'system',
    teamName: team.teamName,
    points: delta,
    message: `Admin score adjustment for ${team.teamName}: ${delta >= 0 ? '+' : ''}${delta} pts (${sanitizeInput(reason)}).`,
  };
  activityFeed.unshift(event);
  io.emit('activity_event', event);

  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, team });
});

app.post('/api/admin/teams/:id/unlock-challenge', requireAdminAuth, (req: Request, res: Response) => {
  const team = teams.get(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  const { challengeId } = req.body;
  team.failedAttempts[challengeId] = 0; // reset attempts
  broadcastState();
  res.json({ success: true, message: `Challenge unlocked for team ${team.teamName}` });
});

app.post('/api/admin/teams/:id/clear-anomaly', requireAdminAuth, (req: Request, res: Response) => {
  const team = teams.get(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  team.isFlaggedAnomaly = false;
  team.anomalyReason = undefined;
  broadcastLeaderboard();
  res.json({ success: true });
});

// Admin Strike Clear / Reinstate
app.post('/api/admin/teams/:id/clear-strikes', requireAdminAuth, async (req: Request, res: Response) => {
  const team = teams.get(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  team.strikes = 0;
  team.isDisqualified = false;
  team.disqualifiedReason = undefined;

  logSecurityEvent('SECURITY_STRIKE', `Admin arbitration cleared strikes and reinstated team [${team.teamName}]`, getClientIp(req), team.teamName, 'low');

  await redisCache.invalidate('cache:');
  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, message: `Strikes reset for team ${team.teamName}`, team });
});

// Admin Manual Disqualify
app.post('/api/admin/teams/:id/disqualify', requireAdminAuth, async (req: Request, res: Response) => {
  const team = teams.get(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  team.strikes = 5;
  team.isDisqualified = true;
  team.disqualifiedAt = Date.now();
  team.disqualifiedReason = 'Manual Disqualification by Competition Arbitration';

  logSecurityEvent('TEAM_DISQUALIFIED', `Team [${team.teamName}] manually DISQUALIFIED by Admin Arbitration.`, getClientIp(req), team.teamName, 'high');

  io.emit('team_disqualified', {
    teamId: team.id,
    teamName: team.teamName,
    reason: team.disqualifiedReason,
  });

  await redisCache.invalidate('cache:');
  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, message: `Team ${team.teamName} disqualified.`, team });
});

// Admin Flush Redis Cache
app.post('/api/admin/flush-cache', requireAdminAuth, async (_req: Request, res: Response) => {
  await redisCache.invalidate('cache:');
  res.json({ success: true, message: 'Redis cache successfully flushed.' });
});

// Admin Redis Cache Benchmark
app.post('/api/admin/cache/benchmark', requireAdminAuth, async (req: Request, res: Response) => {
  const iterations = typeof req.body.iterations === 'number' ? Math.min(500, Math.max(10, req.body.iterations)) : 100;
  const result = await redisCache.runBenchmark(iterations);
  res.json({
    success: true,
    benchmark: result,
    metrics: redisCache.getMetrics(),
  });
});

// Admin Load Balancer & Node Info
app.get('/api/admin/loadbalancer/status', requireAdminAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    nodeId: redisCache.getNodeId(),
    uptimeSeconds: Math.floor(process.uptime()),
    clientIp: getClientIp(req),
    trustProxy: true,
    teamsConnected: teams.size,
    metrics: redisCache.getMetrics(),
  });
});

// Admin Security Logs
app.get('/api/admin/logs', requireAdminAuth, (req: Request, res: Response) => {
  res.json({
    securityLogs,
    activityFeed,
  });
});

// Export Scores to CSV with Secure Sanitization
app.get('/api/admin/export-csv', requireAdminAuth, (req: Request, res: Response) => {
  const leaderboard = getSortedLeaderboard();
  let csv = 'Rank,Team Name,Score,Solves,Total Failed Attempts,Last Solve Time,Members,Anomaly Flagged\n';

  leaderboard.forEach((entry) => {
    const membersStr = entry.members.join('; ').replace(/"/g, '""');
    const lastSolveDate = entry.lastSolveTime ? new Date(entry.lastSolveTime).toISOString() : 'N/A';
    csv += `${entry.rank},"${entry.teamName}",${entry.score},${entry.solvesCount},${entry.totalFailedAttempts},"${lastSolveDate}","${membersStr}",${entry.isFlaggedAnomaly}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ctf_final_decrypt_leaderboard.csv"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(csv);
});

// ======================== 6.) CENTRALIZED ERROR HANDLER ========================
// Catches all uncaught errors without leaking stack traces or internals to clients
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const ip = getClientIp(req);
  console.error('[UNCAUGHT SERVER EXCEPTION]', err);

  logSecurityEvent('SYSTEM_ERROR', `Internal exception caught: ${err?.message || 'Unknown error'}`, ip, undefined, 'high');

  // Generic sanitized message - never disclose SQL, paths, or stack traces
  res.status(500).json({
    success: false,
    error: 'A secure server error occurred. Transaction halted and audited.',
  });
});

// --- Real-time Socket.IO Connection Handler ---
io.on('connection', (socket) => {
  socket.emit('state_init', {
    competitionState,
    leaderboard: getSortedLeaderboard(),
    activityFeed: activityFeed.slice(0, 30),
  });
});

// --- Full-Stack Express with Vite integration ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CTF Server] Hardened & Live on http://localhost:${PORT}`);
  });
}

startServer();
