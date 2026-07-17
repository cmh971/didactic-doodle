// Command usage tracking — the "flight recorder". Every command invocation
// (from Discord or the website) is logged so you can see what's popular.
// Wrapped so it can never throw into a command handler.
import { getDb } from '../db/index.js';

let ok = false;
let insertStmt, topStmt, recentStmt, totalStmt, sinceStmt, sourceStmt;

try {
  const db = getDb();
  db.exec(`
CREATE TABLE IF NOT EXISTS command_usage (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  guild_id TEXT,
  user_id  TEXT,
  source   TEXT NOT NULL DEFAULT 'discord',
  at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_usage_name ON command_usage(name);
CREATE INDEX IF NOT EXISTS idx_usage_at ON command_usage(at);
`);
  insertStmt = db.prepare('INSERT INTO command_usage(name, guild_id, user_id, source) VALUES (?, ?, ?, ?)');
  topStmt = db.prepare('SELECT name, COUNT(*) AS n FROM command_usage GROUP BY name ORDER BY n DESC LIMIT ?');
  recentStmt = db.prepare('SELECT name, guild_id, user_id, source, at FROM command_usage ORDER BY id DESC LIMIT ?');
  totalStmt = db.prepare('SELECT COUNT(*) AS n FROM command_usage');
  sinceStmt = db.prepare('SELECT COUNT(*) AS n FROM command_usage WHERE at >= ?');
  sourceStmt = db.prepare('SELECT source, COUNT(*) AS n FROM command_usage GROUP BY source');
  ok = true;
} catch (err) {
  console.error('⚠️ command usage tracking disabled:', err?.message);
}

/** Record a single command invocation. Never throws. */
export function track(name, { guildId = null, userId = null, source = 'discord' } = {}) {
  if (!ok || !name) return;
  try { insertStmt.run(String(name).slice(0, 64), guildId, userId, source); } catch { /* ignore */ }
}

export function topCommands(limit = 15) { if (!ok) return []; try { return topStmt.all(limit); } catch { return []; } }
export function recentCommands(limit = 20) { if (!ok) return []; try { return recentStmt.all(limit).map((r) => ({ ...r, at: r.at * 1000 })); } catch { return []; } }
export function totalCommands() { if (!ok) return 0; try { return totalStmt.get()?.n || 0; } catch { return 0; } }
export function commandsSince(secondsAgo) { if (!ok) return 0; try { return sinceStmt.get(Math.floor(Date.now() / 1000) - secondsAgo)?.n || 0; } catch { return 0; } }
export function bySource() { if (!ok) return {}; try { return Object.fromEntries(sourceStmt.all().map((r) => [r.source, r.n])); } catch { return {}; } }
