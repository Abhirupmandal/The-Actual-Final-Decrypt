import Redis from 'ioredis';

export interface RedisZSetMember {
  member: string;
  score: number;
}

// High-Performance Redis / In-Memory Cache for 100+ Concurrent Teams & Load Balancing
class RedisCacheService {
  private redisClient: Redis | null = null;
  private localCache = new Map<string, { data: any; expiry: number }>();
  private zsets = new Map<string, Map<string, number>>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private serverNodeId: string;

  constructor() {
    this.serverNodeId = `node-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
    if (process.env.REDIS_URL) {
      try {
        this.redisClient = new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        });
        this.redisClient.connect().catch((err) => {
          console.warn('[RedisCache] Connection warning, using local high-speed cache:', err.message);
          this.redisClient = null;
        });
      } catch (e) {
        this.redisClient = null;
      }
    }
  }

  getNodeId(): string {
    return this.serverNodeId;
  }

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. Try Redis client if connected
    if (this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        if (val) {
          this.cacheHits++;
          return JSON.parse(val) as T;
        }
      } catch {
        // Fallback to local cache
      }
    }

    // 2. High-speed in-memory store
    const local = this.localCache.get(key);
    if (local && local.expiry > now) {
      this.cacheHits++;
      return local.data as T;
    }

    this.cacheMisses++;
    return null;
  }

  async set(key: string, data: any, ttlSeconds = 5): Promise<void> {
    const serialized = JSON.stringify(data);
    const expiry = Date.now() + ttlSeconds * 1000;

    this.localCache.set(key, { data, expiry });

    if (this.redisClient) {
      try {
        await this.redisClient.setex(key, ttlSeconds, serialized);
      } catch {
        // Continue with local cache
      }
    }
  }

  async invalidate(patternOrKey: string): Promise<void> {
    // Delete exact match or prefix
    for (const k of this.localCache.keys()) {
      if (k === patternOrKey || k.startsWith(patternOrKey)) {
        this.localCache.delete(k);
      }
    }

    if (this.redisClient) {
      try {
        await this.redisClient.del(patternOrKey);
      } catch {
        // Ignore
      }
    }
  }

  // --- Redis Sorted Set (ZSET) Operations for Scoreboards ---
  async zadd(key: string, score: number, member: string): Promise<void> {
    let set = this.zsets.get(key);
    if (!set) {
      set = new Map<string, number>();
      this.zsets.set(key, set);
    }
    set.set(member, score);

    if (this.redisClient) {
      try {
        await this.redisClient.zadd(key, score, member);
      } catch {
        // Fallback to in-memory
      }
    }
  }

  async zrevrangeWithScores(key: string, start = 0, stop = -1): Promise<RedisZSetMember[]> {
    if (this.redisClient) {
      try {
        const res = await this.redisClient.zrevrange(key, start, stop, 'WITHSCORES');
        const members: RedisZSetMember[] = [];
        for (let i = 0; i < res.length; i += 2) {
          members.push({ member: res[i], score: Number(res[i + 1]) });
        }
        return members;
      } catch {
        // Fallback to in-memory
      }
    }

    const set = this.zsets.get(key);
    if (!set) return [];

    const sorted = Array.from(set.entries())
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score);

    const end = stop === -1 ? sorted.length : stop + 1;
    return sorted.slice(start, end);
  }

  async zcard(key: string): Promise<number> {
    const set = this.zsets.get(key);
    return set ? set.size : 0;
  }

  async zrem(key: string, member: string): Promise<void> {
    const set = this.zsets.get(key);
    if (set) {
      set.delete(member);
    }
    if (this.redisClient) {
      try {
        await this.redisClient.zrem(key, member);
      } catch {
        // Fallback to in-memory
      }
    }
  }

  getMetrics() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? ((this.cacheHits / total) * 100).toFixed(1) + '%' : '100%';
    return {
      nodeId: this.serverNodeId,
      connectedToRedis: Boolean(this.redisClient),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate,
      keysInMemory: this.localCache.size,
      zsetKeysCount: this.zsets.size,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 10) / 10,
    };
  }

  async runBenchmark(iterations = 100): Promise<{ durationMs: number; opsPerSec: number }> {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await this.set(`bench:key:${i}`, { iter: i, timestamp: Date.now() }, 10);
      await this.get(`bench:key:${i}`);
    }
    const durationMs = Math.max(1, performance.now() - start);
    const opsPerSec = Math.round((iterations * 2 / durationMs) * 1000);
    return { durationMs: Math.round(durationMs), opsPerSec };
  }
}

export const redisCache = new RedisCacheService();
