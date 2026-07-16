// Central data-layer entry point.
//
// Runtime store = embedded SQLite (ACID, zero-config, synchronous) — always on.
// Optional PostgreSQL (DATABASE_URL) powers the web dashboard / analytics where
// an async, networked, multi-tenant DB is preferable. Optional Redis (REDIS_URL)
// fronts both as a cache + rate-limiter, falling back to in-process memory.
import { openSqlite } from './sqlite.js';
import { cache, CACHE_BACKEND } from './cache.js';

export function getDb() {
  return openSqlite();
}

export { cache, CACHE_BACKEND };

export const DB_INFO = {
  runtime: 'sqlite',
  postgres: Boolean(process.env.DATABASE_URL),
  cache: CACHE_BACKEND,
};
