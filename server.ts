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
  ScreenshotAlert,
  AuditActorType,
  AuditActionType,
  AuditLog,
  FeedbackSubmission,
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
import {
  teamStore,
  challengeStore,
  screenshotStore,
  securityLogStore,
  activityFeedStore,
  competitionStateStore,
  submissionStore,
  leaderboardStore,
  auditLogStore,
  feedbackStore,
} from './src/database/persistentStore.ts';

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

// Global OWASP Security Headers (Harden against clickjacking, sniffing, and MIME confusion)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

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
    database: {
      engine: 'SQLite 3',
      file: 'data/ctf_database.sqlite',
      teamsCount: teamStore.count,
    },
    cacheMetrics: redisCache.getMetrics(),
    totalTeams: teams.size,
  });
});

// Strict payload body parser with 5MB ceiling
app.use(express.json({ limit: '5mb' }));

// 4.) Secret Management: Environment variables with secure derivation
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ADMIN_USER_ID = (process.env.ADMIN_USER_ID || 'sys_ctrl_9f8a2b1e7c_root').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CyberZero#2026!';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'Rabum Alal').trim();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@finaldecrypt.ctf').trim();
const ADMIN_ROUTE_SECRET = (process.env.ADMIN_ROUTE_SECRET || '/portal-auth-ctrl-8f9b2').trim();

// --- Management Team & Organizer Multi-Operator Registry ---
// Allows the Lead (Rabum Alal) to grant access to 5-6 management team members secretly
interface ManagementOperator {
  username: string;
  passkey: string;
  role: 'lead' | 'arbiter' | 'manager' | 'coordinator';
  displayName: string;
}

const defaultManagementOperators: ManagementOperator[] = [
  { username: ADMIN_USER_ID.toLowerCase(), passkey: ADMIN_PASSWORD, role: 'lead', displayName: 'System Controller' },
  { username: 'rabum alal', passkey: ADMIN_PASSWORD, role: 'lead', displayName: 'Rabum Alal' },
  { username: 'rabumalal', passkey: ADMIN_PASSWORD, role: 'lead', displayName: 'Rabum Alal' },
  { username: 'arbiter-1', passkey: ADMIN_PASSWORD, role: 'arbiter', displayName: 'Arbiter-1' },
  { username: 'arbiter-2', passkey: ADMIN_PASSWORD, role: 'arbiter', displayName: 'Arbiter-2' },
  { username: 'arbiter-3', passkey: ADMIN_PASSWORD, role: 'arbiter', displayName: 'Arbiter-3' },
  { username: 'arbiter-4', passkey: ADMIN_PASSWORD, role: 'arbiter', displayName: 'Arbiter-4' },
  { username: 'arbiter-5', passkey: ADMIN_PASSWORD, role: 'arbiter', displayName: 'Arbiter-5' },
  { username: 'arbiter-6', passkey: ADMIN_PASSWORD, role: 'arbiter', displayName: 'Arbiter-6' },
  { username: 'management', passkey: ADMIN_PASSWORD, role: 'manager', displayName: 'Management Team' },
];

function getManagementOperators(): ManagementOperator[] {
  const customConfig = process.env.MANAGEMENT_TEAM;
  if (!customConfig) return defaultManagementOperators;
  try {
    if (customConfig.startsWith('[')) {
      return JSON.parse(customConfig);
    }
    const parsed: ManagementOperator[] = [...defaultManagementOperators];
    customConfig.split(',').forEach((entry, idx) => {
      const parts = entry.split(':');
      if (parts[0]) {
        const u = parts[0].trim();
        const p = (parts[1] || ADMIN_PASSWORD).trim();
        parsed.unshift({
          username: u.toLowerCase(),
          passkey: p,
          role: idx === 0 ? 'lead' : 'arbiter',
          displayName: u,
        });
      }
    });
    return parsed;
  } catch (e) {
    console.warn('[Management Auth] Could not parse MANAGEMENT_TEAM config:', e);
  }
  return defaultManagementOperators;
}

// --- High-Scale Inverted Indexes & Cache Stores (Engineered for 1,000+ Concurrent Students) ---
let challenges: Challenge[] = [];
const challengeMap = new Map<string, Challenge>(); // O(1) challenge lookups
const teams = new Map<string, Team>();
const teamNameLowerIndex = new Map<string, string>(); // lowercase teamName -> teamId for O(1) auth & collision checks
let activityFeed: ActivityFeedEvent[] = activityFeedStore.getRecent(250);
let securityLogs: SecurityLog[] = securityLogStore.getAll(300);

// Competition State - Persisted in SQLite config store
const defaultCompetitionState: CompetitionState = {
  status: 'paused',
  startTime: Date.now(),
  durationSeconds: 7200, // 2 hours
  remainingSeconds: 7200,
  writeupMode: false,
  matrixRainSpeed: 1.0,
  announcement: null,
};
const competitionState: CompetitionState = competitionStateStore.getState(defaultCompetitionState);
// Ensure tournament timer is paused on boot until Admin explicitly clicks "START TIMER" in Admin Portal
if (competitionState.remainingSeconds >= competitionState.durationSeconds && competitionState.status === 'running') {
  competitionState.status = 'paused';
  competitionStateStore.saveState(competitionState);
}

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
  securityLogStore.add(log); // Persist to SQLite
  io.emit('security_alert', log);
}

function recordUserActivity(event: ActivityFeedEvent) {
  activityFeed.unshift(event);
  if (activityFeed.length > 250) activityFeed.pop();
  activityFeedStore.add(event); // Persist to SQLite
  io.emit('activity_event', event);
}

function recordAuditLog(
  actorType: AuditActorType,
  actorIdentifier?: string | null,
  actionType?: AuditActionType | string,
  details?: Record<string, any> | string | null,
  ipAddress?: string | null
): AuditLog {
  const log = auditLogStore.add({
    actorType: actorType || 'SYSTEM',
    actorIdentifier: actorIdentifier || 'SYSTEM',
    actionType: (actionType as AuditActionType) || 'SYSTEM_INFO',
    details: details ?? {},
    ipAddress: ipAddress || '127.0.0.1',
  });
  io.emit('audit:new_log', log);
  return log;
}

// ======================== STEALTH ADMIN 404 HONEYPOT ========================
// Scanner and participant probing against standard admin routes must return standard 404
const HONEYPOT_ADMIN_PATHS = new Set([
  '/admin',
  '/admin/',
  '/dashboard/admin',
  '/dashboard/admin/',
  '/login/admin',
  '/login/admin/',
  '/admin-portal',
  '/admin-portal/',
  '/portal/admin',
  '/portal/admin/',
  '/wp-admin',
  '/cpanel',
  '/admin.php',
]);

