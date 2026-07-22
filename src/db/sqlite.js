// Real ACID database using Node's built-in `node:sqlite` (Node 22.5+/24).
// Zero install, file-backed, synchronous — perfect for the bot's hot path.
// For horizontal scale, point DATABASE_URL at PostgreSQL (see postgres.js +
// schema.sql); this SQLite store stays the embedded default/fallback.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');

// SQLite dialect of the full schema. PostgreSQL DDL lives in schema.sql.
const MIGRATIONS = `
PRAGMA journal_mode = WAL;        -- concurrent readers + one writer
PRAGMA busy_timeout = 5000;       -- wait up to 5s for a lock instead of erroring
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS users (
  user_id    TEXT PRIMARY KEY,
  username   TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Balances are per (user, scope). scope = 'global' or a guild id => the
-- global + server-specific currency system.
CREATE TABLE IF NOT EXISTS balances (
  user_id TEXT NOT NULL,
  scope   TEXT NOT NULL DEFAULT 'global',
  wallet  INTEGER NOT NULL DEFAULT 0,
  bank    INTEGER NOT NULL DEFAULT 0,
  wins    INTEGER NOT NULL DEFAULT 0,
  losses  INTEGER NOT NULL DEFAULT 0,
  streak  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, scope)
);

CREATE TABLE IF NOT EXISTS inventories (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  qty     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS cooldowns (
  user_id TEXT NOT NULL,
  action  TEXT NOT NULL,
  used_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, action)
);

CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT 'global',
  type          TEXT NOT NULL,
  amount        INTEGER NOT NULL,
  balance_after INTEGER,
  meta          TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at);

CREATE TABLE IF NOT EXISTS shop_items (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'collectible', -- consumable|collectible|booster|equipment
  rarity      TEXT NOT NULL DEFAULT 'common',
  effect      TEXT NOT NULL DEFAULT 'collectible',
  consumable  INTEGER NOT NULL DEFAULT 0,
  custom      INTEGER NOT NULL DEFAULT 0,
  added_by    TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS guilds (
  guild_id   TEXT PRIMARY KEY,
  language   TEXT NOT NULL DEFAULT 'en',
  modules    TEXT NOT NULL DEFAULT '{}',  -- JSON: {economy:true, moderation:true, ...}
  settings   TEXT NOT NULL DEFAULT '{}',  -- JSON: {autoroles:{}, logChannel, ...}
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS levels (
  user_id  TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  xp       INTEGER NOT NULL DEFAULT 0,
  level    INTEGER NOT NULL DEFAULT 0,
  last_msg INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS infractions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,
  guild_id     TEXT NOT NULL,
  moderator_id TEXT,
  type         TEXT NOT NULL,   -- warn|timeout|kick|ban
  reason       TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at   INTEGER,
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_inf_user ON infractions(guild_id, user_id);

CREATE TABLE IF NOT EXISTS reaction_roles (
  guild_id   TEXT NOT NULL,
  message_id TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  role_id    TEXT NOT NULL,
  PRIMARY KEY (message_id, emoji)
);

CREATE TABLE IF NOT EXISTS giveaways (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  prize      TEXT NOT NULL,
  winners    INTEGER NOT NULL DEFAULT 1,
  ends_at    INTEGER NOT NULL,
  ended      INTEGER NOT NULL DEFAULT 0,
  host_id    TEXT
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  giveaway_id INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  PRIMARY KEY (giveaway_id, user_id)
);

CREATE TABLE IF NOT EXISTS starboard_posts (
  guild_id      TEXT NOT NULL,
  source_msg_id TEXT NOT NULL,
  star_msg_id   TEXT NOT NULL,
  PRIMARY KEY (guild_id, source_msg_id)
);

-- ===== Roblox / community management =====
CREATE TABLE IF NOT EXISTS roblox_links (
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  roblox_id   TEXT NOT NULL,
  roblox_name TEXT NOT NULL,
  verified_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS punishments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  roblox_user  TEXT NOT NULL,
  type         TEXT NOT NULL,      -- warn|kick|ban|note
  reason       TEXT,
  moderator_id TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pun_guild ON punishments(guild_id, created_at);

CREATE TABLE IF NOT EXISTS bolos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  roblox_user TEXT NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending|resolved
  created_by  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS automations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id  TEXT NOT NULL,
  name      TEXT NOT NULL,
  trigger   TEXT NOT NULL,        -- e.g. member_join, keyword
  action    TEXT NOT NULL,        -- e.g. add_role, send_message
  data      TEXT,                 -- JSON params
  enabled   INTEGER NOT NULL DEFAULT 1
);

-- ===== Multi-tenant community pages =====
CREATE TABLE IF NOT EXISTS community_config (
  guild_id              TEXT PRIMARY KEY,
  custom_id             TEXT UNIQUE,
  community_name        TEXT,
  theme_color           TEXT NOT NULL DEFAULT '#5865f2',
  home_markdown         TEXT NOT NULL DEFAULT 'Welcome to our community!',
  verification_required INTEGER NOT NULL DEFAULT 0,
  is_approved           INTEGER NOT NULL DEFAULT 0,
  widgets               TEXT NOT NULL DEFAULT '[]',
  created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

let db;

export function openSqlite() {
  if (db) return db;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(join(DATA_DIR, 'bot.db'));
  db.exec(MIGRATIONS);
  return db;
}
