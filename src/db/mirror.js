// Optional DB mirror. SQLite stays the source of truth; when MONGO_URI and/or
// DATABASE_URL (Postgres) are set, key records (balances, infractions) get
// ALSO written there — for backups/analytics. Everything here is best-effort:
// it connects lazily, never throws, and if a driver isn't installed or a URI
// isn't set that backend just stays off. The live bot never depends on this.
import { MONGO_URI, MONGO_DB, DATABASE_URL } from '../config.js';

let mongoColl = null; // resolved Db-ish helper once connected
let mongoTried = false;
let pgPool = null;
let pgReady = null; // Promise that resolves once tables exist
let pgTried = false;

const warnOnce = (() => {
  const seen = new Set();
  return (key, msg) => { if (!seen.has(key)) { seen.add(key); console.warn(msg); } };
})();

async function getMongo() {
  if (!MONGO_URI) return null;
  if (mongoColl || mongoTried) return mongoColl;
  mongoTried = true;
  try {
    const { MongoClient } = await import('mongodb'); // optional dep
    const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    mongoColl = client.db(MONGO_DB || 'sentinel');
    console.log('✅ Mongo mirror connected');
  } catch (err) {
    warnOnce('mongo', `⚠️ Mongo mirror off (${err.code === 'ERR_MODULE_NOT_FOUND' ? 'run: npm i mongodb' : err.message})`);
    mongoColl = null;
  }
  return mongoColl;
}

async function getPg() {
  if (!DATABASE_URL) return null;
  if (pgPool || pgTried) return pgReady ? (await pgReady, pgPool) : pgPool;
  pgTried = true;
  try {
    const pg = await import('pg');
    const Pool = pg.default?.Pool || pg.Pool;
    pgPool = new Pool({ connectionString: DATABASE_URL, max: 3, connectionTimeoutMillis: 5000 });
    pgReady = (async () => {
      for (const t of ['balances', 'infractions']) {
        await pgPool.query(
          `CREATE TABLE IF NOT EXISTS mirror_${t} (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())`,
        );
      }
      console.log('✅ Postgres mirror connected');
    })();
    await pgReady;
  } catch (err) {
    warnOnce('pg', `⚠️ Postgres mirror off (${err.message})`);
    pgPool = null;
  }
  return pgPool;
}

// Upsert one record into both mirrors. collection: 'balances' | 'infractions'.
// Fire-and-forget; callers don't await. Never throws.
export function mirror(collection, id, doc) {
  if (!MONGO_URI && !DATABASE_URL) return; // nothing configured — skip fast
  const key = String(id);
  const payload = { ...doc, _mirroredAt: new Date().toISOString() };
  (async () => {
    try {
      const m = await getMongo();
      if (m) await m.collection(collection).updateOne({ _id: key }, { $set: payload }, { upsert: true });
    } catch (err) { warnOnce('mongo-write', `⚠️ Mongo mirror write failed: ${err.message}`); }
  })();
  (async () => {
    try {
      const p = await getPg();
      if (p) {
        await p.query(
          `INSERT INTO mirror_${collection} (id, data, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = now()`,
          [key, JSON.stringify(payload)],
        );
      }
    } catch (err) { warnOnce('pg-write', `⚠️ Postgres mirror write failed: ${err.message}`); }
  })();
}

// Warm the connections at boot so the "connected" logs show up early (optional).
export function initMirror() {
  if (MONGO_URI) getMongo();
  if (DATABASE_URL) getPg();
}
