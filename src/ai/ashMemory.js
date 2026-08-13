// Ash's long-term, per-member memory.
//
// This is separate from the in-memory, per-channel chat history in ash.js — that
// forgets on restart and only covers the current conversation. This module persists
// durable FACTS about each user (their name, interests, role, pronouns, projects,
// preferences) so Ash genuinely "remembers" people across conversations and reboots.
//
// Facts are extracted by the model itself (it emits a [MEMORY] directive when it
// learns something lasting) and stored as a small JSON array per (guild, user).
import { getDb } from '../db/index.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS ash_profiles (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  username   TEXT,
  facts      TEXT NOT NULL DEFAULT '[]',   -- JSON array of short strings
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
)`);

const stmt = {
  get: db.prepare('SELECT * FROM ash_profiles WHERE guild_id=? AND user_id=?'),
  byName: db.prepare('SELECT * FROM ash_profiles WHERE guild_id=? AND lower(username)=lower(?) ORDER BY updated_at DESC LIMIT 1'),
  up: db.prepare(`INSERT INTO ash_profiles(guild_id,user_id,username,facts,updated_at) VALUES (?,?,?,?,?)
                  ON CONFLICT(guild_id,user_id) DO UPDATE SET username=excluded.username, facts=excluded.facts, updated_at=excluded.updated_at`),
  del: db.prepare('DELETE FROM ash_profiles WHERE guild_id=? AND user_id=?'),
};

const MAX_FACTS = 30;   // keep profiles small — Ash isn't a dossier
const FACT_LEN = 160;

function parse(row) {
  if (!row) return null;
  let facts = [];
  try { facts = JSON.parse(row.facts) || []; } catch { /* corrupt → empty */ }
  return { guildId: row.guild_id, userId: row.user_id, username: row.username, facts, updatedAt: row.updated_at };
}

export function getProfile(guildId, userId) {
  if (!guildId || !userId) return null;
  return parse(stmt.get.get(String(guildId), String(userId)));
}

export function getProfileByName(guildId, username) {
  if (!guildId || !username) return null;
  return parse(stmt.byName.get(String(guildId), String(username)));
}

// Merge new facts in, de-duplicated (case-insensitive). Oldest drop off when full.
export function recordFacts(guildId, userId, username, newFacts) {
  if (!guildId || !userId) return;
  const clean = (Array.isArray(newFacts) ? newFacts : [])
    .map((f) => String(f || '').trim().replace(/\s+/g, ' ').slice(0, FACT_LEN))
    .filter((f) => f.length > 1);
  if (!clean.length) return;
  const existing = getProfile(guildId, userId)?.facts || [];
  const seen = new Set(existing.map((f) => f.toLowerCase()));
  const merged = [...existing];
  for (const f of clean) {
    const k = f.toLowerCase();
    if (!seen.has(k)) { seen.add(k); merged.push(f); }
  }
  while (merged.length > MAX_FACTS) merged.shift();
  stmt.up.run(String(guildId), String(userId), String(username || '').slice(0, 80), JSON.stringify(merged), Date.now());
}

export function clearProfile(guildId, userId) {
  if (!guildId || !userId) return;
  stmt.del.run(String(guildId), String(userId));
}

// A compact bullet block to inject into Ash's context (empty string if nothing known).
export function profileSummary(guildId, userId) {
  const p = getProfile(guildId, userId);
  if (!p || !p.facts.length) return '';
  return p.facts.map((f) => `- ${f}`).join('\n');
}
