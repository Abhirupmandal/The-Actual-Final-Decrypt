import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import crypto from 'crypto';
import type {
  Team,
  Challenge,
  ChallengeSection,
  ChallengeCategory,
  ScreenshotAlert,
  SecurityLog,
  ActivityFeedEvent,
  CompetitionState,
  SubmissionRecord,
  LeaderboardEntry,
  AuditLog,
  AuditActorType,
  AuditActionType,
  FeedbackSubmission,
} from '../types.ts';
import { postgresSync } from './postgresSync.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root project directory for persistent storage
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'ctf_database.sqlite');
const TEAMS_JSON_FILE = path.join(DATA_DIR, 'teams.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite WebAssembly Engine
const SQL = await initSqlJs();

class SqliteTeamStore {
  private db: SqlJsDatabase;
  private teams: Map<string, Team> = new Map();
  private nameIndex: Map<string, string> = new Map(); // lowercase name -> id
  private emailIndex: Map<string, string> = new Map(); // lowercase email -> id
  private syncTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // 1. Initialize SQLite Database from file or create fresh
    if (fs.existsSync(SQLITE_FILE)) {
      try {
        const fileBuffer = fs.readFileSync(SQLITE_FILE);
        this.db = new SQL.Database(fileBuffer);
        console.log(`[SQLite Database] Successfully opened existing SQLite database from ${SQLITE_FILE}`);
      } catch (err) {
        console.error('[SQLite Database] Error opening existing SQLite file, creating fresh DB:', err);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
      console.log(`[SQLite Database] Initialized new SQLite database at ${SQLITE_FILE}`);
    }

    // 2. Ensure schema exists & migrate
    this.initSchema();

    // 3. Load teams from SQLite or migrate from teams.json if fresh
    this.loadFromSqlite();
  }

  /**
   * Initialize SQLite schema with tables, indexes, and constraints
   */
  private initSchema(): void {
    // 1. Ensure base table exists
    this.db.run(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        team_name TEXT UNIQUE NOT NULL,
        email TEXT,
        password_hash TEXT,
        password_salt TEXT,
        members TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        solves TEXT NOT NULL DEFAULT '{}',
        hints_unlocked TEXT NOT NULL DEFAULT '{}',
        failed_attempts TEXT NOT NULL DEFAULT '{}',
        total_failed_attempts INTEGER NOT NULL DEFAULT 0,
        last_solve_time INTEGER NOT NULL DEFAULT 0,
        registered_at INTEGER NOT NULL,
        ip TEXT NOT NULL,
        strikes INTEGER NOT NULL DEFAULT 0,
        is_disqualified INTEGER NOT NULL DEFAULT 0,
        disqualified_reason TEXT,
        disqualified_at INTEGER,
        is_flagged_anomaly INTEGER NOT NULL DEFAULT 0,
        anomaly_reason TEXT,
        has_started INTEGER NOT NULL DEFAULT 0,
        started_at INTEGER
      );
    `);

    // 2. Gracefully migrate existing SQLite DB files lacking the email column
    try {
      this.db.run(`ALTER TABLE teams ADD COLUMN email TEXT;`);
    } catch {
      // Column already exists or table was created with it, safe to ignore
    }

    // 3. Create indexes now that all columns are guaranteed to exist
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(team_name);
      CREATE INDEX IF NOT EXISTS idx_teams_email ON teams(email);
      CREATE INDEX IF NOT EXISTS idx_teams_score ON teams(score DESC);
      CREATE INDEX IF NOT EXISTS idx_teams_strikes ON teams(strikes DESC);
    `);
  }

  /**
   * Convert SQLite row object to typed Team
   */
  private rowToTeam(row: any): Team {
    return {
      id: String(row.id),
      teamName: String(row.team_name),
      email: row.email ? String(row.email) : undefined,
      passwordHash: row.password_hash ? String(row.password_hash) : undefined,
      passwordSalt: row.password_salt ? String(row.password_salt) : undefined,
      members: JSON.parse(String(row.members || '[]')),
      score: Number(row.score || 0),
      solves: JSON.parse(String(row.solves || '{}')),
      hintsUnlocked: JSON.parse(String(row.hints_unlocked || '{}')),
      failedAttempts: JSON.parse(String(row.failed_attempts || '{}')),
      totalFailedAttempts: Number(row.total_failed_attempts || 0),
      lastSolveTime: Number(row.last_solve_time || 0),
      registeredAt: Number(row.registered_at || 0),
      ip: String(row.ip || '127.0.0.1'),
      strikes: Number(row.strikes || 0),
      isDisqualified: Boolean(row.is_disqualified),
      disqualifiedReason: row.disqualified_reason ? String(row.disqualified_reason) : undefined,
      disqualifiedAt: row.disqualified_at ? Number(row.disqualified_at) : undefined,
      isFlaggedAnomaly: Boolean(row.is_flagged_anomaly),
      anomalyReason: row.anomaly_reason ? String(row.anomaly_reason) : undefined,
      hasStarted: Boolean(row.has_started),
      startedAt: row.started_at ? Number(row.started_at) : undefined,
    };
  }

  /**
   * Load existing teams from SQLite into in-memory index
   */
  private loadFromSqlite(): void {
    try {
      const res = this.db.exec('SELECT * FROM teams');
      if (res.length > 0 && res[0].values.length > 0) {
        const columns = res[0].columns;
        res[0].values.forEach((rowValues) => {
          const rowObj: any = {};
          columns.forEach((col, idx) => {
            rowObj[col] = rowValues[idx];
          });
          const team = this.rowToTeam(rowObj);
          this.teams.set(team.id, team);
          this.nameIndex.set(team.teamName.toLowerCase().trim(), team.id);
          if (team.email) {
            this.emailIndex.set(team.email.toLowerCase().trim(), team.id);
          }
        });
        console.log(`[SQLite Database] Loaded ${this.teams.size} persistent teams from SQLite database`);
      } else if (fs.existsSync(TEAMS_JSON_FILE)) {
        // Automatic one-time migration from legacy teams.json to SQLite
        try {
          const raw = fs.readFileSync(TEAMS_JSON_FILE, 'utf-8');
          const legacyTeams: Team[] = JSON.parse(raw);
          if (Array.isArray(legacyTeams) && legacyTeams.length > 0) {
            console.log(`[SQLite Database] Migrating ${legacyTeams.length} teams from teams.json to SQLite...`);
            legacyTeams.forEach((t) => {
              this.insertOrUpdateSqlite(t);
              this.teams.set(t.id, t);
              this.nameIndex.set(t.teamName.toLowerCase().trim(), t.id);
            });
            this.syncToDisk();
            console.log(`[SQLite Database] Migration complete: ${this.teams.size} teams synced into SQLite`);
          }
        } catch (migErr) {
          console.warn('[SQLite Database] Legacy teams.json migration skipped:', migErr);
        }
      }
    } catch (err) {
      console.error('[SQLite Database] Failed to load teams from SQLite:', err);
    }
  }

  /**
   * Execute prepared INSERT OR REPLACE query into SQLite
   */
  private insertOrUpdateSqlite(team: Team): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO teams (
        id, team_name, email, password_hash, password_salt, members, score, solves,
        hints_unlocked, failed_attempts, total_failed_attempts, last_solve_time,
        registered_at, ip, strikes, is_disqualified, disqualified_reason,
        disqualified_at, is_flagged_anomaly, anomaly_reason, has_started, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    stmt.run([
      team.id,
      team.teamName,
      team.email || null,
      team.passwordHash || null,
      team.passwordSalt || null,
      JSON.stringify(team.members || []),
      team.score || 0,
      JSON.stringify(team.solves || {}),
      JSON.stringify(team.hintsUnlocked || {}),
      JSON.stringify(team.failedAttempts || {}),
      team.totalFailedAttempts || 0,
      team.lastSolveTime || 0,
      team.registeredAt || Date.now(),
      team.ip || '127.0.0.1',
      team.strikes || 0,
      team.isDisqualified ? 1 : 0,
      team.disqualifiedReason || null,
      team.disqualifiedAt || null,
      team.isFlaggedAnomaly ? 1 : 0,
      team.anomalyReason || null,
      team.hasStarted ? 1 : 0,
      team.startedAt || null,
    ]);

    stmt.free();

    if (postgresSync.isEnabled()) {
      postgresSync.saveTeam(team);
    }
  }

  /**
   * Insert team loaded from remote cloud PostgreSQL
   */
  public upsertFromPostgres(team: Team): void {
    this.teams.set(team.id, team);
    this.nameIndex.set(team.teamName.toLowerCase().trim(), team.id);
    if (team.email) {
      this.emailIndex.set(team.email.toLowerCase().trim(), team.id);
    }
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO teams (
        id, team_name, email, password_hash, password_salt, members, score, solves,
        hints_unlocked, failed_attempts, total_failed_attempts, last_solve_time,
        registered_at, ip, strikes, is_disqualified, disqualified_reason,
        disqualified_at, is_flagged_anomaly, anomaly_reason, has_started, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);
    stmt.run([
      team.id,
      team.teamName,
      team.email || null,
      team.passwordHash || null,
      team.passwordSalt || null,
      JSON.stringify(team.members || []),
      team.score || 0,
      JSON.stringify(team.solves || {}),
      JSON.stringify(team.hintsUnlocked || {}),
      JSON.stringify(team.failedAttempts || {}),
      team.totalFailedAttempts || 0,
      team.lastSolveTime || 0,
      team.registeredAt || Date.now(),
      team.ip || '127.0.0.1',
      team.strikes || 0,
      team.isDisqualified ? 1 : 0,
      team.disqualifiedReason || null,
      team.disqualifiedAt || null,
      team.isFlaggedAnomaly ? 1 : 0,
      team.anomalyReason || null,
      team.hasStarted ? 1 : 0,
      team.startedAt || null,
    ]);
    stmt.free();
  }

  /**
   * Debounced disk synchronization: Batches rapid writes to prevent I/O blocking
   * under high concurrency (1,000+ concurrent students submitting flags/unlocks).
   */
  private syncToDisk(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.flushToDisk();
      this.syncTimeout = null;
    }, 500);
  }

  /**
   * Safe disk synchronization with Windows-compatible write and fallback
   */
  public flushToDisk(): void {
    try {
      // 1. Export binary SQLite database (.sqlite)
      const binaryData = this.db.export();
      try {
        fs.writeFileSync(SQLITE_FILE, Buffer.from(binaryData));
      } catch (writeErr: any) {
        if (writeErr?.code === 'EPERM' || writeErr?.code === 'EBUSY') {
          // If locked by IDE or scanner on Windows, retry after 250ms
          setTimeout(() => {
            try {
              fs.writeFileSync(SQLITE_FILE, Buffer.from(this.db.export()));
            } catch {}
          }, 250);
        } else {
          console.warn('[SQLite Database] Disk write warning:', writeErr?.message || writeErr);
        }
      }

      // 2. Export human-readable JSON backup (.json)
      try {
        const list = Array.from(this.teams.values());
        fs.writeFileSync(TEAMS_JSON_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch {}
    } catch (err) {
      console.error('[SQLite Database] Failed to write database to disk:', err);
    }
  }

  /**
   * Get all registered teams
   */
  public getAll(): Team[] {
    return Array.from(this.teams.values());
  }

  /**
   * Get team by ID (O(1))
   */
  public getById(id: string): Team | undefined {
    return this.teams.get(id);
  }

  /**
   * Get team by lowercase name (O(1))
   */
  public getByName(name: string): Team | undefined {
    const clean = name.toLowerCase().trim();
    const id = this.nameIndex.get(clean);
    return id ? this.teams.get(id) : undefined;
  }

  /**
   * Check if a team name is already taken
   */
  public hasName(name: string): boolean {
    return this.nameIndex.has(name.toLowerCase().trim());
  }

  /**
   * Get team by lowercase email (O(1))
   */
  public getByEmail(email: string): Team | undefined {
    const clean = email.toLowerCase().trim();
    const id = this.emailIndex.get(clean);
    return id ? this.teams.get(id) : undefined;
  }

  /**
   * Check if an email is already registered to avoid duplicate/cheating accounts
   */
  public hasEmail(email: string): boolean {
    return this.emailIndex.has(email.toLowerCase().trim());
  }

  /**
   * Save a newly registered team live into SQLite database and persist immediately
   */
  public save(team: Team): Team {
    this.teams.set(team.id, team);
    this.nameIndex.set(team.teamName.toLowerCase().trim(), team.id);
    if (team.email) {
      this.emailIndex.set(team.email.toLowerCase().trim(), team.id);
    }
    this.insertOrUpdateSqlite(team);
    this.sync();
    console.log(`[SQLite Database] Team registered & committed to SQLite: ${team.teamName} [Email: ${team.email || 'N/A'}] (${team.id})`);
    return team;
  }

  /**
   * Update an existing team and commit live to SQLite
   */
  public update(id: string, updates: Partial<Team>): Team | undefined {
    const current = this.teams.get(id);
    if (!current) return undefined;

    // Handle name change index updates if applicable
    if (updates.teamName && updates.teamName.toLowerCase().trim() !== current.teamName.toLowerCase().trim()) {
      this.nameIndex.delete(current.teamName.toLowerCase().trim());
      this.nameIndex.set(updates.teamName.toLowerCase().trim(), id);
    }

    // Handle email change index updates if applicable
    if (updates.email && updates.email.toLowerCase().trim() !== (current.email || '').toLowerCase().trim()) {
      if (current.email) {
        this.emailIndex.delete(current.email.toLowerCase().trim());
      }
      this.emailIndex.set(updates.email.toLowerCase().trim(), id);
    }

    const updated: Team = {
      ...current,
      ...updates,
      id: current.id, // Immutable ID
    };

    this.teams.set(id, updated);
    this.insertOrUpdateSqlite(updated);
    this.sync();
    return updated;
  }

  /**
   * Delete all teams from memory, SQLite database, and disk backup
   */
  public clearAll(): void {
    this.teams.clear();
    this.nameIndex.clear();
    this.emailIndex.clear();
    try {
      this.db.run('DELETE FROM teams;');
      this.syncToDisk();
      if (postgresSync.isEnabled()) {
        postgresSync.wipeAll().catch((err) => console.error('[PostgreSQL] wipeAll error:', err));
      }
    } catch (err) {
      console.error('[SQLite TeamStore] Error clearing teams:', err);
    }
  }

  /**
   * Count of registered teams
   */
  public get count(): number {
    return this.teams.size;
  }

  /**
   * Path to the physical SQLite database file on disk
   */
  public get databasePath(): string {
    return SQLITE_FILE;
  }

  /**
   * Direct access to underlying database for linked stores
   */
  public getDb(): SqlJsDatabase {
    return this.db;
  }

  /**
   * Trigger debounced disk synchronization (immediate option for shutdown)
   */
  public sync(immediate = false): void {
    if (immediate) {
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = null;
      }
      this.syncToDisk();
      return;
    }

    if (this.syncTimeout) return;
    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      this.syncToDisk();
    }, 150);
  }

  /**
   * Execute direct live SQL query (for administrative diagnostics / statistics)
   */
  public query(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

class SqliteChallengeStore {
  private db: SqlJsDatabase;
  private syncFn: () => void;
  private challenges: Map<string, Challenge> = new Map();

  constructor(db: SqlJsDatabase, syncFn: () => void) {
    this.db = db;
    this.syncFn = syncFn;
    this.initSchema();
    this.loadFromSqlite();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS challenges (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        section TEXT NOT NULL,
        category TEXT NOT NULL,
        points INTEGER NOT NULL,
        difficulty TEXT NOT NULL,
        description TEXT NOT NULL,
        flag TEXT NOT NULL,
        flag_format TEXT NOT NULL DEFAULT 'CTF{...}',
        max_attempts INTEGER NOT NULL DEFAULT 5,
        attachment_json TEXT,
        hints_json TEXT NOT NULL DEFAULT '[]',
        writeup_json TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        solves_count INTEGER NOT NULL DEFAULT 0,
        first_blood_team TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_challenges_section ON challenges(section);
      CREATE INDEX IF NOT EXISTS idx_challenges_points ON challenges(points);
    `);
  }

  private rowToChallenge(row: any): Challenge {
    let attachment: any = undefined;
    let hints: any[] = [];
    let writeup: any = undefined;

    try {
      if (row.attachment_json) attachment = JSON.parse(String(row.attachment_json));
    } catch {}

    try {
      if (row.hints_json) hints = JSON.parse(String(row.hints_json));
    } catch {}

    try {
      if (row.writeup_json) writeup = JSON.parse(String(row.writeup_json));
    } catch {}

    return {
      id: String(row.id),
      title: String(row.title),
      section: row.section as ChallengeSection,
      category: row.category as ChallengeCategory,
      points: Number(row.points || 100),
      difficulty: row.difficulty as any,
      description: String(row.description || ''),
      flag: String(row.flag || ''),
      flagFormat: String(row.flag_format || 'CTF{...}'),
      maxAttempts: Number(row.max_attempts || 5),
      attachment,
      hints: Array.isArray(hints) ? hints : [],
      writeup,
      isEnabled: Boolean(row.is_enabled),
      solvesCount: Number(row.solves_count || 0),
      firstBloodTeam: row.first_blood_team ? String(row.first_blood_team) : null,
    };
  }

  private insertOrUpdateSqlite(c: Challenge): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO challenges (
        id, title, section, category, points, difficulty, description, flag,
        flag_format, max_attempts, attachment_json, hints_json, writeup_json,
        is_enabled, solves_count, first_blood_team
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      c.id,
      c.title,
      c.section,
      c.category,
      c.points,
      c.difficulty,
      c.description,
      c.flag,
      c.flagFormat || 'CTF{...}',
      c.maxAttempts || 5,
      c.attachment ? JSON.stringify(c.attachment) : null,
      JSON.stringify(c.hints || []),
      c.writeup ? JSON.stringify(c.writeup) : null,
      c.isEnabled ? 1 : 0,
      c.solvesCount || 0,
      c.firstBloodTeam || null,
    ]);

    stmt.free();
  }

  private loadFromSqlite(): void {
    try {
      const stmt = this.db.prepare('SELECT * FROM challenges;');
      this.challenges.clear();
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const chal = this.rowToChallenge(row);
        this.challenges.set(chal.id, chal);
      }
      stmt.free();
      console.log(`[SQLite Database] Successfully loaded ${this.challenges.size} challenges from SQLite table`);
    } catch (err) {
      console.error('[SQLite Database] Error loading challenges from SQLite:', err);
    }
  }

  public seedFromQuestionsJsonIfEmpty(questionsJsonPath: string): void {
    if (this.challenges.size > 0) {
      return;
    }
    this.syncFromQuestionsJson(questionsJsonPath);
  }

  public syncFromQuestionsJson(questionsJsonPath: string): number {
    try {
      if (fs.existsSync(questionsJsonPath)) {
        const raw = fs.readFileSync(questionsJsonPath, 'utf-8');
        const list: Partial<Challenge>[] = JSON.parse(raw);
        const syncedIds = new Set<string>();
        let count = 0;
        for (const p of list) {
          const id = p.id || 'chal-' + crypto.randomUUID().slice(0, 6);
          syncedIds.add(id);
          const existing = this.challenges.get(id);
          const chal: Challenge = {
            id,
            title: p.title || existing?.title || 'Untitled Challenge',
            section: (p.section as any) || existing?.section || 'Section A',
            category: (p.category as any) || existing?.category || 'MISC',
            points: typeof p.points === 'number' ? p.points : existing?.points ?? 100,
            difficulty: (p.difficulty as any) || existing?.difficulty || 'Medium',
            description: p.description !== undefined ? p.description : existing?.description ?? '',
            flag: p.flag || existing?.flag || 'CTF{dummy}',
            flagFormat: p.flagFormat || existing?.flagFormat || 'CTF{...}',
            maxAttempts: typeof p.maxAttempts === 'number' ? p.maxAttempts : existing?.maxAttempts ?? 5,
            attachment: p.attachment !== undefined ? p.attachment : existing?.attachment,
            hints: p.hints || existing?.hints || [],
            writeup: p.writeup !== undefined ? p.writeup : existing?.writeup,
            isEnabled: typeof p.isEnabled === 'boolean' ? p.isEnabled : existing?.isEnabled ?? true,
            solvesCount: existing?.solvesCount ?? 0,
            firstBloodTeam: existing?.firstBloodTeam ?? null,
          };
          this.challenges.set(id, chal);
          this.insertOrUpdateSqlite(chal);
          count++;
        }
        // Remove any challenges in DB that are not in questions.json
        for (const [id] of this.challenges) {
          if (!syncedIds.has(id)) {
            this.challenges.delete(id);
            try {
              this.db.run('DELETE FROM challenges WHERE id = ?;', [id]);
            } catch (delErr) {
              console.warn('[SQLite Database] Failed to delete obsolete challenge:', id, delErr);
            }
          }
        }
        this.syncFn();
        console.log(`[SQLite Database] Successfully synced ${count} challenges from questions.json into ctf_database.sqlite`);
        return count;
      }
    } catch (err) {
      console.error('[SQLite Database] Error syncing challenges from questions.json into SQLite:', err);
    }
    return 0;
  }

  public getAll(): Challenge[] {
    return Array.from(this.challenges.values());
  }

  public getById(id: string): Challenge | undefined {
    return this.challenges.get(id);
  }

  public exportToQuestionsJson(questionsJsonPath?: string): void {
    try {
      const targetPath = questionsJsonPath || path.join(PROJECT_ROOT, 'questions.json');
      const list = Array.from(this.challenges.values()).map((c) => ({
        id: c.id,
        title: c.title,
        section: c.section,
        category: c.category,
        points: c.points,
        difficulty: c.difficulty,
        description: c.description,
        flag: c.flag,
        flagFormat: c.flagFormat || 'CTF{...}',
        maxAttempts: c.maxAttempts || 5,
        attachment: c.attachment,
        hints: c.hints || [],
        writeup: c.writeup,
        isEnabled: c.isEnabled,
      }));
      fs.writeFileSync(targetPath, JSON.stringify(list, null, 2), 'utf-8');
      console.log(`[Questions Storage] Exported ${list.length} challenges to ${targetPath}`);
    } catch (err) {
      console.error('[Questions Storage] Error exporting challenges to questions.json:', err);
    }
  }

  public create(c: Challenge): Challenge {
    this.challenges.set(c.id, c);
    this.insertOrUpdateSqlite(c);
    this.syncFn();
    this.exportToQuestionsJson();
    if (postgresSync.isEnabled()) {
      postgresSync.saveChallenge(c);
    }
    return c;
  }

  public update(id: string, updates: Partial<Challenge>): Challenge | undefined {
    const current = this.challenges.get(id);
    if (!current) return undefined;
    const updated: Challenge = {
      ...current,
      ...updates,
      id: current.id,
    };
    this.challenges.set(id, updated);
    this.insertOrUpdateSqlite(updated);
    this.syncFn();
    this.exportToQuestionsJson();
    if (postgresSync.isEnabled()) {
      postgresSync.saveChallenge(updated);
    }
    return updated;
  }

  public delete(id: string): boolean {
    if (!this.challenges.has(id)) return false;
    this.challenges.delete(id);
    this.db.run('DELETE FROM challenges WHERE id = ?;', [id]);
    this.syncFn();
    this.exportToQuestionsJson();
    if (postgresSync.isEnabled()) {
      postgresSync.deleteChallenge(id);
    }
    return true;
  }

  public get count(): number {
    return this.challenges.size;
  }
}

export const teamStore = new SqliteTeamStore();
export const challengeStore = new SqliteChallengeStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

class SqliteScreenshotStore {
  constructor(private db: SqlJsDatabase, private syncFn: () => void) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS screenshot_alerts (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        team_name TEXT NOT NULL,
        email TEXT,
        members TEXT NOT NULL DEFAULT '[]',
        ip TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        trigger_key TEXT,
        details TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON screenshot_alerts(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_screenshots_team ON screenshot_alerts(team_id);
    `);
  }

  public add(alert: ScreenshotAlert): ScreenshotAlert {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO screenshot_alerts (
        id, team_id, team_name, email, members, ip, timestamp, trigger_key, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      alert.id,
      alert.teamId,
      alert.teamName,
      alert.email || null,
      JSON.stringify(alert.members || []),
      alert.ip,
      alert.timestamp,
      alert.triggerKey || null,
      alert.details,
    ]);
    stmt.free();
    this.syncFn();

    if (postgresSync.isEnabled()) {
      postgresSync.saveScreenshotAlert(alert);
    }

    return alert;
  }

  public getAll(limit = 100): ScreenshotAlert[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM screenshot_alerts ORDER BY timestamp DESC LIMIT ?;
      `);
      stmt.bind([limit]);
      const list: ScreenshotAlert[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          id: String(row.id),
          teamId: String(row.team_id),
          teamName: String(row.team_name),
          email: row.email ? String(row.email) : undefined,
          members: JSON.parse(String(row.members || '[]')),
          ip: String(row.ip),
          timestamp: Number(row.timestamp),
          triggerKey: row.trigger_key ? String(row.trigger_key) : undefined,
          details: String(row.details),
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite ScreenshotStore] Error loading screenshots:', err);
      return [];
    }
  }

  public delete(id: string): boolean {
    this.db.run('DELETE FROM screenshot_alerts WHERE id = ?;', [id]);
    this.syncFn();
    if (postgresSync.isEnabled()) {
      postgresSync.deleteScreenshotAlert(id);
    }
    return true;
  }

  public clearAll(): void {
    this.db.run('DELETE FROM screenshot_alerts;');
    this.syncFn();
    if (postgresSync.isEnabled()) {
      postgresSync.clearScreenshotAlerts();
    }
  }
}

class SqliteSecurityLogStore {
  constructor(private db: SqlJsDatabase, private syncFn: () => void) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        team_name TEXT,
        ip TEXT NOT NULL,
        type TEXT NOT NULL,
        details TEXT NOT NULL,
        severity TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_security_logs_type ON security_logs(type);
    `);
  }

  public add(log: SecurityLog): SecurityLog {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO security_logs (
        id, timestamp, team_name, ip, type, details, severity
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      log.id,
      log.timestamp,
      log.teamName || null,
      log.ip,
      log.type,
      log.details,
      log.severity,
    ]);
    stmt.free();
    this.syncFn();

    if (postgresSync.isEnabled()) {
      postgresSync.saveSecurityLog(log);
    }

    return log;
  }

  public getAll(limit = 300): SecurityLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM security_logs ORDER BY timestamp DESC LIMIT ?;
      `);
      stmt.bind([limit]);
      const list: SecurityLog[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          id: String(row.id),
          timestamp: Number(row.timestamp),
          teamName: row.team_name ? String(row.team_name) : undefined,
          ip: String(row.ip),
          type: row.type as any,
          details: String(row.details),
          severity: row.severity as any,
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite SecurityLogStore] Error loading security logs:', err);
      return [];
    }
  }

  public clearAll(): void {
    this.db.run('DELETE FROM security_logs;');
    this.syncFn();
    if (postgresSync.isEnabled()) {
      postgresSync.clearSecurityLogs();
    }
  }
}

class SqliteActivityFeedStore {
  constructor(private db: SqlJsDatabase, private syncFn: () => void) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS activity_feed (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        team_name TEXT NOT NULL,
        challenge_title TEXT,
        points INTEGER,
        message TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activity_feed_timestamp ON activity_feed(timestamp DESC);
    `);
  }

  public add(event: ActivityFeedEvent): ActivityFeedEvent {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO activity_feed (
        id, timestamp, type, team_name, challenge_title, points, message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      event.id,
      event.timestamp,
      event.type,
      event.teamName,
      event.challengeTitle || null,
      event.points !== undefined ? event.points : null,
      event.message,
    ]);
    stmt.free();
    this.syncFn();

    if (postgresSync.isEnabled()) {
      postgresSync.saveActivity(event);
    }

    return event;
  }

  public getRecent(limit = 50): ActivityFeedEvent[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM activity_feed ORDER BY timestamp DESC LIMIT ?;
      `);
      stmt.bind([limit]);
      const list: ActivityFeedEvent[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          id: String(row.id),
          timestamp: Number(row.timestamp),
          type: row.type as any,
          teamName: String(row.team_name),
          challengeTitle: row.challenge_title ? String(row.challenge_title) : undefined,
          points: row.points !== null && row.points !== undefined ? Number(row.points) : undefined,
          message: String(row.message),
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite ActivityFeedStore] Error loading activity feed:', err);
      return [];
    }
  }

  public purgeResidualDummyEvents(): void {
    try {
      this.db.run(`
        DELETE FROM activity_feed 
        WHERE challenge_title LIKE '%Phantom Pixel%'
           OR challenge_title LIKE '%Memory Dump%'
           OR challenge_title LIKE '%Subcarrier Spectrogram%'
           OR message LIKE '%Phantom Pixel%'
           OR message LIKE '%Memory Dump%'
           OR message LIKE '%Subcarrier Spectrogram%';
      `);
      this.syncFn();
    } catch (err) {
      console.error('[SQLite ActivityFeedStore] Error purging residual dummy activity events:', err);
    }
  }

  public clearAll(): void {
    this.db.run('DELETE FROM activity_feed;');
    this.syncFn();
  }
}

class SqliteCompetitionStateStore {
  constructor(private db: SqlJsDatabase, private syncFn: () => void) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS competition_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  public getState(defaultState: CompetitionState): CompetitionState {
    try {
      const stmt = this.db.prepare(`SELECT value FROM competition_config WHERE key = 'competition_state';`);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        const parsed = JSON.parse(String(row.value));
        stmt.free();
        return {
          ...defaultState,
          ...parsed,
        };
      }
      stmt.free();
    } catch (err) {
      console.error('[SQLite CompetitionStateStore] Error getting competition state:', err);
    }
    return defaultState;
  }

  public saveState(state: CompetitionState): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO competition_config (key, value) VALUES ('competition_state', ?);
      `);
      stmt.run([JSON.stringify(state)]);
      stmt.free();
      this.syncFn();

      if (postgresSync.isEnabled()) {
        postgresSync.saveCompetitionConfig(state);
      }
    } catch (err) {
      console.error('[SQLite CompetitionStateStore] Error saving competition state:', err);
    }
  }
}

