import crypto from 'crypto';

// Secret Management: Load from environment or derive secure in-memory entropy
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export interface SessionPayload {
  role: 'team' | 'admin';
  subjectId: string; // teamId or 'admin-master'
  issuedAt: number;
  expiresAt: number;
}

export function createSignedToken(role: 'team' | 'admin', subjectId: string, durationMs = 86400000): string {
  const payload: SessionPayload = {
    role,
    subjectId,
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

// PBKDF2 Password Hashing & Constant-Time Verification
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
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

