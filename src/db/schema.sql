-- =====================================================================
-- PostgreSQL schema (ACID, relational). Apply with:
--   psql "$DATABASE_URL" -f src/db/schema.sql
-- The bot runs on embedded SQLite by default; set DATABASE_URL to use this.
-- =====================================================================

-- ---- Users (global identity) ----
CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,
  username    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Guilds (per-server config: modules, language, settings) ----
CREATE TABLE IF NOT EXISTS guilds (
  guild_id    TEXT PRIMARY KEY,
  language    TEXT NOT NULL DEFAULT 'en',
  modules     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {economy:true, moderation:true, ...}
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {autoroles:{}, logChannel, ...}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Balances (global + server-specific currency) ----
CREATE TABLE IF NOT EXISTS balances (
  user_id  TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  scope    TEXT NOT NULL DEFAULT 'global',           -- 'global' or a guild_id
  wallet   BIGINT NOT NULL DEFAULT 0 CHECK (wallet >= 0),
  bank     BIGINT NOT NULL DEFAULT 0 CHECK (bank   >= 0),
  wins     INTEGER NOT NULL DEFAULT 0,
  losses   INTEGER NOT NULL DEFAULT 0,
  streak   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, scope)
);

-- ---- Inventories (item categories: consumable|collectible|booster|equipment) ----
CREATE TABLE IF NOT EXISTS inventories (
  user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (user_id, item_id)
);

-- ---- Economy Transactions (immutable ledger / audit trail) ----
CREATE TABLE IF NOT EXISTS economy_transactions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  scope         TEXT NOT NULL DEFAULT 'global',
  type          TEXT NOT NULL,        -- daily|work|crime|gamble|buy|sell|transfer|uno_win|...
  amount        BIGINT NOT NULL,      -- signed delta
  balance_after BIGINT,
  meta          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON economy_transactions(user_id, created_at DESC);

-- ---- Shop catalog ----
CREATE TABLE IF NOT EXISTS shop_items (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       BIGINT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'collectible',
  rarity      TEXT NOT NULL DEFAULT 'common',
  effect      TEXT NOT NULL DEFAULT 'collectible',
  consumable  BOOLEAN NOT NULL DEFAULT false,
  custom      BOOLEAN NOT NULL DEFAULT false,
  added_by    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Cooldowns ----
CREATE TABLE IF NOT EXISTS cooldowns (
  user_id  TEXT NOT NULL,
  action   TEXT NOT NULL,
  used_at  BIGINT NOT NULL,   -- epoch ms
  PRIMARY KEY (user_id, action)
);

-- ---- Gamification: XP / levels (XP needed = 50*level^2 + 100*level) ----
CREATE TABLE IF NOT EXISTS levels (
  user_id  TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  xp       BIGINT NOT NULL DEFAULT 0,
  level    INTEGER NOT NULL DEFAULT 0,
  last_msg BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id)
);

-- ---- Moderation: infraction ledger + punishment state machine ----
CREATE TABLE IF NOT EXISTS infractions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  guild_id      TEXT NOT NULL,
  moderator_id  TEXT,
  type          TEXT NOT NULL,        -- warn|timeout|kick|ban
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_inf_user ON infractions(guild_id, user_id);