app.use((req: Request, res: Response, next: NextFunction) => {
  const normalizedPath = req.path.toLowerCase().replace(/\/+$/, '') || '/';
  if (HONEYPOT_ADMIN_PATHS.has(normalizedPath) || HONEYPOT_ADMIN_PATHS.has(req.path.toLowerCase())) {
    logSecurityEvent(
      'ADMIN_PROBE_BLOCKED',
      `Stealth blocked probing request to honeypot path: ${req.path}`,
      getClientIp(req),
      undefined,
      'medium'
    );
    return res.status(404).type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>404 Not Found</title></head>
<body style="font-family:sans-serif;text-align:center;padding:50px;background:#fff;color:#222;">
  <h1>404 Not Found</h1>
  <p>The requested URL was not found on this server.</p>
</body>
</html>`);
  }
  next();
});

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

// High-Throughput Leaderboard Cache (Sub-millisecond retrieval for 1,000+ teams)
let cachedLeaderboard: LeaderboardEntry[] | null = null;
let lastLeaderboardCalc = 0;

function invalidateLeaderboardCache() {
  cachedLeaderboard = null;
  redisCache.invalidate('cache:state:public');
  redisCache.invalidate('cache:leaderboard');
}

// Tie-Breaker algorithm:
// 1. Disqualified teams pushed to bottom
// 2. Highest score
// 3. Earliest timestamp reaching that score
// 4. Fewer total incorrect attempts
function getSortedLeaderboard(): LeaderboardEntry[] {
  const now = Date.now();
  if (cachedLeaderboard && now - lastLeaderboardCalc < 1000) {
    return cachedLeaderboard;
  }

  const teamList = Array.from(teams.values());

  teamList.sort((a, b) => {
    // 1. Disqualified teams placed at bottom
    if (Boolean(a.isDisqualified) !== Boolean(b.isDisqualified)) {
      return a.isDisqualified ? 1 : -1;
    }

    // 2. Pure unbiased score sorting: highest points first across all teams (positive, zero, or negative)
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // 4. Tie-breakers:
    // Earliest timestamp reaching that score
    if (a.lastSolveTime !== b.lastSolveTime) {
      if (a.lastSolveTime === 0) return 1;
      if (b.lastSolveTime === 0) return -1;
      return a.lastSolveTime - b.lastSolveTime;
    }
    // Fewer total incorrect attempts
    if (a.totalFailedAttempts !== b.totalFailedAttempts) {
      return a.totalFailedAttempts - b.totalFailedAttempts;
    }
    return a.registeredAt - b.registeredAt;
  });

  const sorted: LeaderboardEntry[] = teamList.map((team, idx) => ({
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

  cachedLeaderboard = sorted;
  lastLeaderboardCalc = now;
  return sorted;
}

function broadcastLeaderboard() {
  invalidateLeaderboardCache();
  const sorted = getSortedLeaderboard();
  leaderboardStore.syncLeaderboard(sorted); // Persist evaluated rankings to SQLite leaderboard table
  io.emit('leaderboard_update', sorted);
}

function broadcastState() {
  invalidateLeaderboardCache();
  const sorted = getSortedLeaderboard();
  leaderboardStore.syncLeaderboard(sorted); // Persist evaluated rankings to SQLite leaderboard table
  redisCache.invalidate('cache:state');
  redisCache.invalidate('cache:state:public');
  io.emit('state_update', {
    competitionState,
    leaderboard: sorted,
    challenges: getPublicChallengesForTeam(),
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

// Seed & Load Challenges from SQLite persistent database
function loadInitialQuestions() {
  try {
    challengeStore.syncFromQuestionsJson(path.join(__dirname, 'questions.json'));
    challenges = challengeStore.getAll();
    challengeMap.clear();
    for (const chal of challenges) {
      challengeMap.set(chal.id, chal);
    }
    console.log(`[SQLite Database] Successfully synchronized & indexed ${challenges.length} challenges from questions.json`);

    // Purge any old dummy events referencing placeholder challenges from disk
    activityFeedStore.purgeResidualDummyEvents();
    activityFeed = activityFeedStore.getRecent(100).filter(
      (ev) =>
        !ev.challengeTitle?.includes('Phantom') &&
        !ev.challengeTitle?.includes('Memory Dump') &&
        !ev.challengeTitle?.includes('Subcarrier') &&
        !ev.message?.includes('Phantom Pixel')
    );
  } catch (err) {
    console.error('[SQLite Database] Failed to load challenges from SQLite store:', err);
  }
}

// Seed Demo Competitor Teams for Realism
function seedDemoTeams() {
  const demoSeed = [
    {
      teamName: '0xDeadBeef',
      members: ['Alice (Lead)', 'Bob', 'CipherX'],
      score: 350,
      solves: ['chal-r2-02', 'chal-r2-03', 'chal-r2-04'],
      firstBloods: ['chal-r2-02'],
      totalFailedAttempts: 1,
    },
    {
      teamName: 'NullPointerCrew',
      members: ['RootKit', 'ZeroDay', 'Neo'],
      score: 250,
      solves: ['chal-r2-03', 'chal-r2-05'],
      firstBloods: ['chal-r2-03'],
      totalFailedAttempts: 3,
    },
    {
      teamName: 'BinaryShadows',
      members: ['Ghost', 'Spectre'],
      score: 200,
      solves: ['chal-r2-02', 'chal-r2-04'],
      firstBloods: [],
      totalFailedAttempts: 2,
    },
    {
      teamName: 'ViperSec',
      members: ['Viper', 'Krypton', 'ByteStorm', 'Hex'],
      score: 150,
      solves: ['chal-r2-06'],
      firstBloods: ['chal-r2-06'],
      totalFailedAttempts: 4,
    },
    {
      teamName: 'CyberValkyrie',
      members: ['Freya', 'Sigrun'],
      score: 100,
      solves: ['chal-r2-04'],
      firstBloods: ['chal-r2-04'],
      totalFailedAttempts: 0,
    },
  ];

  demoSeed.forEach((d, idx) => {
    const id = 'seed-team-' + idx;
    const now = Date.now() - (demoSeed.length - idx) * 180000;
    const teamSolves: Record<string, { solvedAt: number; pointsAwarded: number; isFirstBlood: boolean }> = {};

    d.solves.forEach((chalId) => {
      const chal = challengeMap.get(chalId) || challenges.find((c) => c.id === chalId);
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

    teamNameLowerIndex.set(d.teamName.toLowerCase(), id);
    redisCache.zadd('ctf:leaderboard:zset', d.score, id);
  });

  activityFeed = [
    {
      id: 'act-1',
      timestamp: Date.now() - 600000,
      type: 'first_blood',
      teamName: '0xDeadBeef',
      challengeTitle: 'What the Eyes Cannot See',
      points: 150,
      message: 'Claimed [FIRST BLOOD] on What the Eyes Cannot See (+150 pts)!',
    },
    {
      id: 'act-2',
      timestamp: Date.now() - 480000,
      type: 'first_blood',
      teamName: 'NullPointerCrew',
      challengeTitle: 'Strings Attached',
      points: 150,
      message: 'Claimed [FIRST BLOOD] on Strings Attached (+150 pts)!',
    },
    {
      id: 'act-3',
      timestamp: Date.now() - 320000,
      type: 'solve',
      teamName: 'BinaryShadows',
      challengeTitle: 'The Careless Admin',
      points: 100,
      message: 'Decrypted The Careless Admin (+100 pts)!',
    },
    {
      id: 'act-4',
      timestamp: Date.now() - 150000,
      type: 'first_blood',
      teamName: 'ViperSec',
      challengeTitle: 'Metadata Never Sleeps',
      points: 150,
      message: 'Claimed [FIRST BLOOD] on Metadata Never Sleeps (+150 pts)!',
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

// Load & Index All Persistent Registered Teams From Database Store
function loadPersistedTeams() {
  const persisted = teamStore.getAll();
  persisted.forEach((t) => {
    // Only Admin Arbitration has the authority to disqualify a team. Clear previous automatic disqualifications.
    if (
      t.isDisqualified &&
      !t.disqualifiedReason?.toLowerCase().includes('manual') &&
      !t.disqualifiedReason?.toLowerCase().includes('admin arbitration')
    ) {
      t.isDisqualified = false;
      t.disqualifiedReason = undefined;
      t.disqualifiedAt = undefined;
      teamStore.update(t.id, { isDisqualified: false, disqualifiedReason: undefined, disqualifiedAt: undefined });
    }
    teams.set(t.id, t);
    teamNameLowerIndex.set(t.teamName.toLowerCase().trim(), t.id);
    redisCache.zadd('ctf:leaderboard:zset', t.score, t.id);
  });
  console.log(`[CTF Database] Loaded & synchronized ${persisted.length} registered student teams from persistent disk store`);
  const initialStandings = getSortedLeaderboard();
  leaderboardStore.syncLeaderboard(initialStandings);
  console.log(`[CTF Database] Computed & persisted evaluated leaderboard (${initialStandings.length} teams) into SQLite leaderboard table`);
}

loadInitialQuestions();
loadPersistedTeams();

// --- Server-Authoritative Timer & Auto-Submit Engine ---
// Milestone broadcasts: 1:30h (5400s), 1h (3600s), 30m (1800s), 15m (900s), 5m (300s)
const AUTOMATIC_TIME_MILESTONES: Record<number, { title: string; message: string }> = {
  5400: {
    title: 'TIME REMAINING: 1 HOUR 30 MINUTES',
    message: 'Official Broadcast: Exactly 1 hour and 30 minutes remain in the challenge. Keep decrypting and pace your strategies!',
  },
  3600: {
    title: 'TIME REMAINING: 1 HOUR',
    message: 'Official Broadcast: Exactly 1 hour remaining in the challenge! Push your decryption efforts now.',
  },
  1800: {
    title: 'TIME REMAINING: 30 MINUTES',
    message: 'Official Broadcast: 30 minutes remaining! Half an hour left on the clock—secure your points and finalize submissions.',
  },
  900: {
    title: 'TIME REMAINING: 15 MINUTES',
    message: 'Critical Broadcast: 15 minutes remaining! Final sprint underway—every second counts!',
  },
  300: {
    title: 'TIME REMAINING: 5 MINUTES',
    message: 'Final Warning: Only 5 minutes remaining in the challenge! Wrap up your active flags immediately.',
  },
};

const triggeredMilestones = new Set<number>();
let autoDismissAnnouncementTimer: NodeJS.Timeout | null = null;

function resetTriggeredMilestonesFor(remainingSec: number) {
  for (const milestone of Object.keys(AUTOMATIC_TIME_MILESTONES).map(Number)) {
    if (remainingSec > milestone) {
      triggeredMilestones.delete(milestone);
    }
  }
}

setInterval(() => {
  if (competitionState.status === 'running') {
    if (competitionState.remainingSeconds > 0) {
      competitionState.remainingSeconds--;

      // 1.) Automatic Time Milestone Broadcasts (1:30 hrs, 1 hr, 30 mins, 15 mins, 5 mins)
      const milestone = AUTOMATIC_TIME_MILESTONES[competitionState.remainingSeconds];
      if (milestone && !triggeredMilestones.has(competitionState.remainingSeconds)) {
        triggeredMilestones.add(competitionState.remainingSeconds);

        const announcement = {
          id: 'ann-auto-' + competitionState.remainingSeconds + '-' + Date.now(),
          title: milestone.title,
          message: milestone.message,
          timestamp: Date.now(),
          autoDismissSeconds: 60,
        };

        competitionState.announcement = announcement;
        competitionStateStore.saveState(competitionState);

        const alertEvent: ActivityFeedEvent = {
          id: 'act-' + crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'announcement',
          teamName: 'SYSTEM BROADCAST',
          message: `[TIME BROADCAST] ${announcement.title}: ${announcement.message}`,
        };
        recordUserActivity(alertEvent);

        io.emit('announcement_broadcast', announcement);

        // Auto-dismiss broadcast after 60 seconds (1 minute max visibility)
        if (autoDismissAnnouncementTimer) clearTimeout(autoDismissAnnouncementTimer);
        autoDismissAnnouncementTimer = setTimeout(() => {
          if (competitionState.announcement?.id === announcement.id) {
            competitionState.announcement = null;
            competitionStateStore.saveState(competitionState);
            io.emit('announcement_cleared');
          }
        }, 60000);
      }

      // 2.) Auto-finalize when timer hits 0
      if (competitionState.remainingSeconds === 0) {
        competitionState.status = 'ended';
        competitionState.remainingSeconds = 0;
        competitionStateStore.saveState(competitionState);

        // Auto-finalize: calculate final unbiased points and standings for all participants
        invalidateLeaderboardCache();
        const finalStandings = getSortedLeaderboard();
        leaderboardStore.syncLeaderboard(finalStandings);
        teamStore.flushToDisk();
        const top3 = finalStandings.slice(0, 3);

        const alertEvent: ActivityFeedEvent = {
          id: 'act-' + crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'announcement',
          teamName: 'SYSTEM',
          message: 'COMPETITION TIME EXPIRED! All submissions locked. Official tournament rankings are finalized.',
        };
        recordUserActivity(alertEvent);

        // Broadcast completion and top 3 winners podium to all participant screens
        io.emit('competition_ended', { top3, finalStandings });
        broadcastLeaderboard();
        broadcastState();
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

const lastAdminAuthFailureLog = new Map<string, number>();

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const rawToken = req.headers['x-admin-token'] || req.headers.authorization?.replace('Bearer ', '');
  const ip = getClientIp(req);

  if (!rawToken || typeof rawToken !== 'string') {
    const now = Date.now();
    const last = lastAdminAuthFailureLog.get(ip + ':missing') || 0;
    if (now - last > 15000) {
      lastAdminAuthFailureLog.set(ip + ':missing', now);
      logSecurityEvent('INVALID_AUTH', 'Unauthorized access attempt to /admin route', ip, undefined, 'high');
    }
    return res.status(403).json({ success: false, error: 'Forbidden: Administrator credentials required.' });
  }

  const result = verifySignedToken(rawToken);
  if (!result.valid || !result.payload || result.payload.role !== 'admin') {
    const now = Date.now();
    const last = lastAdminAuthFailureLog.get(ip + ':invalid') || 0;
    if (now - last > 15000) {
      lastAdminAuthFailureLog.set(ip + ':invalid', now);
      logSecurityEvent('INVALID_AUTH', `Admin RBAC authorization failed: ${result.error || 'Role mismatch'}`, ip, undefined, 'high');
    }
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

  // Rate Limiting Protection against spam squad registrations
  const rateResult = checkRateLimitTier('TEAM_AUTH', ip);
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', rateResult.resetSeconds);
    logSecurityEvent('RATE_LIMIT', `Team registration throttled: ${ip}`, ip, undefined, 'medium');
    return res.status(429).json({ success: false, error: rateResult.reason });
  }

  // Input Validation with Zod (enforces min 8 chars with letter + number, 2-3 members)
  const validation = TeamSignupSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid registration parameters.',
    });
  }

  const { teamName, email, password, members } = validation.data;
  const sanitizedTeamName = sanitizeInput(teamName);
  const sanitizedEmail = sanitizeInput(email).toLowerCase().trim();
  const sanitizedMembers = members.map((m) => sanitizeInput(m));
  const lowerName = sanitizedTeamName.toLowerCase();

  // O(1) Inverted Index Duplicate Check for Team Name
  if (teamNameLowerIndex.has(lowerName)) {
    return res.status(409).json({
      success: false,
      error: 'Team name is already registered. Please select a different name or log in.',
    });
  }

  // Anti-Cheat: Strictly block duplicate registrations by email to prevent multi-accounting
  if (teamStore.hasEmail(sanitizedEmail)) {
    return res.status(409).json({
      success: false,
      error: 'This email address is already registered to a competing squad. Duplicate registrations are prohibited to avoid cheating.',
    });
  }

  // Salt & Hash Password with Argon2id-grade memory-hard scrypt
  const { salt, hash } = hashPassword(password);
  const id = 'team-' + crypto.randomUUID();

  const team: Team = {
    id,
    teamName: sanitizedTeamName,
    email: sanitizedEmail,
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
  teamNameLowerIndex.set(lowerName, id);
  teamStore.save(team);
  redisCache.zadd('ctf:leaderboard:zset', 0, id);

  const joinEvent: ActivityFeedEvent = {
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'user_signup',
    teamName: team.teamName,
    message: `Team [${team.teamName}] registered (${team.members.length} members: ${team.members.join(', ')}).`,
  };
  recordUserActivity(joinEvent);
  io.emit('admin:team_registered', team);
  broadcastLeaderboard();

  // Audit Log: Precise timestamped registration
  recordAuditLog(
    'STUDENT',
    team.teamName,
    'REGISTRATION',
    {
      teamId: team.id,
      teamName: team.teamName,
      email: team.email,
      members: team.members,
      registeredAt: new Date().toISOString(),
    },
    ip
  );

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

// 2.) Dedicated Secure Team Login & Stealth Unified Admin Gateway
app.post('/api/auth/login', (req: Request, res: Response) => {
  const ip = getClientIp(req);

  // Rate Limiting Protection against credential-stuffing and brute force
  const rateResult = checkRateLimitTier('TEAM_AUTH', ip);
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', rateResult.resetSeconds);
    logSecurityEvent('BRUTE_FORCE_LOCKOUT', `Authentication rate limit exceeded for ${ip}`, ip, undefined, 'high');
    return res.status(429).json({ success: false, error: rateResult.reason });
  }

  const validation = TeamLoginSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.issues[0]?.message || 'Team name and password required.',
    });
  }

  const { teamName, password } = validation.data;
  const cleanName = sanitizeInput(teamName).toLowerCase().trim();

  // --- Strict Stealth Admin Authentication Gate ---
  // Authenticates ONLY the secret high-entropy ADMIN_USER_ID or explicitly registered management operators
  const operators = getManagementOperators();
  const isMatchAdminUserId = cleanName === ADMIN_USER_ID.toLowerCase().trim();
  const matchedOperator = operators.find(
    (op) =>
      op.username.toLowerCase().trim() === cleanName ||
      op.displayName.toLowerCase().trim() === cleanName
  );

  let isOperatorAuth = false;
  let activeOperatorName = ADMIN_USERNAME;

  if (isMatchAdminUserId) {
    const givenHash = crypto.createHash('sha256').update(password).digest();
    const targetHash = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    if (crypto.timingSafeEqual(givenHash, targetHash)) {
      isOperatorAuth = true;
      activeOperatorName = ADMIN_USERNAME;
    }
  } else if (matchedOperator) {
    const givenHash = crypto.createHash('sha256').update(password).digest();
    const targetHash = crypto.createHash('sha256').update(matchedOperator.passkey).digest();
    if (crypto.timingSafeEqual(givenHash, targetHash)) {
      isOperatorAuth = true;
      activeOperatorName = matchedOperator.displayName;
    }
  }

  if (isOperatorAuth) {
    logSecurityEvent(
      'INVALID_AUTH',
      `Administrator [${activeOperatorName}] authenticated via standard login portal`,
      ip,
      undefined,
      'low'
    );
    recordAuditLog(
      'ADMIN',
      activeOperatorName,
      'LOGIN',
      {
        operator: activeOperatorName,
        method: 'stealth_login_portal',
        role: 'admin',
      },
      ip
    );
    const token = createSignedToken(
      'admin',
      `admin-${cleanName.replace(/\s+/g, '-')}`,
      43200000,
      activeOperatorName
    );
    return res.json({
      success: true,
      isAdmin: true,
      adminName: activeOperatorName,
      token,
      message: `Command authority confirmed for ${activeOperatorName}.`,
    });
  }

  // O(1) Index Lookup by Team Name or Email
  const matchedTeamId = teamNameLowerIndex.get(cleanName);
  let matchedTeam: Team | undefined = matchedTeamId ? teams.get(matchedTeamId) : undefined;

  // Secondary O(1) Email Lookup to allow login by email
  if (!matchedTeam) {
    matchedTeam = teamStore.getByEmail(cleanName);
  }

  // Fallback linear check if index wasn't populated
  if (!matchedTeam) {
    for (const t of teams.values()) {
      if (
        t.teamName.toLowerCase() === cleanName ||
        (t.email && t.email.toLowerCase() === cleanName)
      ) {
        matchedTeam = t;
        teamNameLowerIndex.set(cleanName, t.id);
        break;
      }
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

  // Record user activity
  recordUserActivity({
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'user_login',
    teamName: matchedTeam.teamName,
    message: `Team [${matchedTeam.teamName}] authenticated / logged in from ${ip}.`,
  });

  // Audit Log: Precise timestamped student login
  recordAuditLog(
    'STUDENT',
    matchedTeam.teamName,
    'LOGIN',
    {
      teamId: matchedTeam.id,
      teamName: matchedTeam.teamName,
      email: matchedTeam.email,
    },
    ip
  );

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

  if (existingTeam) {
    return res.status(409).json({
      success: false,
      error: 'Team name is already registered. Please authenticate via team login with your password.',
    });
  }

  const id = 'team-' + crypto.randomUUID();
  const team: Team = {
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

    teamStore.save(team);
    const joinEvent: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'user_signup',
      teamName: team.teamName,
      message: `Team [${team.teamName}] registered (${team.members.length} members: ${team.members.join(', ')}).`,
    };
    recordUserActivity(joinEvent);
    broadcastLeaderboard();
    recordAuditLog(
      'STUDENT',
      team.teamName,
      'REGISTRATION',
      {
        teamId: team.id,
        teamName: team.teamName,
        members: team.members,
        endpoint: '/api/auth/team',
      },
      ip
    );

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

// Stealth Admin Secret Route Verification
app.post('/api/auth/verify-admin-route', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const { route } = req.body || {};

  if (typeof route !== 'string') {
    return res.status(404).json({ valid: false, error: 'Not found' });
  }

  // Rate Limiting: Prevent route brute-forcing
  const rateResult = checkRateLimitTier('ADMIN_LOGIN', ip);
  if (!rateResult.allowed) {
    return res.status(404).json({ valid: false, error: 'Not found' });
  }

  const givenBuffer = Buffer.from(route);
  const targetBuffer = Buffer.from(ADMIN_ROUTE_SECRET);
  const isMatch =
    givenBuffer.length === targetBuffer.length &&
    crypto.timingSafeEqual(givenBuffer, targetBuffer);

  if (isMatch) {
    return res.json({ valid: true });
  }

  // Stealth 404 to prevent enumeration
  return res.status(404).json({ valid: false, error: 'Not found' });
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

  // Timing-safe comparison using uniform 32-byte SHA-256 digests
  const givenHash = crypto.createHash('sha256').update(password).digest();
  const targetHash = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  const isMatch = crypto.timingSafeEqual(givenHash, targetHash);

  const operators = getManagementOperators();
  const matchedOperator = operators.find((op) => {
    const opHash = crypto.createHash('sha256').update(op.passkey).digest();
    return crypto.timingSafeEqual(givenHash, opHash);
  });

  if (isMatch || matchedOperator) {
    const activeName = matchedOperator ? matchedOperator.displayName : ADMIN_USERNAME;
    const token = createSignedToken(
      'admin',
      `admin-${activeName.toLowerCase().replace(/\s+/g, '-')}`,
      43200000,
      activeName
    );

    recordAuditLog(
      'ADMIN',
      activeName,
      'LOGIN',
      {
        operator: activeName,
        method: 'master_passkey',
        role: 'admin',
      },
      ip
    );

    res.json({ success: true, token, adminName: activeName });
  } else {
    logSecurityEvent('INVALID_AUTH', 'Failed master admin passkey entry', ip, undefined, 'high');
    res.status(401).json({ success: false, error: 'Invalid master passkey credentials.' });
  }
});

// Public Sync State with Redis Cache
app.get('/api/state', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const rawToken = req.headers.authorization?.replace('Bearer ', '');
  let team: Team | undefined;
  let tokenExpired = false;

  if (rawToken) {
    const verified = verifySignedToken(rawToken);
    if (verified.valid && verified.payload && verified.payload.role === 'team') {
      team = teams.get(verified.payload.subjectId) || teamStore.getById(verified.payload.subjectId);
      if (team && !teams.has(team.id)) {
        teams.set(team.id, team);
      }
      if (!team) {
        tokenExpired = true;
      }
    } else {
      tokenExpired = true;
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
    tokenExpired,
    team: team
      ? {
          id: team.id,
          teamName: team.teamName,
          email: team.email,
          members: team.members,
          score: team.score,
          solves: team.solves,
          hintsUnlocked: team.hintsUnlocked,
          failedAttempts: team.failedAttempts,
          totalFailedAttempts: team.totalFailedAttempts,
          strikes: team.strikes || 0,
          isDisqualified: Boolean(team.isDisqualified),
          disqualifiedReason: team.disqualifiedReason,
          hasStarted: Boolean(team.hasStarted),
          startedAt: team.startedAt,
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

// Toggle Demo Teams vs Clean Slate (Admin Authorization Strictly Required)
app.post('/api/scoreboard/mode', requireAdminAuth, (req: Request, res: Response) => {
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

  const chal = challengeMap.get(challengeId) || challenges.find((c) => c.id === challengeId);
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
  const targetFlag = chal.flag.trim();
  const submittedHash = crypto.createHash('sha256').update(submittedFlag).digest();
  const targetHash = crypto.createHash('sha256').update(targetFlag).digest();
  const isCorrect = crypto.timingSafeEqual(submittedHash, targetHash);

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

    // Persist challenge solve count & first blood to SQLite
    challengeStore.update(chal.id, {
      solvesCount: chal.solvesCount,
      firstBloodTeam: chal.firstBloodTeam,
    });

    const basePoints = chal.points;
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

    // Synchronize to Redis ZSET and Persistent DB
    redisCache.zadd('ctf:leaderboard:zset', team.score, team.id).catch(() => {});
    teamStore.update(team.id, {
      score: team.score,
      lastSolveTime: team.lastSolveTime,
      solves: team.solves,
    });
    io.emit('admin:team_updated', team);

    // Persist to SQLite Submission Audit Log
    submissionStore.record({
      id: 'sub-' + crypto.randomUUID(),
      teamId: team.id,
      teamName: team.teamName,
      challengeId: chal.id,
      challengeTitle: chal.title,
      submittedFlag,
      isCorrect: true,
      pointsAwarded: finalPoints,
      timestamp: now,
      ip,
    });

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

    recordUserActivity(feedEvent);
    broadcastLeaderboard();
    broadcastState();

    // Audit Log: Timestamped Flag Solved
    recordAuditLog(
      'STUDENT',
      team.teamName,
      'FLAG_SUBMISSION',
      {
        challengeId: chal.id,
        challengeTitle: chal.title,
        isCorrect: true,
        pointsAwarded: finalPoints,
        isFirstBlood,
        totalTeamScore: team.score,
      },
      ip
    );

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
    teamStore.update(team.id, {
      failedAttempts: team.failedAttempts,
      totalFailedAttempts: team.totalFailedAttempts,
    });
    io.emit('admin:team_updated', team);

    // Persist Failed Submission to SQLite Audit Log
    submissionStore.record({
      id: 'sub-' + crypto.randomUUID(),
      teamId: team.id,
      teamName: team.teamName,
      challengeId: chal.id,
      challengeTitle: chal.title,
      submittedFlag,
      isCorrect: false,
      pointsAwarded: 0,
      timestamp: Date.now(),
      ip,
    });

    const remaining = Math.max(0, chal.maxAttempts - newCount);

    // Record user activity for failed submission attempt
    recordUserActivity({
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'failed_submission',
      teamName: team.teamName,
      challengeTitle: chal.title,
      points: 0,
      message: `Submitted incorrect flag "${submittedFlag.slice(0, 30)}" for ${chal.title} (${remaining}/${chal.maxAttempts} attempts left).`,
    });

    // Audit Log: Timestamped Failed Flag Submission
    recordAuditLog(
      'STUDENT',
      team.teamName,
      'FLAG_SUBMISSION',
      {
        challengeId: chal.id,
        challengeTitle: chal.title,
        isCorrect: false,
        pointsAwarded: 0,
        attemptsRemaining: remaining,
        submittedFlagSnippet: submittedFlag.slice(0, 24),
      },
      ip
    );

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
  const ip = getClientIp(req);

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

  // Deduct 25 points whenever a user takes hints for the first time of that particular question.
  // If user has 0 points, their score will go negative (e.g. 0 - 25 = -25).
  const isFirstHintForQuestion = team.hintsUnlocked[challengeId].length === 0;
  const hintPenalty = isFirstHintForQuestion
    ? 25
    : (hint.cost !== undefined && hint.cost !== null ? hint.cost : 25);

  if (hintPenalty > 0) {
    team.score -= hintPenalty;
  }

  team.hintsUnlocked[challengeId].push(hintId);
  teamStore.update(team.id, {
    score: team.score,
    hintsUnlocked: team.hintsUnlocked,
  });
  io.emit('admin:team_updated', team);
  broadcastLeaderboard();
  broadcastState();

  const event: ActivityFeedEvent = {
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'hint_unlocked',
    teamName: team.teamName,
    challengeTitle: chal.title,
    points: -hintPenalty,
    message: `Unlocked Hint for ${chal.title} (-${hintPenalty} pts deducted. Score: ${team.score} pts).`,
  };
  recordUserActivity(event);

  // Audit Log: Timestamped Hint Unlock
  recordAuditLog(
    'STUDENT',
    team.teamName,
    'HINT_UNLOCK',
    {
      challengeId: chal.id,
      challengeTitle: chal.title,
      hintId: hint.id,
      cost: hintPenalty,
      newScore: team.score,
    },
    ip
  );

  res.json({
    success: true,
    hintContent: hint.content,
    penalty: hintPenalty,
    teamScore: team.score,
    message: `Hint unlocked! -${hintPenalty} pts deducted. Current score: ${team.score} pts.`,
  });
});

// 5.) Challenge Artifact In-Browser Display & Download Engine
app.get('/api/challenges/:id/attachment', (req: Request, res: Response) => {
  const chal = challenges.find((c) => c.id === req.params.id);
  if (!chal || !chal.attachment) {
    return res.status(404).json({ success: false, error: 'Artifact attachment not found.' });
  }

  const attachmentsDir = path.resolve(__dirname, 'attachments');
  const rawFileName = path.basename(chal.attachment.fileName);
  const diskPath = path.resolve(attachmentsDir, rawFileName);

  // Security: Enforce strict directory containment against path traversal
  if (!diskPath.startsWith(attachmentsDir)) {
    logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', `Path traversal attempt on attachment: ${chal.attachment.fileName}`, getClientIp(req), undefined, 'high');
    return res.status(403).json({ success: false, error: 'Path traversal violation detected.' });
  }

  const diskExists = fs.existsSync(diskPath);
  const fileSize = diskExists ? fs.statSync(diskPath).size : Buffer.byteLength(chal.attachment.content || '');

  const validation = validateFileAttachment(
    rawFileName,
    fileSize
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

  const isInline = req.query.view === 'inline' || req.query.inline === 'true';

  // Audit team activity
  const authHeader = (req.headers.authorization || '').replace('Bearer ', '') || (req.query.token as string);
  let team: Team | undefined;
  if (authHeader) {
    const verified = verifySignedToken(authHeader);
    if (verified.valid && verified.payload && verified.payload.role === 'team') {
      team = teams.get(verified.payload.subjectId);
    }
  }
  if (!team) {
    const ip = getClientIp(req);
    team = Array.from(teams.values()).find((t) => t.ip === ip);
  }
  if (team) {
    recordUserActivity({
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'artifact_view',
      teamName: team.teamName,
      challengeTitle: chal.title,
      message: `${isInline ? 'Inspected artifact' : 'Downloaded file'} "${chal.attachment.fileName}" for challenge "${chal.title}".`,
    });
    recordAuditLog(
      'STUDENT',
      team.teamName,
      'ARTIFACT_INSPECTED',
      {
        challengeId: chal.id,
        challengeTitle: chal.title,
        fileName: chal.attachment.fileName,
        isInline: Boolean(isInline),
      },
      getClientIp(req)
    );
  }

  if (isInline) {
    // In-browser rendering headers: Allows same-domain inline viewing & iframe inspection with script sandbox
    res.setHeader('Content-Disposition', `inline; filename="${validation.sanitizedFilename}"`);
    res.setHeader('Content-Type', chal.attachment.mimeType || 'text/plain; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=3600');
  } else {
    // Standard secure download headers
    const headers = getSafeAttachmentHeaders(validation.sanitizedFilename, chal.attachment.mimeType);
    for (const [key, val] of Object.entries(headers)) {
      res.setHeader(key, val);
    }
  }

  if (diskExists) {
    return res.sendFile(diskPath);
  }

  if (chal.attachment.content && chal.attachment.content.startsWith('base64:')) {
    return res.send(Buffer.from(chal.attachment.content.slice(7), 'base64'));
  }

  res.send(chal.attachment.content);
});

// Challenge Artifact Telemetry & Metadata API for In-App Viewer
app.get('/api/challenges/:id/artifact/data', (req: Request, res: Response) => {
  const chal = challenges.find((c) => c.id === req.params.id);
  if (!chal || !chal.attachment) {
    return res.status(404).json({ success: false, error: 'Artifact not found' });
  }

  // Audit team activity
  const authHeader = (req.headers.authorization || '').replace('Bearer ', '') || (req.query.token as string);
  let team: Team | undefined;
  if (authHeader) {
    const verified = verifySignedToken(authHeader);
    if (verified.valid && verified.payload && verified.payload.role === 'team') {
      team = teams.get(verified.payload.subjectId);
    }
  }
  if (!team) {
    const ip = getClientIp(req);
    team = Array.from(teams.values()).find((t) => t.ip === ip);
  }
  if (team) {
    recordUserActivity({
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'artifact_view',
      teamName: team.teamName,
      challengeTitle: chal.title,
      message: `Inspected artifact file "${chal.attachment.fileName}" for challenge "${chal.title}".`,
    });
    recordAuditLog(
      'STUDENT',
      team.teamName,
      'ARTIFACT_INSPECTED',
      {
        challengeId: chal.id,
        challengeTitle: chal.title,
        fileName: chal.attachment.fileName,
        viewType: 'in_app_viewer',
      },
      getClientIp(req)
    );
  }

  const { fileName, mimeType, size, content } = chal.attachment;
  const ext = path.extname(fileName).toLowerCase();
  const isImage = /^\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(ext) || mimeType.startsWith('image/');
  const isPdf = ext === '.pdf' || mimeType === 'application/pdf';
  const isCsv = ext === '.csv' || ext === '.tsv';
  const isText = isCsv || /^\.(txt|log|py|c|cpp|sh|json|md|env|yml|yaml|asm|hex)$/i.test(ext) || mimeType.startsWith('text/');

  let rawContent = content;
  const diskPath = path.join(__dirname, 'attachments', fileName);
  if (fs.existsSync(diskPath) && isText) {
    try {
      rawContent = fs.readFileSync(diskPath, 'utf-8');
    } catch {}
  }

  res.json({
    success: true,
    id: chal.id,
    challengeTitle: chal.title,
    fileName,
    mimeType,
    size,
    ext,
    isImage,
    isPdf,
    isText,
    isCsv,
    rawContent,
    viewUrl: `/api/challenges/${chal.id}/attachment?view=inline`,
    downloadUrl: `/api/challenges/${chal.id}/attachment`,
  });
});

// Telemetry & Security Infraction Engine
// Tab switching and window focus changes are 100% permitted per competition rules.
// Only screen capture attempts (PrintScreen / Snipping Tool) trigger screenshot warnings.
app.post('/api/telemetry/strike', requireTeamAuth, async (req: Request, res: Response) => {
  const team: Team = (req as any).team;
  return res.json({
    success: true,
    strikes: team.strikes || 0,
    isDisqualified: Boolean(team.isDisqualified),
    message: 'Tab switching and inspection shortcuts are permitted without penalty. Only screenshot capture is monitored.',
  });
});

// --- Screenshot Attempt Detection & Admin Real-Time Alert ---
const screenshotAlerts: ScreenshotAlert[] = screenshotStore.getAll(100);

app.post('/api/telemetry/screenshot', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const { key, details, teamId: bodyTeamId, teamName: bodyTeamName } = req.body;

  // 0. Strict Admin & Official Exemption: Administrators must NEVER be penalized or recorded
  const adminHeader = req.headers['x-admin-token'] || (typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
  if (adminHeader && typeof adminHeader === 'string') {
    const adminVerify = verifySignedToken(adminHeader);
    if (adminVerify.valid && adminVerify.payload?.role === 'admin') {
      return res.json({
        success: true,
        message: 'Admin / Official action exempt from proctoring telemetry.',
      });
    }
  }

  let team: Team | undefined;

  // 1. Try Bearer token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const verified = verifySignedToken(token);
    if (verified.valid) {
      if (verified.payload?.role === 'admin') {
        return res.json({
          success: true,
          message: 'Admin / Official action exempt from proctoring telemetry.',
        });
      }
      if (verified.payload?.subjectId) {
        team = teams.get(verified.payload.subjectId);
      }
    }
  }

  // 2. Prevent Frame/Spoofing Attacks:
  // Strikes can ONLY be attributed to a squad if authenticated via cryptographically signed token.
  // Unauthenticated requests or body-only teamIds are NEVER trusted to increment strikes on a competing squad.
  if (!team) {
    return res.json({
      success: true,
      message: 'Unauthenticated capture event logged without squad strike penalty.',
    });
  }

  const resolvedTeamId = team.id;
  const resolvedTeamName = team.teamName;
  const resolvedEmail = team.email || req.body.email || undefined;
  const resolvedMembers = team.members || [];

  const triggerKey = sanitizeInput(key || 'PrintScreen');
  const alertDetails = sanitizeInput(details || 'Screenshot capture shortcut / PrintScreen triggered');

  const alert: ScreenshotAlert = {
    id: 'ss-' + crypto.randomUUID(),
    teamId: resolvedTeamId,
    teamName: resolvedTeamName,
    email: resolvedEmail,
    members: resolvedMembers,
    ip,
    timestamp: Date.now(),
    triggerKey,
    details: alertDetails,
  };

  screenshotAlerts.unshift(alert);
  if (screenshotAlerts.length > 100) screenshotAlerts.pop();
  screenshotStore.add(alert); // Persist to SQLite

  // Record activity in live audit feed
  recordUserActivity({
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'system',
    teamName: resolvedTeamName,
    message: `📸 Screen capture shortcut triggered (${triggerKey}) by [${resolvedTeamName}].`,
  });

  // Increment team strikes for screenshot violation (never disqualifies)
  team.strikes = (team.strikes || 0) + 1;
  teamStore.update(team.id, { strikes: team.strikes, isDisqualified: false });
  io.emit('admin:team_updated', team);

  // Instantly broadcast to admin side panel via WebSockets
  io.emit('admin:screenshot_alert', alert);

  // Security Incident Audit Log
  logSecurityEvent(
    'SCREENSHOT_ATTEMPT',
    `📸 SCREENSHOT CAPTURE DETECTED: Team [${resolvedTeamName}] triggered screen capture (${triggerKey}) from ${ip} (Strike #${team?.strikes || 1})`,
    ip,
    resolvedTeamName,
    'high'
  );

  // Audit Log: Precise Timestamped Screenshot Interception
  recordAuditLog(
    'STUDENT',
    resolvedTeamName,
    'SCREENSHOT_INTERCEPTED',
    {
      triggerKey,
      details: alertDetails,
      strikeCount: team?.strikes || 1,
      teamId: resolvedTeamId,
    },
    ip
  );

  res.json({ success: true, recorded: true, strikes: team?.strikes || 1 });
});

// Admin endpoints for screenshot alerts feed
app.get('/api/admin/screenshots', requireAdminAuth, (_req: Request, res: Response) => {
  res.json(screenshotAlerts);
});

app.delete('/api/admin/screenshots/:id', requireAdminAuth, (req: Request, res: Response) => {
  const idx = screenshotAlerts.findIndex((a) => a.id === req.params.id);
  if (idx !== -1) {
    screenshotAlerts.splice(idx, 1);
  }
  screenshotStore.delete(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/screenshots', requireAdminAuth, (_req: Request, res: Response) => {
  screenshotAlerts.length = 0;
  screenshotStore.clearAll();
  res.json({ success: true });
});

// Explicit Opt-In: Team Readiness Gate
app.post('/api/team/ready', requireTeamAuth, async (req: Request, res: Response) => {
  const team: Team = (req as any).team;
  const ip = getClientIp(req);

  team.hasStarted = true;
  team.startedAt = Date.now();
  teamStore.update(team.id, {
    hasStarted: true,
    startedAt: team.startedAt,
  });
  io.emit('admin:team_updated', team);

  logSecurityEvent(
    'COMPETITION_STARTED',
    `Team [${team.teamName}] confirmed [ READY TO START ]. Security telemetry engaged.`,
    ip,
    team.teamName,
    'low'
  );

  recordUserActivity({
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'ready_started',
    teamName: team.teamName,
    message: `Team [${team.teamName}] confirmed READY TO START and launched their arena timer.`,
  });

  // Audit Log: Precise Timestamped READY_TO_START
  recordAuditLog(
    'STUDENT',
    team.teamName,
    'READY_TO_START',
    {
      teamId: team.id,
      teamName: team.teamName,
      startedAt: new Date(team.startedAt).toISOString(),
    },
    ip
  );

  res.json({
    success: true,
    hasStarted: true,
    startedAt: team.startedAt,
    message: 'Defense telemetry and competition timer initiated.',
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

// ======================== USER FEEDBACK ENDPOINTS ========================

// Submit feedback (7 questions)
app.post('/api/feedback', async (req: Request, res: Response) => {
  const ip = getClientIp(req);

  // Rate Limiting: Prevent feedback spam floods
  const rateResult = checkRateLimitTier('TEAM_AUTH', ip);
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', rateResult.resetSeconds);
    return res.status(429).json({ success: false, error: 'Feedback rate limit reached. Please wait a moment.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  let resolvedTeamId = 'anonymous';
  let resolvedTeamName = 'Participant';

  if (token) {
    const verified = verifySignedToken(token);
    if (verified.valid && verified.payload && verified.payload.role === 'team') {
      const t = teams.get(verified.payload.subjectId) || teamStore.getById(verified.payload.subjectId);
      if (t) {
        resolvedTeamId = t.id;
        resolvedTeamName = t.teamName;
      }
    }
  }

  // Allow custom teamName from body if provided
  if (req.body?.teamName && typeof req.body.teamName === 'string' && req.body.teamName.trim()) {
    resolvedTeamName = sanitizeInput(req.body.teamName.trim());
    if (resolvedTeamId === 'anonymous') {
      const matchId = teamNameLowerIndex.get(resolvedTeamName.toLowerCase());
      if (matchId) resolvedTeamId = matchId;
    }
  }

  // Enforce Single Feedback Rule: Multiple feedback submissions from a team are not allowed
  const existingFeedback = feedbackStore.getByTeam(resolvedTeamId, resolvedTeamName);
  if (existingFeedback) {
    return res.status(409).json({
      success: false,
      alreadySubmitted: true,
      error: `Feedback has already been submitted for Team ${existingFeedback.teamName}. Multiple feedback submissions from the same team are strictly restricted.`,
      feedback: existingFeedback,
    });
  }

  const {
    ratingUi,
    challengeDifficulty,
    platformStability,
    fairPlaySecurity,
    clarityRulesHints,
    favoriteHighlight,
    suggestionsRound3,
  } = req.body || {};

  const numRatingUi = Math.min(5, Math.max(1, parseInt(ratingUi, 10) || 5));
  const cleanDifficulty = sanitizeInput(challengeDifficulty || 'balanced');
  const numStability = Math.min(5, Math.max(1, parseInt(platformStability, 10) || 5));
  const cleanSecurity = sanitizeInput(fairPlaySecurity || 'seamless');
  const numClarity = Math.min(5, Math.max(1, parseInt(clarityRulesHints, 10) || 5));
  const cleanFavorite = sanitizeInput(favoriteHighlight || '').slice(0, 500);
  const cleanSuggestions = sanitizeInput(suggestionsRound3 || '').slice(0, 2000);

  const feedbackId = 'fb-' + crypto.randomUUID();
  const feedbackRecord: FeedbackSubmission = {
    id: feedbackId,
    teamId: resolvedTeamId,
    teamName: resolvedTeamName,
    ratingUi: numRatingUi,
    challengeDifficulty: cleanDifficulty,
    platformStability: numStability,
    fairPlaySecurity: cleanSecurity,
    clarityRulesHints: numClarity,
    favoriteHighlight: cleanFavorite,
    suggestionsRound3: cleanSuggestions,
    submittedAt: Date.now(),
  };

  feedbackStore.save(feedbackRecord);

  // Broadcast to admin dashboard
  io.emit('admin:feedback_received', feedbackRecord);

  recordAuditLog(
    'STUDENT',
    resolvedTeamName,
    'FEEDBACK_SUBMITTED',
    {
      teamId: resolvedTeamId,
      teamName: resolvedTeamName,
      ratingUi: numRatingUi,
      challengeDifficulty: cleanDifficulty,
      platformStability: numStability,
    },
    ip
  );

  res.json({
    success: true,
    message: `Thanks Team ${resolvedTeamName} for your valuable feedback!`,
    feedback: feedbackRecord,
  });
});

// Get team's existing feedback if any
app.get('/api/feedback/my', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.json({ feedback: null });

  const verified = verifySignedToken(token);
  if (!verified.valid || !verified.payload || verified.payload.role !== 'team') {
    return res.json({ feedback: null });
  }

  const existing = feedbackStore.getByTeamId(verified.payload.subjectId);
  res.json({ feedback: existing });
});

// Admin list all feedback
app.get('/api/admin/feedbacks', requireAdminAuth, (_req: Request, res: Response) => {
  const all = feedbackStore.getAll();
  res.json({ feedbacks: all });
});

// Admin delete individual feedback
app.delete('/api/admin/feedbacks/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = feedbackStore.deleteById(id);
  const ip = getClientIp(req);
  recordAuditLog('ADMIN', 'Admin', 'FEEDBACK_DELETED', { feedbackId: id, success: ok }, ip);
  res.json({
    success: ok,
    message: ok ? 'Feedback deleted successfully' : 'Failed to delete feedback entry',
  });
});

// Admin clear all feedbacks
app.post('/api/admin/feedbacks/clear', requireAdminAuth, (req: Request, res: Response) => {
  feedbackStore.clearAll();
  const ip = getClientIp(req);
  recordAuditLog('ADMIN', 'Admin', 'ALL_FEEDBACK_CLEARED', {}, ip);
  res.json({ success: true, message: 'All feedback submissions successfully purged.' });
});

app.delete('/api/admin/feedbacks', requireAdminAuth, (req: Request, res: Response) => {
  feedbackStore.clearAll();
  const ip = getClientIp(req);
  recordAuditLog('ADMIN', 'Admin', 'ALL_FEEDBACK_CLEARED', {}, ip);
  res.json({ success: true, message: 'All feedback submissions successfully purged.' });
});

// Admin export feedbacks in Excel format (UTF-8 BOM CSV)
app.get('/api/admin/export-feedbacks-excel', requireAdminAuth, (_req: Request, res: Response) => {
  const feedbacks = feedbackStore.getAll();
  const bom = '\uFEFF';
  const headers = [
    'Feedback ID',
    'Team Name',
    'Team ID',
    'Submission Date & Time',
    'UI / UX Rating (1-5)',
    'Challenge Difficulty',
    'Platform Stability (1-5)',
    'Fair Play & Security',
    'Rules & Hints Clarity (1-5)',
    'Favorite Challenge / Highlight',
    'Candid Suggestions for Round 3',
  ].join(',') + '\r\n';

  const esc = (s: any) => {
    if (s === null || s === undefined) return '""';
    const str = String(s).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = feedbacks
    .map((f) => {
      const dateStr = new Date(f.submittedAt).toISOString();
      return [
        esc(f.id),
        esc(f.teamName),
        esc(f.teamId),
        esc(dateStr),
        f.ratingUi,
        esc(f.challengeDifficulty),
        f.platformStability,
        esc(f.fairPlaySecurity),
        f.clarityRulesHints,
        esc(f.favoriteHighlight),
        esc(f.suggestionsRound3),
      ].join(',');
    })
    .join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="ctf_feedback_export_${Date.now()}.csv"`
  );
  res.send(bom + headers + rows);
});

// Record student post-event final dashboard view
app.post('/api/post-event/viewed', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const token = req.headers.authorization?.replace('Bearer ', '');
  let resolvedTeamName = 'Participant';
  let resolvedTeamId = 'anonymous';

  if (token) {
    const verified = verifySignedToken(token);
    if (verified.valid && verified.payload && verified.payload.role === 'team') {
      const t = teams.get(verified.payload.subjectId) || teamStore.getById(verified.payload.subjectId);
      if (t) {
        resolvedTeamId = t.id;
        resolvedTeamName = t.teamName;
      }
    }
  }

  recordAuditLog(
    'STUDENT',
    resolvedTeamName,
    'POST_EVENT_VIEWED',
    { teamId: resolvedTeamId, teamName: resolvedTeamName },
    ip
  );

  res.json({ success: true });
});

// ======================== ADMIN ENDPOINTS ========================

// Timer Controls - Full Admin Authority (Start, Stop/Pause, Restart, Set, Adjust)
app.post('/api/admin/timer', requireAdminAuth, (req: Request, res: Response) => {
  const { action, seconds } = req.body;
  const ip = getClientIp(req);

  if (action === 'start' || action === 'resume') {
    competitionState.status = 'running';
    if (competitionState.remainingSeconds <= 0) {
      competitionState.remainingSeconds = typeof seconds === 'number' && seconds > 0 ? Math.floor(seconds) : (competitionState.durationSeconds || 7200);
    }
    competitionState.writeupMode = false;

    const event: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'announcement',
      teamName: 'ADMIN',
      message: 'Competition countdown started / resumed by Admin. Submissions are active.',
    };
    recordUserActivity(event);

    recordAuditLog(
      'ADMIN',
      'ADMIN_CONSOLE',
      action === 'start' ? 'ADMIN_TIMER_START' : 'ADMIN_TIMER_RESUME',
      {
        action,
        remainingSeconds: competitionState.remainingSeconds,
        durationSeconds: competitionState.durationSeconds,
      },
      ip
    );
  } else if (action === 'pause' || action === 'stop') {
    competitionState.status = 'paused';

    const event: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'announcement',
      teamName: 'ADMIN',
      message: 'Competition countdown stopped by Admin. Submissions are temporarily held.',
    };
    recordUserActivity(event);

    recordAuditLog(
      'ADMIN',
      'ADMIN_CONSOLE',
      'ADMIN_TIMER_PAUSE',
      {
        action,
        remainingSeconds: competitionState.remainingSeconds,
      },
      ip
    );
  } else if (action === 'reset') {
    const resetSec = typeof seconds === 'number' && seconds > 0 ? Math.floor(seconds) : 7200;
    competitionState.status = 'paused';
    competitionState.remainingSeconds = resetSec;
    competitionState.durationSeconds = resetSec;
    competitionState.writeupMode = false;

    const event: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'announcement',
      teamName: 'ADMIN',
      message: `Competition countdown timer reset to 02:00:00 by Admin. Submissions are held.`,
    };
    recordUserActivity(event);

    recordAuditLog(
      'ADMIN',
      'ADMIN_CONSOLE',
      'ADMIN_TIMER_RESET',
      {
        action: 'reset',
        resetSeconds: resetSec,
        remainingSeconds: competitionState.remainingSeconds,
      },
      ip
    );
  } else if (action === 'restart') {
    const restartSec = typeof seconds === 'number' && seconds > 0 ? Math.floor(seconds) : (competitionState.durationSeconds || 7200);
    competitionState.status = 'running';
    competitionState.remainingSeconds = restartSec;
    competitionState.durationSeconds = restartSec;
    competitionState.writeupMode = false;

    const event: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'announcement',
      teamName: 'ADMIN',
      message: `Competition countdown timer restarted by Admin (${Math.round(restartSec / 60)} minutes remaining). Submissions are open.`,
    };
    recordUserActivity(event);

    recordAuditLog(
      'ADMIN',
      'ADMIN_CONSOLE',
      'ADMIN_TIMER_RESTART',
      {
        action: 'restart',
        restartSeconds: restartSec,
        remainingSeconds: competitionState.remainingSeconds,
      },
      ip
    );
  } else if (action === 'set' && typeof seconds === 'number') {
    competitionState.remainingSeconds = Math.max(0, Math.floor(seconds));
    if (competitionState.remainingSeconds > 0 && competitionState.status === 'ended') {
      competitionState.status = 'paused';
    }

    recordAuditLog(
      'ADMIN',
      'ADMIN_CONSOLE',
      'ADMIN_TIMER_SET',
      {
        action: 'set',
        seconds,
        remainingSeconds: competitionState.remainingSeconds,
      },
      ip
    );
  } else if (action === 'add' && typeof seconds === 'number') {
    competitionState.remainingSeconds = Math.max(0, competitionState.remainingSeconds + Math.floor(seconds));
    recordAuditLog(
      'ADMIN',
      'ADMIN_CONSOLE',
      'ADMIN_TIMER_SET',
      {
        action: 'add',
        seconds,
        remainingSeconds: competitionState.remainingSeconds,
      },
      ip
    );
  } else if (action === 'subtract' && typeof seconds === 'number') {
    competitionState.remainingSeconds = Math.max(0, competitionState.remainingSeconds - Math.floor(seconds));
    recordAuditLog(
      'ADMIN',
      'ADMIN_CONSOLE',
      'ADMIN_TIMER_SUBTRACT',
      {
        action: 'subtract',
        seconds,
        remainingSeconds: competitionState.remainingSeconds,
      },
      ip
    );
  } else if (action === 'end' || action === 'finish') {
    competitionState.status = 'ended';
    competitionState.remainingSeconds = 0;
    competitionStateStore.saveState(competitionState);

    // Auto-finalize points and standings for all participants with zero bias
    invalidateLeaderboardCache();
    const finalStandings = getSortedLeaderboard();
    leaderboardStore.syncLeaderboard(finalStandings);
    teamStore.flushToDisk();
    const top3 = finalStandings.slice(0, 3);

    const alertEvent: ActivityFeedEvent = {
      id: 'act-' + crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'announcement',
      teamName: 'ADMIN',
      message: 'COMPETITION OFFICIALLY ENDED BY ADMIN! All challenge submissions locked. Final standings verified.',
    };
    recordUserActivity(alertEvent);

    recordAuditLog(
      'ADMIN',
      'ADMIN_CONSOLE',
      'ADMIN_COMPETITION_END',
      {
        action: 'end_competition',
        finalTeamsCount: finalStandings.length,
        top3: top3.map((t) => ({ rank: t.rank, teamName: t.teamName, score: t.score })),
      },
      ip
    );

    // Broadcast completion and top 3 winners podium to all participant screens
    io.emit('competition_ended', { top3, finalStandings });
    broadcastLeaderboard();
  }

  // Persist updated timer state to SQLite
  competitionStateStore.saveState(competitionState);
  resetTriggeredMilestonesFor(competitionState.remainingSeconds);

  io.emit('timer_tick', {
    status: competitionState.status,
    remainingSeconds: competitionState.remainingSeconds,
    writeupMode: competitionState.writeupMode,
    serverTime: Date.now(),
  });

  broadcastState();

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
    autoDismissSeconds: 60,
  };

  competitionState.announcement = announcement;
  competitionStateStore.saveState(competitionState); // Persist to SQLite

  const event: ActivityFeedEvent = {
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'announcement',
    teamName: 'ADMIN HQ',
    message: `[HQ ANNOUNCEMENT] ${announcement.title}: ${announcement.message}`,
  };
  recordUserActivity(event);
  io.emit('announcement_broadcast', announcement);

  // Auto-dismiss broadcast after 60 seconds (1 minute max visibility)
  if (autoDismissAnnouncementTimer) clearTimeout(autoDismissAnnouncementTimer);
  autoDismissAnnouncementTimer = setTimeout(() => {
    if (competitionState.announcement?.id === announcement.id) {
      competitionState.announcement = null;
      competitionStateStore.saveState(competitionState);
      io.emit('announcement_cleared');
    }
  }, 60000);

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'BROADCAST_SENT',
    {
      announcementId: announcement.id,
      title: announcement.title,
      message: announcement.message,
    },
    getClientIp(req)
  );

  res.json({ success: true, announcement });
});

// Clear Announcement
app.delete('/api/admin/announcement', requireAdminAuth, (req: Request, res: Response) => {
  if (autoDismissAnnouncementTimer) {
    clearTimeout(autoDismissAnnouncementTimer);
    autoDismissAnnouncementTimer = null;
  }
  competitionState.announcement = null;
  competitionStateStore.saveState(competitionState); // Persist to SQLite
  io.emit('announcement_cleared');
  res.json({ success: true });
});

// Admin Adjust Global Matrix Rain Speed
app.post('/api/admin/matrix-speed', requireAdminAuth, (req: Request, res: Response) => {
  const rawSpeed = parseFloat(req.body.speed);
  const speed = !isNaN(rawSpeed) ? Math.max(0.2, Math.min(4.0, rawSpeed)) : 1.0;

  competitionState.matrixRainSpeed = speed;
  competitionStateStore.saveState(competitionState);

  io.emit('matrix_speed_updated', { speed });
  broadcastState();

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'SYSTEM_INFO',
    {
      action: 'matrix_rain_speed_adjusted',
      speed,
    },
    getClientIp(req)
  );

  res.json({ success: true, speed, state: competitionState });
});

// Writeup Mode Toggle
app.post('/api/admin/writeup-mode', requireAdminAuth, (req: Request, res: Response) => {
  const { enabled } = req.body;
  competitionState.writeupMode = Boolean(enabled);
  competitionStateStore.saveState(competitionState); // Persist to SQLite
  redisCache.invalidate('cache:state');
  redisCache.invalidate('cache:state:public');
  broadcastState();
  io.emit('writeup_mode_changed', { writeupMode: competitionState.writeupMode });
  res.json({ success: true, writeupMode: competitionState.writeupMode });
});

// Submissions Inspection API for Admin
app.get('/api/admin/submissions', requireAdminAuth, (_req: Request, res: Response) => {
  const subs = submissionStore.getRecent(200);
  res.json({ success: true, count: subs.length, submissions: subs });
});

// Evaluated Leaderboard Direct Query API (Reads from SQLite leaderboard table)
app.get('/api/scoreboard', (_req: Request, res: Response) => {
  const standings = leaderboardStore.getLeaderboard();
  res.json({
    success: true,
    count: standings.length,
    timestamp: Date.now(),
    leaderboard: standings.length > 0 ? standings : getSortedLeaderboard(),
  });
});

// Leaderboard Snapshot History for Admin Auditing
app.get('/api/admin/leaderboard/snapshots', requireAdminAuth, (_req: Request, res: Response) => {
  const snapshots = leaderboardStore.getSnapshots(20);
  res.json({ success: true, count: snapshots.length, snapshots });
});

// Competition Reset Option: Complete system wipe for fresh tournament
app.post('/api/admin/reset', requireAdminAuth, async (req: Request, res: Response) => {
  // 1. Wipe all teams from memory, SQLite database, and disk backup
  teams.clear();
  teamStore.clearAll();

  // 2. Wipe user activities
  activityFeed = [];
  activityFeedStore.clearAll();

  // 3. Wipe screenshots from memory and SQLite
  screenshotAlerts.length = 0;
  screenshotStore.clearAll();

  // 4. Wipe security logs & challenge submissions
  securityLogs = [];
  securityLogStore.clearAll();
  submissionStore.clearAll();

  // 5. Wipe system-wide audit logs & trails
  auditLogStore.clearAll();

  // 6. Wipe user feedbacks
  feedbackStore.clearAll();

  // 7. Wipe leaderboard snapshots
  leaderboardStore.clearAll();

  // 7. Reset challenge solve stats in memory and SQLite
  challenges.forEach((c) => {
    c.solvesCount = 0;
    c.firstBloodTeam = null;
    challengeStore.update(c.id, { solvesCount: 0, firstBloodTeam: null });
  });

  // 8. Reset competition timer and state
  competitionState.status = 'running';
  competitionState.remainingSeconds = competitionState.durationSeconds;
  competitionState.writeupMode = false;
  competitionState.announcement = null;
  competitionStateStore.saveState(competitionState);

  // 9. Invalidate Redis caches and notify all connected clients
  await redisCache.invalidate('cache:');
  io.emit('competition_reset');
  io.emit('leaderboard_update', []);
  io.emit('activity_event', {
    id: 'act-' + crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'competition_reset',
    message: 'Competition reset by Administrator. All teams, activities, and scores cleared for a fresh tournament.',
  });
  broadcastLeaderboard();
  broadcastState();

  res.json({
    success: true,
    message: 'All teams, user activities, screenshots, audit trails, submissions, logs, and CSV data have been completely wiped.',
  });
});

// Admin Challenge CRUD
app.get('/api/admin/challenges', requireAdminAuth, (req: Request, res: Response) => {
  res.json(challenges);
});

// 2.) Admin Challenge Creation with Zod & SQLite Persistence
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
    points: data.points, // Evaluated exactly as admin specifies
    difficulty: data.difficulty,
    description: sanitizeInput(data.description),
    flag: data.flag.trim(),
    flagFormat: data.flagFormat || 'CTF{...}',
    maxAttempts: data.maxAttempts || 5,
    attachment: data.attachment || req.body.attachment || undefined,
    hints: Array.isArray(req.body.hints)
      ? req.body.hints.map((h: any, idx: number) => ({
          id: h.id || `hint-${Date.now()}-${idx + 1}`,
          title: sanitizeInput(h.title || `Hint #${idx + 1}`),
          cost: Math.max(0, Number(h.cost || 0)),
          content: sanitizeInput(h.content || ''),
        }))
      : [],
    writeup: req.body.writeup || { summary: '', steps: [] },
    isEnabled: true,
    solvesCount: 0,
    firstBloodTeam: null,
  };

  challengeStore.create(newChallenge);
  challenges.push(newChallenge);
  challengeMap.set(newChallenge.id, newChallenge);
  broadcastState();

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'ADMIN_CHALLENGE_CREATE',
    {
      challengeId: newChallenge.id,
      title: newChallenge.title,
      points: newChallenge.points,
      category: newChallenge.category,
    },
    getClientIp(req)
  );

  res.json({ success: true, challenge: newChallenge });
});

app.put('/api/admin/challenges/:id', requireAdminAuth, (req: Request, res: Response) => {
  const chal = challenges.find((c) => c.id === req.params.id);
  if (!chal) return res.status(404).json({ success: false, error: 'Challenge not found' });

  const { title, section, category, points, difficulty, description, flag, maxAttempts, isEnabled, hints, writeup, attachment } = req.body;
  if (title) chal.title = sanitizeInput(title);
  if (section) chal.section = section;
  if (category) chal.category = category;
  if (typeof points === 'number') chal.points = Math.max(1, Math.floor(points)); // Evaluated as admin says
  if (difficulty) chal.difficulty = difficulty;
  if (description) chal.description = sanitizeInput(description);
  if (flag) chal.flag = flag.trim();
  if (typeof maxAttempts === 'number') chal.maxAttempts = Math.max(1, Math.min(100, maxAttempts));
  if (typeof isEnabled === 'boolean') chal.isEnabled = isEnabled;
  if (attachment !== undefined) chal.attachment = attachment;
  if (Array.isArray(hints)) {
    chal.hints = hints.map((h: any, idx: number) => ({
      id: h.id || `hint-${Date.now()}-${idx + 1}`,
      title: sanitizeInput(h.title || `Hint #${idx + 1}`),
      cost: Math.max(0, Number(h.cost || 0)),
      content: sanitizeInput(h.content || ''),
    }));
  }
  if (writeup) chal.writeup = writeup;

  challengeStore.update(chal.id, chal);
  challengeMap.set(chal.id, chal);
  broadcastState();

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'ADMIN_CHALLENGE_UPDATE',
    {
      challengeId: chal.id,
      title: chal.title,
      points: chal.points,
    },
    getClientIp(req)
  );

  res.json({ success: true, challenge: chal });
});

app.delete('/api/admin/challenges/:id', requireAdminAuth, (req: Request, res: Response) => {
  const idx = challenges.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Challenge not found' });

  const [removed] = challenges.splice(idx, 1);
  challengeMap.delete(removed.id);
  challengeStore.delete(removed.id);
  broadcastState();

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'ADMIN_CHALLENGE_DELETE',
    {
      challengeId: removed.id,
      title: removed.title,
    },
    getClientIp(req)
  );

  res.json({ success: true });
});