class SqliteSubmissionStore {
  constructor(private db: SqlJsDatabase, private syncFn: () => void) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        team_name TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        challenge_title TEXT,
        submitted_flag TEXT NOT NULL,
        is_correct INTEGER NOT NULL,
        points_awarded INTEGER NOT NULL DEFAULT 0,
        timestamp INTEGER NOT NULL,
        ip TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions(team_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON submissions(challenge_id);
    `);
  }

  public record(sub: SubmissionRecord): SubmissionRecord {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO submissions (
        id, team_id, team_name, challenge_id, challenge_title, submitted_flag, is_correct, points_awarded, timestamp, ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      sub.id,
      sub.teamId,
      sub.teamName,
      sub.challengeId,
      sub.challengeTitle || null,
      sub.submittedFlag,
      sub.isCorrect ? 1 : 0,
      sub.pointsAwarded || 0,
      sub.timestamp,
      sub.ip,
    ]);
    stmt.free();
    this.syncFn();

    if (postgresSync.isEnabled()) {
      postgresSync.saveSubmission(sub);
    }

    return sub;
  }

  public getRecent(limit = 200): SubmissionRecord[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM submissions ORDER BY timestamp DESC LIMIT ?;
      `);
      stmt.bind([limit]);
      const list: SubmissionRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          id: String(row.id),
          teamId: String(row.team_id),
          teamName: String(row.team_name),
          challengeId: String(row.challenge_id),
          challengeTitle: row.challenge_title ? String(row.challenge_title) : undefined,
          submittedFlag: String(row.submitted_flag),
          isCorrect: Boolean(row.is_correct),
          pointsAwarded: Number(row.points_awarded || 0),
          timestamp: Number(row.timestamp),
          ip: String(row.ip),
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite SubmissionStore] Error reading submissions:', err);
      return [];
    }
  }

  public getAll(limit = 1000): SubmissionRecord[] {
    return this.getRecent(limit);
  }

  public getByTeam(teamId: string, limit = 100): SubmissionRecord[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM submissions WHERE team_id = ? ORDER BY timestamp DESC LIMIT ?;
      `);
      stmt.bind([teamId, limit]);
      const list: SubmissionRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          id: String(row.id),
          teamId: String(row.team_id),
          teamName: String(row.team_name),
          challengeId: String(row.challenge_id),
          challengeTitle: row.challenge_title ? String(row.challenge_title) : undefined,
          submittedFlag: String(row.submitted_flag),
          isCorrect: Boolean(row.is_correct),
          pointsAwarded: Number(row.points_awarded || 0),
          timestamp: Number(row.timestamp),
          ip: String(row.ip),
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite SubmissionStore] Error reading submissions by team:', err);
      return [];
    }
  }

  public clearAll(): void {
    try {
      this.db.run('DELETE FROM submissions;');
      this.syncFn();
    } catch (err) {
      console.error('[SQLite SubmissionStore] Error clearing submissions:', err);
    }
  }
}

export const screenshotStore = new SqliteScreenshotStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

export const securityLogStore = new SqliteSecurityLogStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

export const activityFeedStore = new SqliteActivityFeedStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

export const competitionStateStore = new SqliteCompetitionStateStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

export const submissionStore = new SqliteSubmissionStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

class SqliteLeaderboardStore {
  constructor(private db: SqlJsDatabase, private syncFn: () => void) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        rank INTEGER NOT NULL,
        team_id TEXT PRIMARY KEY,
        team_name TEXT NOT NULL,
        members TEXT NOT NULL DEFAULT '[]',
        score INTEGER NOT NULL DEFAULT 0,
        solves_count INTEGER NOT NULL DEFAULT 0,
        total_failed_attempts INTEGER NOT NULL DEFAULT 0,
        last_solve_time INTEGER NOT NULL DEFAULT 0,
        strikes INTEGER NOT NULL DEFAULT 0,
        is_disqualified INTEGER NOT NULL DEFAULT 0,
        is_flagged_anomaly INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank ASC);
      CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);

      CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        rankings_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON leaderboard_snapshots(timestamp DESC);
    `);
  }

  public syncLeaderboard(entries: LeaderboardEntry[]): void {
    try {
      this.db.run('DELETE FROM leaderboard;');
      const stmt = this.db.prepare(`
        INSERT INTO leaderboard (
          rank, team_id, team_name, members, score, solves_count,
          total_failed_attempts, last_solve_time, strikes, is_disqualified,
          is_flagged_anomaly, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      for (const e of entries) {
        stmt.run([
          e.rank,
          e.teamId,
          e.teamName,
          JSON.stringify(e.members || []),
          e.score,
          e.solvesCount,
          e.totalFailedAttempts,
          e.lastSolveTime,
          e.strikes,
          e.isDisqualified ? 1 : 0,
          e.isFlaggedAnomaly ? 1 : 0,
          now,
        ]);
      }
      stmt.free();

      // Record a snapshot for audit
      const snapStmt = this.db.prepare(`
        INSERT INTO leaderboard_snapshots (id, timestamp, rankings_json) VALUES (?, ?, ?);
      `);
      snapStmt.run([
        'snap-' + crypto.randomUUID(),
        now,
        JSON.stringify(entries),
      ]);
      snapStmt.free();

      // Keep snapshot history bounded (latest 50 snapshots)
      this.db.run(`
        DELETE FROM leaderboard_snapshots WHERE id NOT IN (
          SELECT id FROM leaderboard_snapshots ORDER BY timestamp DESC LIMIT 50
        );
      `);

      this.syncFn();
    } catch (err) {
      console.error('[SQLite LeaderboardStore] Error syncing leaderboard:', err);
    }
  }

  public getLeaderboard(): LeaderboardEntry[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM leaderboard ORDER BY rank ASC;
      `);
      const list: LeaderboardEntry[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          rank: Number(row.rank),
          teamId: String(row.team_id),
          teamName: String(row.team_name),
          members: JSON.parse(String(row.members || '[]')),
          score: Number(row.score),
          solvesCount: Number(row.solves_count),
          totalFailedAttempts: Number(row.total_failed_attempts),
          lastSolveTime: Number(row.last_solve_time),
          strikes: Number(row.strikes),
          isDisqualified: Boolean(row.is_disqualified),
          isFlaggedAnomaly: Boolean(row.is_flagged_anomaly),
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite LeaderboardStore] Error reading leaderboard:', err);
      return [];
    }
  }

  public getSnapshots(limit = 10): { id: string; timestamp: number; rankings: LeaderboardEntry[] }[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM leaderboard_snapshots ORDER BY timestamp DESC LIMIT ?;
      `);
      stmt.bind([limit]);
      const list: { id: string; timestamp: number; rankings: LeaderboardEntry[] }[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          id: String(row.id),
          timestamp: Number(row.timestamp),
          rankings: JSON.parse(String(row.rankings_json || '[]')),
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite LeaderboardStore] Error reading snapshots:', err);
      return [];
    }
  }

  public clearAll(): void {
    try {
      this.db.run('DELETE FROM leaderboard_snapshots;');
      this.syncFn();
    } catch (err) {
      console.error('[SQLite LeaderboardStore] Error clearing snapshots:', err);
    }
  }
}

export const leaderboardStore = new SqliteLeaderboardStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

/**
 * Dedicated SQLite Store for Timestamped System-Wide Audit Logs
 * Captures microsecond-precision UTC timestamps across all student and admin events
 */
class SqliteAuditLogStore {
  constructor(private db: SqlJsDatabase, private syncFn: () => void) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        log_id TEXT PRIMARY KEY,
        actor_type TEXT NOT NULL,
        actor_identifier TEXT NOT NULL,
        action_type TEXT NOT NULL,
        details TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        timestamp_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_identifier);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action_type);
    `);
  }

  public add(
    entry: {
      actorType?: AuditActorType | string;
      actorIdentifier?: string | null;
      actionType?: AuditActionType | string;
      details?: string | Record<string, any> | null;
      ipAddress?: string | null;
      logId?: string | null;
      timestamp?: string | null;
      timestampMs?: number | null;
    }
  ): AuditLog {
    const logId = String(entry.logId || ('audit-' + crypto.randomUUID()));
    const now = new Date();
    const timestamp = String(entry.timestamp || now.toISOString());
    const timestampMs = typeof entry.timestampMs === 'number' && !isNaN(entry.timestampMs) ? entry.timestampMs : now.getTime();

    let detailsStr = '{}';
    if (typeof entry.details === 'string') {
      detailsStr = entry.details;
    } else if (entry.details !== undefined && entry.details !== null) {
      try {
        const serialized = JSON.stringify(entry.details);
        detailsStr = typeof serialized === 'string' ? serialized : '{}';
      } catch {
        detailsStr = '{}';
      }
    }

    const actorType = (String(entry.actorType || 'SYSTEM').toUpperCase()) as AuditActorType;
    const actorIdentifier = String(entry.actorIdentifier || 'SYSTEM').trim() || 'SYSTEM';
    const actionType = (String(entry.actionType || 'SYSTEM_INFO')) as AuditActionType;
    const ipAddress = String(entry.ipAddress || '127.0.0.1').trim() || '127.0.0.1';

    const fullLog: AuditLog = {
      logId,
      actorType,
      actorIdentifier,
      actionType,
      details: detailsStr,
      ipAddress,
      timestamp,
      timestampMs,
    };

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO audit_logs (
          log_id, actor_type, actor_identifier, action_type, details, ip_address, timestamp, timestamp_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `);
      stmt.run([
        String(fullLog.logId || ''),
        String(fullLog.actorType || 'SYSTEM'),
        String(fullLog.actorIdentifier || 'SYSTEM'),
        String(fullLog.actionType || 'SYSTEM_INFO'),
        String(fullLog.details || '{}'),
        String(fullLog.ipAddress || '127.0.0.1'),
        String(fullLog.timestamp || now.toISOString()),
        Number(fullLog.timestampMs || now.getTime()),
      ]);
      stmt.free();
      this.syncFn();

      if (postgresSync.isEnabled()) {
        postgresSync.saveAuditLog(fullLog);
      }
    } catch (err) {
      console.error('[SQLite AuditLogStore] Error adding audit log:', err, {
        entry,
        fullLog,
      });
    }
    return fullLog;
  }

  public getAll(limit = 2000): AuditLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM audit_logs ORDER BY timestamp_ms DESC LIMIT ?;
      `);
      stmt.bind([limit]);
      const list: AuditLog[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          logId: String(row.log_id),
          actorType: String(row.actor_type) as any,
          actorIdentifier: String(row.actor_identifier),
          actionType: String(row.action_type) as any,
          details: String(row.details || '{}'),
          ipAddress: String(row.ip_address),
          timestamp: String(row.timestamp),
          timestampMs: Number(row.timestamp_ms),
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite AuditLogStore] Error reading audit logs:', err);
      return [];
    }
  }

  public getRecent(limit = 250): AuditLog[] {
    return this.getAll(limit);
  }

  public getByActor(actor: string, limit = 100): AuditLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM audit_logs WHERE actor_identifier = ? ORDER BY timestamp_ms DESC LIMIT ?;
      `);
      stmt.bind([actor, limit]);
      const list: AuditLog[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        list.push({
          logId: String(row.log_id),
          actorType: String(row.actor_type) as any,
          actorIdentifier: String(row.actor_identifier),
          actionType: String(row.action_type) as any,
          details: String(row.details || '{}'),
          ipAddress: String(row.ip_address),
          timestamp: String(row.timestamp),
          timestampMs: Number(row.timestamp_ms),
        });
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[SQLite AuditLogStore] Error querying by actor:', err);
      return [];
    }
  }

  public count(): number {
    try {
      const res = this.db.exec(`SELECT COUNT(*) FROM audit_logs`);
      if (res.length > 0 && res[0].values.length > 0) {
        return Number(res[0].values[0][0]);
      }
    } catch {}
    return 0;
  }

  public exportCsv(limit = 5000): string {
    const logs = this.getAll(limit);
    // Columns: Log ID, Timestamp, Actor Type, Actor Identifier, Action Type, IP Address, Detailed Metadata
    let csv = 'Log ID,Timestamp,Actor Type,Actor Identifier,Action Type,IP Address,Detailed Metadata\n';
    logs.forEach((log) => {
      const escapedId = `"${log.logId.replace(/"/g, '""')}"`;
      const escapedTime = `"${log.timestamp.replace(/"/g, '""')}"`;
      const escapedActorType = `"${log.actorType.replace(/"/g, '""')}"`;
      const escapedActor = `"${log.actorIdentifier.replace(/"/g, '""')}"`;
      const escapedAction = `"${log.actionType.replace(/"/g, '""')}"`;
      const escapedIp = `"${log.ipAddress.replace(/"/g, '""')}"`;
      const escapedDetails = `"${log.details.replace(/"/g, '""')}"`;
      csv += `${escapedId},${escapedTime},${escapedActorType},${escapedActor},${escapedAction},${escapedIp},${escapedDetails}\n`;
    });
    return csv;
  }

  public clearAll(): void {
    try {
      this.db.run('DELETE FROM audit_logs;');
      this.syncFn();
    } catch (err) {
      console.error('[SQLite AuditLogStore] Error clearing audit logs:', err);
    }
  }
}

