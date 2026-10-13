import pg from 'pg';
import type {
  Team,
  Challenge,
  SubmissionRecord,
  ActivityFeedEvent,
  CompetitionState,
  SecurityLog,
  ScreenshotAlert,
  AuditLog,
  FeedbackSubmission,
} from '../types.ts';

const { Pool } = pg;

class PostgresSyncManager {
  private pool: pg.Pool | null = null;
  private isConnected = false;
  private hasInitializedSchema = false;

  constructor() {
    const dbUrl = process.env.DATABASE_URL?.trim();
    if (dbUrl) {
      if (dbUrl.includes('.supabase.co') && !dbUrl.includes('pooler.supabase.com')) {
        console.warn('\n' + '='.repeat(70));
        console.warn('[PostgreSQL WARNING] Detected Direct Supabase URL (db.*.supabase.co)!');
        console.warn('Render only supports IPv4. Direct Supabase connections fail with ENETUNREACH.');
        console.warn('Fix: In Supabase, copy the "Connection Pooler" (Session Mode) URI:');
        console.warn('  e.g., postgresql://postgres.[project-ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres');
        console.warn('Update DATABASE_URL in Render Environment settings to resolve this.');
        console.warn('='.repeat(70) + '\n');
      }

      try {
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
        console.log('[PostgreSQL] Initialized PostgreSQL connection pool from DATABASE_URL');
      } catch (err) {
        console.error('[PostgreSQL] Failed to create connection pool:', err);
      }
    } else {
      console.log('[PostgreSQL] No DATABASE_URL provided. Operating in local SQLite mode.');
    }
  }

  public isEnabled(): boolean {
    return this.pool !== null;
  }

  /**
   * Initializes PostgreSQL schema automatically on first boot
   */
  public async initSchema(): Promise<boolean> {
    if (!this.pool || this.hasInitializedSchema) return this.isConnected;

    try {
      const client = await this.pool.connect();
      try {
        await client.query(`
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
            last_solve_time BIGINT NOT NULL DEFAULT 0,
            registered_at BIGINT NOT NULL,
            ip TEXT NOT NULL,
            strikes INTEGER NOT NULL DEFAULT 0,
            is_disqualified INTEGER NOT NULL DEFAULT 0,
            disqualified_reason TEXT,
            disqualified_at BIGINT,
            is_flagged_anomaly INTEGER NOT NULL DEFAULT 0,
            anomaly_reason TEXT,
            has_started INTEGER NOT NULL DEFAULT 0,
            started_at BIGINT
          );

          CREATE INDEX IF NOT EXISTS idx_pg_teams_name ON teams(team_name);
          CREATE INDEX IF NOT EXISTS idx_pg_teams_email ON teams(email);
          CREATE INDEX IF NOT EXISTS idx_pg_teams_score ON teams(score DESC);

          CREATE TABLE IF NOT EXISTS challenges (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at BIGINT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            team_id TEXT NOT NULL,
            challenge_id TEXT NOT NULL,
            submitted_flag TEXT NOT NULL,
            is_correct INTEGER NOT NULL,
            submitted_at BIGINT NOT NULL,
            ip TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_pg_sub_team ON submissions(team_id);
          CREATE INDEX IF NOT EXISTS idx_pg_sub_chal ON submissions(challenge_id);

          CREATE TABLE IF NOT EXISTS activity_feed (
            id TEXT PRIMARY KEY,
            event_data TEXT NOT NULL,
            timestamp BIGINT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_pg_feed_ts ON activity_feed(timestamp DESC);

          CREATE TABLE IF NOT EXISTS competition_config (
            id TEXT PRIMARY KEY,
            config_data TEXT NOT NULL,
            updated_at BIGINT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS user_feedbacks (
            id TEXT PRIMARY KEY,
            team_id TEXT NOT NULL,
            team_name TEXT NOT NULL,
            rating_ui INTEGER NOT NULL,
            challenge_difficulty TEXT NOT NULL,
            platform_stability INTEGER NOT NULL,
            fair_play_security TEXT NOT NULL,
            clarity_rules_hints INTEGER NOT NULL,
            favorite_highlight TEXT,
            suggestions_round3 TEXT,
            submitted_at BIGINT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            log_data TEXT NOT NULL,
            timestamp BIGINT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS security_logs (
            id TEXT PRIMARY KEY,
            log_data TEXT NOT NULL,
            timestamp BIGINT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS screenshot_alerts (
            id TEXT PRIMARY KEY,
            alert_data TEXT NOT NULL,
            timestamp BIGINT NOT NULL
          );
        `);
        this.isConnected = true;
        this.hasInitializedSchema = true;
        console.log('[PostgreSQL] Verified/Created all PostgreSQL tables successfully on remote database.');
        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      if (err?.code === 'ENETUNREACH' || err?.message?.includes('ENETUNREACH')) {
        console.error('\n' + '!'.repeat(70));
        console.error('[PostgreSQL CRITICAL] ENETUNREACH: Cannot reach Supabase via IPv6 on Render.');
        console.error('Please switch your Render DATABASE_URL from db.*.supabase.co to the Supabase Connection Pooler:');
        console.error('  aws-0-*.pooler.supabase.com on port 5432 (Session Mode) or port 6543 (Transaction Mode).');
        console.error('!'.repeat(70) + '\n');
      } else {
        console.error('[PostgreSQL] Error during initSchema:', err);
      }
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Load existing teams from PostgreSQL into memory on boot
   */
  public async loadTeams(): Promise<Team[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT * FROM teams');
      return res.rows.map((row) => ({
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
      }));
    } catch (err) {
      console.error('[PostgreSQL] Error loading teams:', err);
      return [];
    }
  }

  /**
   * Upsert a team into PostgreSQL
   */
  public async saveTeam(team: Team): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `
        INSERT INTO teams (
          id, team_name, email, password_hash, password_salt, members, score,
          solves, hints_unlocked, failed_attempts, total_failed_attempts,
          last_solve_time, registered_at, ip, strikes, is_disqualified,
          disqualified_reason, disqualified_at, is_flagged_anomaly, anomaly_reason,
          has_started, started_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22
        )
        ON CONFLICT (id) DO UPDATE SET
          team_name = EXCLUDED.team_name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          password_salt = EXCLUDED.password_salt,
          members = EXCLUDED.members,
          score = EXCLUDED.score,
          solves = EXCLUDED.solves,
          hints_unlocked = EXCLUDED.hints_unlocked,
          failed_attempts = EXCLUDED.failed_attempts,
          total_failed_attempts = EXCLUDED.total_failed_attempts,
          last_solve_time = EXCLUDED.last_solve_time,
          registered_at = EXCLUDED.registered_at,
          ip = EXCLUDED.ip,
          strikes = EXCLUDED.strikes,
          is_disqualified = EXCLUDED.is_disqualified,
          disqualified_reason = EXCLUDED.disqualified_reason,
          disqualified_at = EXCLUDED.disqualified_at,
          is_flagged_anomaly = EXCLUDED.is_flagged_anomaly,
          anomaly_reason = EXCLUDED.anomaly_reason,
          has_started = EXCLUDED.has_started,
          started_at = EXCLUDED.started_at;
        `,
        [
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
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving team:', err);
    }
  }

  public async deleteTeam(teamId: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM teams WHERE id = $1', [teamId]);
    } catch (err) {
      console.error('[PostgreSQL] Error deleting team:', err);
    }
  }