// Sync challenges from questions.json into memory and SQLite
app.post('/api/admin/challenges/sync-questions', requireAdminAuth, (_req: Request, res: Response) => {
  const count = challengeStore.syncFromQuestionsJson(path.join(__dirname, 'questions.json'));
  challenges = challengeStore.getAll();
  challengeMap.clear();
  for (const chal of challenges) {
    challengeMap.set(chal.id, chal);
  }
  broadcastState();
  res.json({ success: true, syncedCount: count, totalChallenges: challenges.length });
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

  challengeStore.update(chal.id, { attachment: chal.attachment });
  broadcastState();
  res.json({ success: true, attachment: { fileName: cleanFilename, size: sizeKb } });
});

// Admin Team Management - Compulsory Persistent Roster Sync
app.get('/api/admin/teams', requireAdminAuth, (_req: Request, res: Response) => {
  res.json(teamStore.getAll());
});

// 2.) Admin Score Adjust with Zod
app.post('/api/admin/teams/:id/adjust-score', requireAdminAuth, (req: Request, res: Response) => {
  const team = teams.get(req.params.id) || teamStore.getById(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  const validation = ScoreAdjustSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: validation.error.issues[0]?.message });
  }

  const { delta, reason } = validation.data;
  team.score += delta;
  teams.set(team.id, team);
  teamStore.update(team.id, { score: team.score });
  redisCache.zadd('ctf:leaderboard:zset', team.score, team.id).catch(() => {});

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
  io.emit('admin:team_updated', team);

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'ADMIN_SCORE_ADJUST',
    {
      targetTeam: team.teamName,
      targetTeamId: team.id,
      delta,
      reason: sanitizeInput(reason),
      newScore: team.score,
    },
    getClientIp(req)
  );

  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, team });
});

