// Lightweight per-guild analytics — daily counters for joins, leaves, and messages.
//
// One row per (guild, day). Bumping is a single upsert, so it's cheap enough to
// call on every message. Everything is wrapped: analytics must never throw into
// a hot path (a message handler, a member event) and take the bot down.
import { getDb } from '../db/index.js';

const FIELDS = new Set(['joins', 'leaves', 'messages']);

let bumpStmts = null;
let seriesStmt = null;
let totalsStmt = null;
let ok = false;

try {
  const db = getDb();
  db.exec(`
CREATE TABLE IF NOT EXISTS analytics_daily (
  guild_id  TEXT NOT NULL,
  day       TEXT NOT NULL,           -- YYYY-MM-DD (UTC)
  joins     INTEGER NOT NULL DEFAULT 0,
  leaves    INTEGER NOT NULL DEFAULT 0,
  messages  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, day)
);
`);
  // One prepared upsert per field (field names can't be bound as parameters).
  bumpStmts = {};
  for (const f of FIELDS) {
    bumpStmts[f] = db.prepare(
      `INSERT INTO analytics_daily (guild_id, day, ${f}) VALUES (?, ?, 1)
       ON CONFLICT(guild_id, day) DO UPDATE SET ${f} = ${f} + 1`,
    );
  }
  seriesStmt = db.prepare(
    'SELECT day, joins, leaves, messages FROM analytics_daily WHERE guild_id = ? ORDER BY day DESC LIMIT ?',
  );
  totalsStmt = db.prepare(
    'SELECT COALESCE(SUM(joins),0) AS joins, COALESCE(SUM(leaves),0) AS leaves, COALESCE(SUM(messages),0) AS messages FROM analytics_daily WHERE guild_id = ?',
  );
  ok = true;
} catch (err) {
  console.error('⚠️ analytics disabled (DB init failed):', err?.message);
}

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Increment one counter for a guild's current day. Silently no-ops on any failure.
export function bump(guildId, field) {
  if (!ok || !guildId || !FIELDS.has(field)) return;
  try { bumpStmts[field].run(String(guildId), today()); } catch { /* ignore */ }
}

// Return the last `days` days of counters, oldest → newest, gap-filled with zeros
// so a chart always has a continuous x-axis.
export function series(guildId, days = 14) {
  const out = [];
  const byDay = new Map();
  if (ok && guildId) {
    try {
      for (const r of seriesStmt.all(String(guildId), days)) byDay.set(r.day, r);
    } catch { /* ignore */ }
  }
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    out.push({ day: key, joins: row?.joins || 0, leaves: row?.leaves || 0, messages: row?.messages || 0 });
  }
  return out;
}

// All-time totals for a guild.
export function totals(guildId) {
  if (!ok || !guildId) return { joins: 0, leaves: 0, messages: 0 };
  try { return totalsStmt.get(String(guildId)) || { joins: 0, leaves: 0, messages: 0 }; }
  catch { return { joins: 0, leaves: 0, messages: 0 }; }
}
