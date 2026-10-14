// Redis-Grade Sliding Window & Token Bucket Rate Limiter
interface Bucket {
  tokens: number;
  lastRefill: number;
  timestamps: number[];
  lockoutUntil?: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  cooldownUntil?: number;
  reason?: string;
}

export const RATE_LIMIT_CONFIGS = {
  // Flag submission: Max 5 attempts per 10 seconds per team
  FLAG_SUBMISSION: { max: 5, windowMs: 10000, lockoutMs: 10000 },
  // Admin Login: Max 5 attempts per 60 seconds per IP (protects master passkey)
  ADMIN_LOGIN: { max: 5, windowMs: 60000, lockoutMs: 300000 },
  // Team Auth: Max 1000 attempts per 60 seconds per IP (supports 300+ to 1000+ teams logging in simultaneously on shared campus Wi-Fi/NAT)
  TEAM_AUTH: { max: 1000, windowMs: 60000, lockoutMs: 15000 },
  // Global API: Max 6000 requests per minute per IP (protects shared campus NAT/Wi-Fi with 300+ concurrent active student devices)
  GLOBAL_API: { max: 6000, windowMs: 60000, lockoutMs: 15000 },
};

// Periodic Memory Eviction: Purge inactive buckets every 5 minutes to maintain negligible memory footprint
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets.entries()) {
    const isLocked = b.lockoutUntil && now < b.lockoutUntil;
    const hasRecentActivity = b.timestamps.some((ts) => now - ts < 120000);
    if (!isLocked && !hasRecentActivity) {
      buckets.delete(key);
    }
  }
}, 300000).unref();

export function checkRateLimitTier(
  tierName: keyof typeof RATE_LIMIT_CONFIGS,
  identifier: string
): RateLimitResult {
  const config = RATE_LIMIT_CONFIGS[tierName];
  const bucketKey = `${tierName}:${identifier}`;
  const now = Date.now();

  let bucket = buckets.get(bucketKey);
  if (!bucket) {
    bucket = { tokens: config.max, lastRefill: now, timestamps: [] };
    buckets.set(bucketKey, bucket);
  }

  // Check active lockout
  if (bucket.lockoutUntil && now < bucket.lockoutUntil) {
    const remainingLockout = Math.ceil((bucket.lockoutUntil - now) / 1000);
    return {
      allowed: false,
      limit: config.max,
      remaining: 0,
      resetSeconds: remainingLockout,
      cooldownUntil: bucket.lockoutUntil,
      reason: `IP/Session quarantined. Cooldown active for ${remainingLockout}s.`,
    };
  }

  // Filter timestamps outside window
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < config.windowMs);

  if (bucket.timestamps.length >= config.max) {
    // Initiate lockout penalty
    bucket.lockoutUntil = now + config.lockoutMs;
    const cooldownSecs = Math.ceil(config.lockoutMs / 1000);
    return {
      allowed: false,
      limit: config.max,
      remaining: 0,
      resetSeconds: cooldownSecs,
      cooldownUntil: bucket.lockoutUntil,
      reason: `Rate limit threshold exceeded (${config.max} in ${config.windowMs / 1000}s). Cooldown engaged.`,
    };
  }

  bucket.timestamps.push(now);
  const remaining = config.max - bucket.timestamps.length;
  const oldest = bucket.timestamps[0] || now;
  const resetSeconds = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1000));

  return {
    allowed: true,
    limit: config.max,
    remaining,
    resetSeconds,
  };
}