app.post('/api/admin/teams/:id/unlock-challenge', requireAdminAuth, (req: Request, res: Response) => {
  const team = teams.get(req.params.id) || teamStore.getById(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  const { challengeId } = req.body;
  team.failedAttempts[challengeId] = 0; // reset attempts
  teams.set(team.id, team);
  teamStore.update(team.id, { failedAttempts: team.failedAttempts });
  io.emit('admin:team_updated', team);

  broadcastState();
  res.json({ success: true, message: `Challenge unlocked for team ${team.teamName}` });
});

app.post('/api/admin/teams/:id/clear-anomaly', requireAdminAuth, (req: Request, res: Response) => {
  const team = teams.get(req.params.id) || teamStore.getById(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  team.isFlaggedAnomaly = false;
  team.anomalyReason = undefined;
  teams.set(team.id, team);
  teamStore.update(team.id, { isFlaggedAnomaly: false, anomalyReason: undefined });
  io.emit('admin:team_updated', team);

  broadcastLeaderboard();
  res.json({ success: true });
});

// Admin Clear Strikes For ALL Teams
app.post('/api/admin/teams/clear-all-strikes', requireAdminAuth, async (req: Request, res: Response) => {
  const allTeams = Array.from(teams.values());
  let count = 0;
  for (const team of allTeams) {
    if (team.strikes > 0 || team.isDisqualified) {
      team.strikes = 0;
      team.isDisqualified = false;
      team.disqualifiedReason = undefined;
      team.disqualifiedAt = undefined;
      teams.set(team.id, team);
      teamStore.update(team.id, {
        strikes: 0,
        isDisqualified: false,
        disqualifiedReason: undefined,
        disqualifiedAt: undefined,
      });
      io.emit('admin:team_updated', team);
      io.emit('team:updated', team);
      io.emit('team:strikes_reset', { teamId: team.id });
      count++;
    }
  }

  logSecurityEvent('SECURITY_STRIKE', `Admin arbitration cleared strikes for ALL teams (${count} updated)`, getClientIp(req), 'ALL_TEAMS', 'low');

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'ADMIN_CLEAR_ALL_STRIKES',
    { updatedCount: count },
    getClientIp(req)
  );

  await redisCache.invalidate('cache:');
  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, message: `Successfully reset strikes for all teams (${count} updated).`, updatedCount: count });
});

