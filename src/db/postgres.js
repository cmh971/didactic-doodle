// Optional PostgreSQL pool (async) for the web dashboard / analytics / scale.
// Activates only when DATABASE_URL is set. Includes exponential-backoff connect
// and a query wrapper with retry, so a transient DB blip won't crash callers.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

let pool = null;

export function hasPostgres() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!hasPostgres()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (e) => console.error('Postgres pool error:', e.message));
  }
  return pool;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Query with exponential backoff (handles brief outages / failovers).
export async function query(text, params = [], { retries = 4 } = {}) {
  const p = getPool();
  if (!p) throw new Error('PostgreSQL is not configured (set DATABASE_URL).');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await p.query(text, params);
    } catch (err) {
      lastErr = err;
      const backoff = Math.min(2000, 100 * 2 ** attempt) + Math.random() * 100;
      console.warn(`Postgres query failed (attempt ${attempt + 1}), retrying in ${Math.round(backoff)}ms: ${err.message}`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// Apply schema.sql (idempotent — uses IF NOT EXISTS everywhere).
export async function migrate() {
  if (!hasPostgres()) return false;
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
  return true;
}
