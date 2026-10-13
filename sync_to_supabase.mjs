import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read DATABASE_URL from CLI argument, process.env, or .env file
let dbUrl = process.argv[2] || process.env.DATABASE_URL;

if (!dbUrl && fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (match) dbUrl = match[1];
}

if (!dbUrl) {
  console.log('\n======================================================================');
  console.log(' SUPABASE POSTGRESQL INITIALIZATION & LOCAL TEAMS SYNC TOOL');
  console.log('======================================================================');
  console.log('\nUsage:');
  console.log('  node sync_to_supabase.mjs "<YOUR_SUPABASE_CONNECTION_STRING>"');
  console.log('\nExample (Connection Pooler):');
  console.log('  node sync_to_supabase.mjs "postgresql://postgres.ref:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"\n');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl.trim(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {
  console.log('\nConnecting to PostgreSQL database...');
  const client = await pool.connect();
  console.log('Connected successfully!\n');

  try {
    console.log('[1/3] Creating all required tables in Supabase...');
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

      CREATE TABLE IF NOT EXISTS activity_feed (
        id TEXT PRIMARY KEY,
        event_data TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS competition_state (
        id TEXT PRIMARY KEY,
        config_data TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS security_logs (
        id TEXT PRIMARY KEY,
        log_data TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        log_data TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        team_name TEXT NOT NULL,
        feedback_data TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS screenshot_alerts (
        id TEXT PRIMARY KEY,
        alert_data TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );
    `);
    console.log(' All tables and indexes verified/created in Supabase!\n');

    console.log('[2/3] Reading local teams from data/teams.json...');
    const teamsPath = path.join(__dirname, 'data', 'teams.json');
    if (!fs.existsSync(teamsPath)) {
      console.log('No data/teams.json found on this machine.');
      return;
    }

    const rawTeams = fs.readFileSync(teamsPath, 'utf-8');
    const teams = JSON.parse(rawTeams);
    console.log(`Found ${teams.length} local registered teams.\n`);

    console.log('[3/3] Uploading teams to Supabase PostgreSQL...');
    let inserted = 0;
    for (const t of teams) {
      await client.query(
        `
        INSERT INTO teams (
          id, team_name, email, password_hash, password_salt, members, score,
          solves, hints_unlocked, failed_attempts, total_failed_attempts,
          last_solve_time, registered_at, ip, strikes, is_disqualified,
          disqualified_reason, disqualified_at, is_flagged_anomaly,
          anomaly_reason, has_started, started_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22
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
          t.id,
          t.teamName,
          t.email || null,
          t.passwordHash || null,
          t.passwordSalt || null,
          JSON.stringify(t.members || []),
          t.score || 0,
          JSON.stringify(t.solves || {}),
          JSON.stringify(t.hintsUnlocked || {}),
          JSON.stringify(t.failedAttempts || {}),
          t.totalFailedAttempts || 0,
          t.lastSolveTime || 0,
          t.registeredAt || Date.now(),
          t.ip || '127.0.0.1',
          t.strikes || 0,
          t.isDisqualified ? 1 : 0,
          t.disqualifiedReason || null,
          t.disqualifiedAt || null,
          t.isFlaggedAnomaly ? 1 : 0,
          t.anomalyReason || null,
          t.hasStarted ? 1 : 0,
          t.startedAt || null,
        ]
      );
      inserted++;
      console.log(`  Synced team [${t.teamName}] (ID: ${t.id})`);
    }

    console.log(`\n SUCCESS: ${inserted} teams successfully synced to Supabase PostgreSQL!`);

    console.log('\n[4/4] Syncing 20 CTF challenges from questions.json to Supabase...');
    const questionsPath = path.join(__dirname, 'questions.json');
    if (fs.existsSync(questionsPath)) {
      const rawQuestions = fs.readFileSync(questionsPath, 'utf-8');
      const questions = JSON.parse(rawQuestions);

      await client.query(`
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS title TEXT;
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS section TEXT;
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS category TEXT;
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS points INTEGER;
        ALTER TABLE challenges ADD COLUMN IF NOT EXISTS difficulty TEXT;
      `);

      let chalCount = 0;
      for (const q of questions) {
        await client.query(
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
            q.id,
            q.title,
            q.section,
            q.category,
            q.points,
            q.difficulty,
            JSON.stringify(q),
            Date.now(),
          ]
        );
        chalCount++;
      }
      console.log(` ✓ Successfully synced all ${chalCount} challenges into Supabase challenges table!\n`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\nSync failed with error:', err);
  process.exit(1);
});