// Admin Strike Clear / Reinstate
app.post('/api/admin/teams/:id/clear-strikes', requireAdminAuth, async (req: Request, res: Response) => {
  const team = teams.get(req.params.id) || teamStore.getById(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  team.strikes = 0;
  team.isDisqualified = false;
  team.disqualifiedReason = undefined;
  team.disqualifiedAt = undefined;
  teams.set(team.id, team);
  teamStore.update(team.id, {
    strikes: 0,
    isDisqualified: false,
    disqualifiedReason: undefined,
    disqualifiedAt: undefined,
  });
  io.emit('admin:team_updated', team);
  io.emit('team:updated', team);
  io.emit('team:strikes_reset', { teamId: team.id });

  logSecurityEvent('SECURITY_STRIKE', `Admin arbitration cleared strikes and reinstated team [${team.teamName}]`, getClientIp(req), team.teamName, 'low');

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'REINSTATE_TEAM',
    {
      targetTeam: team.teamName,
      targetTeamId: team.id,
      action: 'reinstated_cleared_strikes',
    },
    getClientIp(req)
  );

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'ADMIN_CLEAR_STRIKES',
    {
      targetTeam: team.teamName,
      targetTeamId: team.id,
    },
    getClientIp(req)
  );

  await redisCache.invalidate('cache:');
  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, message: `Strikes reset for team ${team.teamName}`, team });
});