export const auditLogStore = new SqliteAuditLogStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

class SqliteFeedbackStore {
  private db: SqlJsDatabase;
  private syncFn: () => void;

  constructor(db: SqlJsDatabase, syncFn: () => void) {
    this.db = db;
    this.syncFn = syncFn;
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_feedbacks (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        team_name TEXT NOT NULL,
        rating_ui INTEGER NOT NULL,
        challenge_difficulty TEXT NOT NULL,
        platform_stability INTEGER NOT NULL,
        fair_play_security TEXT NOT NULL,
        clarity_rules_hints INTEGER NOT NULL,
        favorite_highlight TEXT NOT NULL,
        suggestions_round3 TEXT NOT NULL,
        submitted_at INTEGER NOT NULL
      );
    `);
    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_feedbacks_team_id ON user_feedbacks(team_id);`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_feedbacks_time ON user_feedbacks(submitted_at DESC);`);
    } catch {}
  }

  public save(feedback: FeedbackSubmission): void {
    try {
      this.db.run(
        `INSERT OR REPLACE INTO user_feedbacks (
          id, team_id, team_name, rating_ui, challenge_difficulty, platform_stability,
          fair_play_security, clarity_rules_hints, favorite_highlight, suggestions_round3, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          feedback.id,
          feedback.teamId,
          feedback.teamName,
          feedback.ratingUi,
          feedback.challengeDifficulty,
          feedback.platformStability,
          feedback.fairPlaySecurity,
          feedback.clarityRulesHints,
          feedback.favoriteHighlight,
          feedback.suggestionsRound3,
          feedback.submittedAt,
        ]
      );
      this.syncFn();

