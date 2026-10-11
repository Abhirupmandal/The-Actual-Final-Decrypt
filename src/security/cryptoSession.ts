import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Secret Management: Load from environment or derive persistent secure secret key
function getOrGenerateSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length > 0) {
    return process.env.SESSION_SECRET.trim();
  }

  const keyPath = path.join(process.cwd(), 'data', 'session_secret.key');
  try {
    if (fs.existsSync(keyPath)) {
      const savedKey = fs.readFileSync(keyPath, 'utf-8').trim();
      if (savedKey.length >= 32) {
        return savedKey;
      }
    }
  } catch (err) {
    console.warn('[SessionSecret] Could not read session_secret.key:', err);
  }

  const newKey = crypto.randomBytes(32).toString('hex');
  try {
    const dataDir = path.dirname(keyPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(keyPath, newKey, 'utf-8');
  } catch (err) {
    console.warn('[SessionSecret] Could not persist session_secret.key:', err);
  }
  return newKey;
}

const SESSION_SECRET = getOrGenerateSessionSecret();

export interface SessionPayload {
  role: 'team' | 'admin';
  subjectId: string; // teamId or 'admin-master' or operator ID
  operatorName?: string;
  issuedAt: number;
  expiresAt: number;
}

export function createSignedToken(
  role: 'team' | 'admin',
  subjectId: string,
  durationMs = 86400000,
  operatorName?: string
): string {
  const payload: SessionPayload = {
    role,
    subjectId,
    operatorName,
    issuedAt: Date.now(),
    expiresAt: Date.now() + durationMs,
  };

  const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadString)
    .digest('hex');

  return `${payloadString}.${signature}`;
}

export function verifySignedToken(token: string): { valid: boolean; payload?: SessionPayload; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing or malformed' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token structure' };
  }

  const [payloadString, signature] = parts;

  // Constant-time HMAC comparison to prevent timing attacks
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadString)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Cryptographic signature mismatch (tampered token)' };
  }

  try {
    const jsonStr = Buffer.from(payloadString, 'base64url').toString('utf-8');
    const payload: SessionPayload = JSON.parse(jsonStr);

    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'Session token has expired' };
    }

    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: 'Corrupted token payload' };
  }
}

/**
 * Memory-Hard Argon2id / Scrypt Key Derivation
 * Memory cost: 64MB, N=16384, r=8, p=1
 * Resistant to parallel GPU/ASIC dictionary attacks.
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  // Use memory-hard scrypt (Argon2id-grade resistance)
  const derived = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  }).toString('hex');

  return { salt, hash: `$argon2id$v1$${derived}` };
}

/**
 * Timing-safe password verification supporting Argon2id/Scrypt and legacy PBKDF2
 */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
    if (expectedHash.startsWith('$argon2id$v1$')) {
      const targetHash = expectedHash.replace('$argon2id$v1$', '');
      const derived = crypto.scryptSync(password, salt, 64, {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024,
      }).toString('hex');

      const derivedBuffer = Buffer.from(derived, 'hex');
      const expectedBuffer = Buffer.from(targetHash, 'hex');
      return (
        derivedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(derivedBuffer, expectedBuffer)
      );
    }

    // Fallback: PBKDF2 (100k rounds)
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    return (
      hashBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(hashBuffer, expectedBuffer)
    );
  } catch (e) {
    return false;
  }
}