// Admin Reset Team Ready / Start Status (Return team to Pre-Competition "START COMPETITION" page)
app.post('/api/admin/teams/:id/reset-ready', requireAdminAuth, async (req: Request, res: Response) => {
  const team = teams.get(req.params.id) || teamStore.getById(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  team.hasStarted = false;
  team.startedAt = undefined;
  teams.set(team.id, team);
  teamStore.update(team.id, {
    hasStarted: false,
    startedAt: undefined,
  });
  io.emit('admin:team_updated', team);
  io.emit('team:reset_ready', { teamId: team.id });

  logSecurityEvent('COMPETITION_STARTED', `Admin reset ready/start status for team [${team.teamName}] (returned to gate)`, getClientIp(req), team.teamName, 'low');
  await redisCache.invalidate('cache:');
  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, message: `Ready status reset for team ${team.teamName}. Returned to start gate.`, team });
});

// Admin Reset ALL Teams Ready / Start Status back to Pre-Competition Start Gate
app.post('/api/admin/teams/reset-all-ready', requireAdminAuth, async (req: Request, res: Response) => {
  const allTeams = teamStore.getAll();
  for (const t of allTeams) {
    t.hasStarted = false;
    t.startedAt = undefined;
    teams.set(t.id, t);
    teamStore.update(t.id, {
      hasStarted: false,
      startedAt: undefined,
    });
    io.emit('team:reset_ready', { teamId: t.id });
  }

  logSecurityEvent('COMPETITION_STARTED', `Admin reset ready/start status for ALL teams (returned to gate)`, getClientIp(req), undefined, 'low');
  await redisCache.invalidate('cache:');
  broadcastLeaderboard();
  broadcastState();

  res.json({ success: true, message: 'All squads reset back to Pre-Competition Gate.' });
});