      if (postgresSync.isEnabled()) {
        postgresSync.saveFeedback(feedback);
      }
    } catch (err) {
      console.error('[SQLite FeedbackStore] Error saving feedback:', err);
    }
  }

  public getByTeamId(teamId: string): FeedbackSubmission | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM user_feedbacks WHERE team_id = ? ORDER BY submitted_at DESC LIMIT 1;');
      stmt.bind([teamId]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return {
          id: String(row.id),
          teamId: String(row.team_id),
          teamName: String(row.team_name),
          ratingUi: Number(row.rating_ui),
          challengeDifficulty: String(row.challenge_difficulty),
          platformStability: Number(row.platform_stability),
          fairPlaySecurity: String(row.fair_play_security),
          clarityRulesHints: Number(row.clarity_rules_hints),
          favoriteHighlight: String(row.favorite_highlight || ''),
          suggestionsRound3: String(row.suggestions_round3 || ''),
          submittedAt: Number(row.submitted_at),
        };
      }
      stmt.free();
      return null;
    } catch (err) {
      console.error('[SQLite FeedbackStore] Error getting feedback by team:', err);
      return null;
    }
  }

  public getByTeam(teamId: string, teamName?: string): FeedbackSubmission | null {
    try {
      const cleanName = (teamName || '').toLowerCase().trim();
      const stmt = this.db.prepare(
        'SELECT * FROM user_feedbacks WHERE team_id = ? OR (team_name != "" AND LOWER(TRIM(team_name)) = ?) ORDER BY submitted_at DESC LIMIT 1;'
      );
      stmt.bind([teamId, cleanName]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return {
          id: String(row.id),
          teamId: String(row.team_id),
          teamName: String(row.team_name),
          ratingUi: Number(row.rating_ui),
          challengeDifficulty: String(row.challenge_difficulty),
          platformStability: Number(row.platform_stability),
          fairPlaySecurity: String(row.fair_play_security),
          clarityRulesHints: Number(row.clarity_rules_hints),
          favoriteHighlight: String(row.favorite_highlight || ''),
          suggestionsRound3: String(row.suggestions_round3 || ''),
          submittedAt: Number(row.submitted_at),
        };
      }
      stmt.free();
      return null;
    } catch (err) {
      console.error('[SQLite FeedbackStore] Error querying feedback by team identifier:', err);
      return null;
    }
  }

  public getAll(): FeedbackSubmission[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM user_feedbacks ORDER BY submitted_at DESC;');
      const results: FeedbackSubmission[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: String(row.id),
          teamId: String(row.team_id),
          teamName: String(row.team_name),
          ratingUi: Number(row.rating_ui),
          challengeDifficulty: String(row.challenge_difficulty),
          platformStability: Number(row.platform_stability),
          fairPlaySecurity: String(row.fair_play_security),
          clarityRulesHints: Number(row.clarity_rules_hints),
          favoriteHighlight: String(row.favorite_highlight || ''),
          suggestionsRound3: String(row.suggestions_round3 || ''),
          submittedAt: Number(row.submitted_at),
        });
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('[SQLite FeedbackStore] Error getting all feedbacks:', err);
      return [];
    }
  }

  public deleteById(id: string): boolean {
    try {
      this.db.run('DELETE FROM user_feedbacks WHERE id = ?;', [id]);
      this.syncFn();
      return true;
    } catch (err) {
      console.error('[SQLite FeedbackStore] Error deleting feedback by id:', err);
      return false;
    }
  }

  public clearAll(): void {
    try {
      this.db.run('DELETE FROM user_feedbacks;');
      this.syncFn();
    } catch (err) {
      console.error('[SQLite FeedbackStore] Error clearing feedbacks:', err);
    }
  }
}