  public async saveSubmission(sub: SubmissionRecord): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `
        INSERT INTO submissions (id, team_id, challenge_id, submitted_flag, is_correct, submitted_at, ip)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING;
        `,
        [
          sub.id,
          sub.teamId,
          sub.challengeId,
          sub.submittedFlag,
          sub.isCorrect ? 1 : 0,
          sub.timestamp,
          sub.ip,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving submission:', err);
    }
  }

  public async saveActivity(event: ActivityFeedEvent): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `
        INSERT INTO activity_feed (id, event_data, timestamp)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING;
        `,
        [event.id, JSON.stringify(event), event.timestamp]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving activity event:', err);
    }
  }

  public async saveFeedback(fb: FeedbackSubmission): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `
        INSERT INTO user_feedbacks (
          id, team_id, team_name, rating_ui, challenge_difficulty, platform_stability,
          fair_play_security, clarity_rules_hints, favorite_highlight, suggestions_round3, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING;
        `,
        [
          fb.id,
          fb.teamId,
          fb.teamName,
          fb.ratingUi,
          fb.challengeDifficulty,
          fb.platformStability,
          fb.fairPlaySecurity,
          fb.clarityRulesHints,
          fb.favoriteHighlight || '',
          fb.suggestionsRound3 || '',
          fb.submittedAt,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving feedback:', err);
    }
  }

  public async saveCompetitionConfig(config: CompetitionState): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `
        INSERT INTO competition_config (id, config_data, updated_at)
        VALUES ('singleton_config', $1, $2)
        ON CONFLICT (id) DO UPDATE SET config_data = EXCLUDED.config_data, updated_at = EXCLUDED.updated_at;
        `,
        [JSON.stringify(config), Date.now()]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving competition config:', err);
    }
  }

  public async loadCompetitionConfig(): Promise<CompetitionState | null> {
    if (!this.pool || !this.isConnected) return null;
    try {
      const res = await this.pool.query("SELECT config_data FROM competition_config WHERE id = 'singleton_config'");
      if (res.rows.length > 0 && res.rows[0].config_data) {
        return JSON.parse(res.rows[0].config_data);
      }
      return null;
    } catch (err) {
      console.error('[PostgreSQL] Error loading competition config:', err);
      return null;
    }
  }
}

export const postgresSync = new PostgresSyncManager();
