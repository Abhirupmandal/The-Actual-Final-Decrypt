import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import type { Request, Response } from 'express';

// Redis Client or In-Memory Redis Engine Adapter for rate-limit-redis
let sendCommandFn: ((...args: string[]) => Promise<any>);

if (process.env.REDIS_URL) {
  try {
    const redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.connect().catch((err) => {
      console.warn('[Redis] Connection warning, falling back to embedded Redis adapter:', err.message);
    });
    sendCommandFn = async (...args: string[]) => {
      const [cmd, ...rest] = args;
      return redis.call(cmd, ...rest);
    };
  } catch (e) {
    console.warn('[Redis] Failed to initialize external Redis client, using embedded adapter');
  }
}

if (!sendCommandFn!) {
  // High-performance embedded Redis engine implementing raw Redis protocol commands
  // required by rate-limit-redis (SCRIPT LOAD, EVALSHA, DECR, DEL)
  const memoryStore = new Map<string, { hits: number; resetTime: number }>();
  let shaSeq = 1;

  sendCommandFn = async (...args: string[]) => {
    const [command, ...params] = args;
    const now = Date.now();

    if (command === 'SCRIPT' && params[0] === 'LOAD') {
      return `sha_${shaSeq++}`;
    }

    if (command === 'EVALSHA') {
      // params: [sha, numKeys, key, windowMs]
      const key = params[2];
      const windowMs = Number(params[3]) || 10000;

      let entry = memoryStore.get(key);
      if (!entry || now > entry.resetTime) {
        entry = { hits: 1, resetTime: now + windowMs };
      } else {
        entry.hits++;
      }
      memoryStore.set(key, entry);

      const ttlMs = Math.max(0, entry.resetTime - now);
      return [entry.hits, ttlMs];
    }

    if (command === 'DECR') {
      const key = params[0];
      const entry = memoryStore.get(key);
      if (entry) {
        entry.hits = Math.max(0, entry.hits - 1);
        return entry.hits;
      }
      return 0;
    }

    if (command === 'DEL') {
      memoryStore.delete(params[0]);
      return 1;
    }

    return null;
  };
}

// 1.) Rate limiter for /api/submit-flag: Max 5 attempts per 10 seconds per team
export function createFlagSubmissionRateLimiter(
  onRateLimitViolation?: (ip: string, teamName?: string) => void
) {
  return rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    limit: 5, // Maximum 5 attempts
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: false,
    store: new RedisStore({
      prefix: 'rl:ctf:flag:',
      sendCommand: sendCommandFn,
    }),
    keyGenerator: (req: Request) => {
      const team = (req as any).team;
      if (team && team.id) {
        return `team:${team.id}`;
      }
      const tokenPayload = (req as any).tokenPayload;
      if (tokenPayload && tokenPayload.subjectId) {
        return `team:${tokenPayload.subjectId}`;
      }
      return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    },
    handler: (req: Request, res: Response) => {
      const team = (req as any).team;
      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

      if (onRateLimitViolation) {
        onRateLimitViolation(ip, team?.teamName);
      }

      res.status(429).json({
        success: false,
        error: 'RATE LIMIT: Maximum 5 flag attempts per 10 seconds allowed per team. System cooldown active.',
      });
    },
  });
}

// 2.) Rate limiter for /api/auth endpoints: Max 5 attempts per 10 seconds per team / client
export function createAuthRateLimiter(
  onRateLimitViolation?: (ip: string, targetName?: string) => void
) {
  return rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    limit: 5, // Maximum 5 attempts
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: false,
    store: new RedisStore({
      prefix: 'rl:ctf:auth:',
      sendCommand: sendCommandFn,
    }),
    keyGenerator: (req: Request) => {
      const teamName = req.body?.teamName;
      if (typeof teamName === 'string' && teamName.trim()) {
        return `team:${teamName.trim().toLowerCase()}`;
      }
      return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    },
    handler: (req: Request, res: Response) => {
      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const target = req.body?.teamName || 'admin_login';

      if (onRateLimitViolation) {
        onRateLimitViolation(ip, target);
      }

      res.status(429).json({
        success: false,
        error: 'RATE LIMIT: Maximum 5 authentication attempts per 10 seconds allowed. Cooldown active.',
      });
    },
  });
}