export const feedbackStore = new SqliteFeedbackStore(
  teamStore.getDb(),
  () => teamStore.sync()
);

// Auto-initialize remote PostgreSQL sync on server boot if DATABASE_URL is configured
if (postgresSync.isEnabled()) {
  postgresSync.initSchema().then(async (ready) => {
    if (ready) {
      try {
        const pgTeams = await postgresSync.loadTeams();
        if (pgTeams.length > 0) {
          console.log(`[PostgreSQL] Loaded ${pgTeams.length} teams from remote cloud PostgreSQL.`);
          for (const t of pgTeams) {
            teamStore.upsertFromPostgres(t);
          }
        } else {
          console.log('[PostgreSQL] Remote database is fresh. Syncing local teams to PostgreSQL...');
          for (const t of teamStore.getAll()) {
            await postgresSync.saveTeam(t);
          }
        }

        const pgConfig = await postgresSync.loadCompetitionConfig();
        if (pgConfig) {
          console.log('[PostgreSQL] Loaded competition configuration from remote cloud PostgreSQL.');
          competitionStateStore.saveState(pgConfig);
        }

        // Synchronize all challenges into Supabase challenges table
        const currentChals = challengeStore.getAll();
        if (currentChals.length > 0) {
          await postgresSync.syncChallenges(currentChals);
        }

        // Backfill existing screenshot alerts to Supabase
        const currentScreenshots = screenshotStore.getAll(100);
        for (const s of currentScreenshots) {
          await postgresSync.saveScreenshotAlert(s);
        }

        // Backfill existing security logs to Supabase
        const currentSecLogs = securityLogStore.getAll(100);
        for (const sl of currentSecLogs) {
          await postgresSync.saveSecurityLog(sl);
        }

        // Backfill existing audit logs to Supabase
        const currentAuditLogs = auditLogStore.getAll(200);
        for (const al of currentAuditLogs) {
          await postgresSync.saveAuditLog(al);
        }

        // Backfill existing challenge submissions to Supabase
        const currentSubs = submissionStore.getAll();
        for (const sub of currentSubs) {
          await postgresSync.saveSubmission(sub);
        }
      } catch (e) {
        console.error('[PostgreSQL] Error during initial state synchronization:', e);
      }
    }
  });
}

export { postgresSync };