// Admin Manual Disqualify (Strict 10-Strike Cap)
app.post('/api/admin/teams/:id/disqualify', requireAdminAuth, async (req: Request, res: Response) => {
  const team = teams.get(req.params.id) || teamStore.getById(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

  const customReason =
    (typeof req.body?.reason === 'string' && req.body.reason.trim())
      ? req.body.reason.trim()
      : 'Manual Disqualification by Competition Arbitration';

  team.strikes = 10;
  team.isDisqualified = true;
  team.disqualifiedAt = Date.now();
  team.disqualifiedReason = customReason;
  teams.set(team.id, team);
  teamStore.update(team.id, {
    strikes: 10,
    isDisqualified: true,
    disqualifiedAt: team.disqualifiedAt,
    disqualifiedReason: team.disqualifiedReason,
  });
  io.emit('admin:team_updated', team);

  logSecurityEvent('TEAM_DISQUALIFIED', `Team [${team.teamName}] manually DISQUALIFIED by Admin Arbitration. Reason: ${customReason}`, getClientIp(req), team.teamName, 'high');

  recordAuditLog(
    'ADMIN',
    'ADMIN_CONSOLE',
    'ADMIN_DISQUALIFY_TEAM',
    {
      targetTeam: team.teamName,
      targetTeamId: team.id,
      reason: team.disqualifiedReason,
    },
    getClientIp(req)
  );

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

// Admin Security Logs & Activities
app.get('/api/admin/logs', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({
    securityLogs,
    activityFeed: activityFeedStore.getRecent(250),
  });
});

// Admin Purge Security Incident Logs
app.post('/api/admin/logs/clear', requireAdminAuth, (req: Request, res: Response) => {
  securityLogs.length = 0;
  securityLogStore.clearAll();
  recordAuditLog('ADMIN', 'ADMIN_CONSOLE', 'SYSTEM_INFO', { action: 'Security incident logs purged by admin' }, getClientIp(req));
  io.emit('security_logs_cleared');
  res.json({ success: true, message: 'Security incident logs successfully cleared.' });
});

// Admin Dedicated Timestamped Audit Logs API
app.get('/api/admin/audit-logs', requireAdminAuth, (req: Request, res: Response) => {
  const limit = Math.min(2000, Math.max(10, parseInt(req.query.limit as string, 10) || 300));
  const actor = req.query.actor as string;
  const logs = actor ? auditLogStore.getByActor(actor, limit) : auditLogStore.getAll(limit);
  res.json({
    success: true,
    count: logs.length,
    total: auditLogStore.count(),
    logs,
  });
});

// Advanced Admin CSV Export Feature: System-Wide Timestamped Audit Trail
app.get(['/api/admin/export-audit-csv', '/api/admin/export-audit-logs-csv'], requireAdminAuth, (_req: Request, res: Response) => {
  const csv = auditLogStore.exportCsv(10000);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="the_final_decrypt_audit_trail_utc.csv"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(csv);
});

// Export Scores to CSV with Secure Sanitization
app.get(['/api/admin/export-csv', '/api/admin/export-scoreboard-csv'], requireAdminAuth, (_req: Request, res: Response) => {
  const leaderboard = getSortedLeaderboard();
  let csv = 'Rank,Team Name,Email,Score,Solves,Total Failed Attempts,Last Solve Time,Members,Anomaly Flagged\n';

  leaderboard.forEach((entry) => {
    const teamObj = teamStore.getById(entry.teamId);
    const emailStr = (teamObj?.email || '').replace(/"/g, '""');
    const membersStr = entry.members.join('; ').replace(/"/g, '""');
    const lastSolveDate = entry.lastSolveTime ? new Date(entry.lastSolveTime).toISOString() : 'N/A';
    csv += `${entry.rank},"${entry.teamName}","${emailStr}",${entry.score},${entry.solvesCount},${entry.totalFailedAttempts},"${lastSolveDate}","${membersStr}",${entry.isFlaggedAnomaly}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="the_final_decrypt_scoreboard.csv"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(csv);
});

// ======================== 6.) CENTRALIZED ERROR HANDLER ========================
// Catches all uncaught errors without leaking stack traces or internals to clients
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const ip = getClientIp(req);

  // Gracefully handle malformed client JSON payloads as 400 Bad Request without logging SYSTEM_ERROR
  if (err instanceof SyntaxError && (('status' in err && (err as any).status === 400) || 'body' in err)) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload in request body.',
    });
  }

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
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data/**',
            '**/*.sqlite*',
            '**/*.sqlite-journal*',
            '**/dist/**',
            '**/*.tmp*',
          ],
        },
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
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

// Graceful shutdown: flush in-memory SQLite store to persistent disk
process.on('SIGINT', () => {
  console.log('[CTF Server] Gracefully shutting down, flushing SQLite database to disk...');
  teamStore.flushToDisk();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[CTF Server] Gracefully shutting down, flushing SQLite database to disk...');
  teamStore.flushToDisk();
  process.exit(0);
});

startServer();
