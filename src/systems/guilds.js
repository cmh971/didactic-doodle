// Per-guild config accessor (modules toggles, language, settings JSON).
// Used by automod, leveling, the dashboard, and i18n.
import { getDb } from '../db/index.js';

const db = getDb();
const get = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');
const ins = db.prepare('INSERT OR IGNORE INTO guilds(guild_id) VALUES (?)');
const upd = db.prepare('UPDATE guilds SET language = ?, modules = ?, settings = ? WHERE guild_id = ?');

const DEFAULT_MODULES = { economy: true, gamification: true, moderation: true, automod: true, leveling: true };

export function getGuild(guildId) {
  ins.run(guildId);
  const row = get.get(guildId);
  return {
    guildId: row.guild_id,
    language: row.language || 'en',
    modules: { ...DEFAULT_MODULES, ...safeJson(row.modules) },
    settings: safeJson(row.settings),
  };
}

export function saveGuild(g) {
  ins.run(g.guildId);
  upd.run(g.language || 'en', JSON.stringify(g.modules || {}), JSON.stringify(g.settings || {}), g.guildId);
  return g;
}

export function moduleEnabled(guildId, name) {
  return getGuild(guildId).modules[name] !== false;
}

export function setModule(guildId, name, enabled) {
  const g = getGuild(guildId);
  g.modules[name] = enabled;
  return saveGuild(g);
}

function safeJson(s) {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}
