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
            actor_type TEXT,
            actor_identifier TEXT,
            action_type TEXT,
            details TEXT,
            ip_address TEXT,
            timestamp_ms BIGINT,
            log_data TEXT NOT NULL,
            timestamp BIGINT NOT NULL
          );
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_identifier TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS timestamp_ms BIGINT;

          CREATE TABLE IF NOT EXISTS security_logs (
            id TEXT PRIMARY KEY,
            team_name TEXT,
            ip TEXT,
            type TEXT,
            details TEXT,
            severity TEXT,
            log_data TEXT NOT NULL,
            timestamp BIGINT NOT NULL
          );
          ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS team_name TEXT;
          ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS ip TEXT;
          ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS type TEXT;
          ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS details TEXT;
          ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS severity TEXT;

          CREATE TABLE IF NOT EXISTS screenshot_alerts (
            id TEXT PRIMARY KEY,
            team_id TEXT,
            team_name TEXT,
            email TEXT,
            ip TEXT,
            trigger_key TEXT,
            details TEXT,
            alert_data TEXT NOT NULL,
            timestamp BIGINT NOT NULL
          );
          ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS team_id TEXT;
          ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS team_name TEXT;
          ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS email TEXT;
          ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS ip TEXT;
          ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS trigger_key TEXT;
          ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS details TEXT;

          CREATE TABLE IF NOT EXISTS challenges (
            id TEXT PRIMARY KEY,
            title TEXT,
            section TEXT,
            category TEXT,
            points INTEGER,
            difficulty TEXT,
            data TEXT NOT NULL,
            updated_at BIGINT NOT NULL
          );
          ALTER TABLE challenges ADD COLUMN IF NOT EXISTS title TEXT;
          ALTER TABLE challenges ADD COLUMN IF NOT EXISTS section TEXT;
          ALTER TABLE challenges ADD COLUMN IF NOT EXISTS category TEXT;
          ALTER TABLE challenges ADD COLUMN IF NOT EXISTS points INTEGER;
          ALTER TABLE challenges ADD COLUMN IF NOT EXISTS difficulty TEXT;
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

  public async saveScreenshotAlert(alert: ScreenshotAlert): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(`
        ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS team_id TEXT;
        ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS team_name TEXT;
        ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS email TEXT;
        ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS ip TEXT;
        ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS trigger_key TEXT;
        ALTER TABLE screenshot_alerts ADD COLUMN IF NOT EXISTS details TEXT;
      `);

      await this.pool.query(
        `
        INSERT INTO screenshot_alerts (
          id, team_id, team_name, email, ip, trigger_key, details, alert_data, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          team_id = EXCLUDED.team_id,
          team_name = EXCLUDED.team_name,
          email = EXCLUDED.email,
          ip = EXCLUDED.ip,
          trigger_key = EXCLUDED.trigger_key,
          details = EXCLUDED.details,
          alert_data = EXCLUDED.alert_data,
          timestamp = EXCLUDED.timestamp;
        `,
        [
          alert.id,
          alert.teamId,
          alert.teamName,
          alert.email || null,
          alert.ip,
          alert.triggerKey || null,
          alert.details,
          JSON.stringify(alert),
          alert.timestamp,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving screenshot alert:', err);
    }
  }

  public async saveSecurityLog(log: SecurityLog): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(`
        ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS team_name TEXT;
        ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS ip TEXT;
        ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS type TEXT;
        ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS details TEXT;
        ALTER TABLE security_logs ADD COLUMN IF NOT EXISTS severity TEXT;
      `);

      await this.pool.query(
        `
        INSERT INTO security_logs (
          id, team_name, ip, type, details, severity, log_data, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          team_name = EXCLUDED.team_name,
          ip = EXCLUDED.ip,
          type = EXCLUDED.type,
          details = EXCLUDED.details,
          severity = EXCLUDED.severity,
          log_data = EXCLUDED.log_data,
          timestamp = EXCLUDED.timestamp;
        `,
        [
          log.id,
          log.teamName || null,
          log.ip,
          log.type,
          log.details,
          log.severity,
          JSON.stringify(log),
          log.timestamp,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving security log:', err);
    }
  }

  public async saveAuditLog(log: AuditLog): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(`
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type TEXT;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_identifier TEXT;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_type TEXT;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS timestamp_ms BIGINT;
      `);

      await this.pool.query(
        `
        INSERT INTO audit_logs (
          id, actor_type, actor_identifier, action_type, details, ip_address, timestamp_ms, log_data, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          actor_type = EXCLUDED.actor_type,
          actor_identifier = EXCLUDED.actor_identifier,
          action_type = EXCLUDED.action_type,
          details = EXCLUDED.details,
          ip_address = EXCLUDED.ip_address,
          timestamp_ms = EXCLUDED.timestamp_ms,
          log_data = EXCLUDED.log_data,
          timestamp = EXCLUDED.timestamp;
        `,
        [
          log.logId,
          log.actorType,
          log.actorIdentifier,
          log.actionType,
          log.details,
          log.ipAddress,
          log.timestampMs,
          JSON.stringify(log),
          log.timestampMs,
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving audit log:', err);
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

  public async syncChallenges(challengesList: Challenge[]): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(`
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS title TEXT;
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS section TEXT;
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS category TEXT;
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS points INTEGER;
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS difficulty TEXT;
      `);

      for (const chal of challengesList) {
        await this.pool.query(
          `
          INSERT INTO challenges (id, title, section, category, points, difficulty, data, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            section = EXCLUDED.section,
            category = EXCLUDED.category,
            points = EXCLUDED.points,
            difficulty = EXCLUDED.difficulty,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at;
          `,
          [
            chal.id,
            chal.title,
            chal.section,
            chal.category,
            chal.points,
            chal.difficulty,
            JSON.stringify(chal),
            Date.now(),
          ]
        );
      }
      console.log(`[PostgreSQL] Synchronized all ${challengesList.length} challenges into Supabase challenges table.`);
    } catch (err) {
      console.error('[PostgreSQL] Error syncing challenges:', err);
    }
  }

  public async saveChallenge(chal: Challenge): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `
        INSERT INTO challenges (id, title, section, category, points, difficulty, data, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          section = EXCLUDED.section,
          category = EXCLUDED.category,
          points = EXCLUDED.points,
          difficulty = EXCLUDED.difficulty,
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at;
        `,
        [
          chal.id,
          chal.title,
          chal.section,
          chal.category,
          chal.points,
          chal.difficulty,
          JSON.stringify(chal),
          Date.now(),
        ]
      );
    } catch (err) {
      console.error('[PostgreSQL] Error saving challenge:', err);
    }
  }

  public async deleteChallenge(id: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM challenges WHERE id = $1', [id]);
    } catch (err) {
      console.error('[PostgreSQL] Error deleting challenge:', err);
    }
  }

  public async deleteScreenshotAlert(id: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM screenshot_alerts WHERE id = $1', [id]);
    } catch (err) {
      console.error('[PostgreSQL] Error deleting screenshot alert:', err);
    }
  }

  public async clearScreenshotAlerts(): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM screenshot_alerts');
    } catch (err) {
      console.error('[PostgreSQL] Error clearing screenshot alerts:', err);
    }
  }

  public async clearSecurityLogs(): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM security_logs');
    } catch (err) {
      console.error('[PostgreSQL] Error clearing security logs:', err);
    }
  }

  public async wipeAll(): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(`
        TRUNCATE TABLE teams, submissions, activity_feed, screenshot_alerts, security_logs, audit_logs, user_feedbacks CASCADE;
      `);
      console.log('[PostgreSQL] Successfully wiped all runtime tables in Supabase.');
    } catch (err) {
      console.error('[PostgreSQL] Error wiping tables in Supabase:', err);
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

  public async loadAuditLogs(limit = 2000): Promise<AuditLog[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query(
        'SELECT * FROM audit_logs ORDER BY COALESCE(timestamp_ms, timestamp) DESC LIMIT $1',
        [limit]
      );
      return res.rows.map((r) => {
        if (r.log_data) {
          try {
            return JSON.parse(r.log_data);
          } catch {}
        }
        return {
          logId: String(r.id),
          actorType: String(r.actor_type || 'SYSTEM') as any,
          actorIdentifier: String(r.actor_identifier || 'SYSTEM'),
          actionType: String(r.action_type || 'SYSTEM_INFO') as any,
          details: String(r.details || '{}'),
          ipAddress: String(r.ip_address || '127.0.0.1'),
          timestamp: new Date(Number(r.timestamp_ms || r.timestamp || Date.now())).toISOString(),
          timestampMs: Number(r.timestamp_ms || r.timestamp || Date.now()),
        };
      });
    } catch (err) {
      console.error('[PostgreSQL] Error loading audit logs:', err);
      return [];
    }
  }

  public async loadActivityFeed(limit = 300): Promise<ActivityFeedEvent[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT * FROM activity_feed ORDER BY timestamp DESC LIMIT $1', [limit]);
      return res.rows.map((r) => {
        if (r.event_data) {
          try {
            return JSON.parse(r.event_data);
          } catch {}
        }
        return {
          id: String(r.id),
          timestamp: Number(r.timestamp),
          type: 'FLAG_SOLVE' as any,
          teamName: 'Team',
          message: 'CTF Event',
        };
      });
    } catch (err) {
      console.error('[PostgreSQL] Error loading activity feed:', err);
      return [];
    }
  }

  public async loadSecurityLogs(limit = 300): Promise<SecurityLog[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT * FROM security_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
      return res.rows.map((r) => {
        if (r.log_data) {
          try {
            return JSON.parse(r.log_data);
          } catch {}
        }
        return {
          id: String(r.id),
          timestamp: Number(r.timestamp),
          teamName: r.team_name ? String(r.team_name) : undefined,
          ip: String(r.ip || '127.0.0.1'),
          type: (r.type || 'SYSTEM_INFO') as any,
          details: String(r.details || ''),
          severity: (r.severity || 'low') as any,
        };
      });
    } catch (err) {
      console.error('[PostgreSQL] Error loading security logs:', err);
      return [];
    }
  }

  public async loadSubmissions(): Promise<SubmissionRecord[]> {
    if (!this.pool || !this.isConnected) return [];
    try {
      const res = await this.pool.query('SELECT * FROM submissions ORDER BY submitted_at ASC');
      return res.rows.map((row) => ({
        id: String(row.id),
        teamId: String(row.team_id),
        teamName: '',
        challengeId: String(row.challenge_id),
        challengeTitle: '',
        submittedFlag: String(row.submitted_flag),
        isCorrect: Boolean(row.is_correct),
        pointsAwarded: 0,
        timestamp: Number(row.submitted_at),
        ip: String(row.ip),
      }));
    } catch (err) {
      console.error('[PostgreSQL] Error loading submissions:', err);
      return [];
    }
  }
}

export const postgresSync = new PostgresSyncManager();

