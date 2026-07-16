// Caching layer. Uses Redis (ioredis) when REDIS_URL is set, otherwise an
// in-process Map with TTL support. The public API is identical either way, so
// the rest of the bot never cares which backend is live. Includes a Lua-style
// atomic rate-limiter (run server-side on Redis; emulated in-process locally).
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

// ---- in-memory fallback ----
class MemoryCache {
  constructor() {
    this.store = new Map(); // key -> { value, expires }
  }
  _alive(entry) {
    if (!entry) return false;
    if (entry.expires && entry.expires < Date.now()) return false;
    return true;
  }
  async get(key) {
    const e = this.store.get(key);
    if (!this._alive(e)) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }
  async set(key, value, ttlSeconds) {
    this.store.set(key, { value: String(value), expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
    return 'OK';
  }
  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }
  async incrBy(key, amount) {
    const cur = parseInt((await this.get(key)) ?? '0', 10);
    const next = cur + amount;
    const e = this.store.get(key);
    this.store.set(key, { value: String(next), expires: e?.expires ?? 0 });
    return next;
  }
  // Atomic-ish fixed-window rate limit: returns true if allowed.
  async rateLimit(key, max, windowSeconds) {
    const e = this.store.get(key);
    if (!this._alive(e)) {
      this.store.set(key, { value: '1', expires: Date.now() + windowSeconds * 1000 });
      return true;
    }
    const count = parseInt(e.value, 10) + 1;
    e.value = String(count);
    return count <= max;
  }
}

// ---- Redis-backed cache ----
class RedisCache {
  constructor(client) {
    this.r = client;
  }
  async get(key) {
    return this.r.get(key);
  }
  async set(key, value, ttlSeconds) {
    return ttlSeconds ? this.r.set(key, String(value), 'EX', ttlSeconds) : this.r.set(key, String(value));
  }
  async del(key) {
    return this.r.del(key);
  }
  async incrBy(key, amount) {
    return this.r.incrby(key, amount);
  }
  // Fixed-window rate limit executed atomically server-side via a Lua script.
  async rateLimit(key, max, windowSeconds) {
    const script = `
      local c = redis.call('INCR', KEYS[1])
      if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
      if c > tonumber(ARGV[1]) then return 0 else return 1 end`;
    const ok = await this.r.eval(script, 1, key, max, windowSeconds);
    return ok === 1;
  }
}

let cache;
let backend;
if (REDIS_URL) {
  const client = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 });
  client.on('error', (e) => console.error('Redis error:', e.message));
  cache = new RedisCache(client);
  backend = 'redis';
} else {
  cache = new MemoryCache();
  backend = 'memory';
}

export { cache };
export const CACHE_BACKEND = backend;
