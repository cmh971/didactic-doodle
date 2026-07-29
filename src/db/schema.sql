-- =========================================================================================
-- SENTINEL DATABASE SCHEMA · ENTERPRISE EDITION (~600 LOC)
-- PostgreSQL · ACID · Multi-tenant · Audited · Indexed · Ready for serious production.
-- Apply with:
--   psql "$DATABASE_URL" -f src/db/schema_enterprise.sql
-- =========================================================================================

-- =========================================================================================
-- EXTENSIONS (optional but recommended)
-- =========================================================================================
-- Uncomment if allowed on your Postgres instance.

-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =========================================================================================
-- TENANCY & ENV METADATA
-- =========================================================================================

CREATE TABLE IF NOT EXISTS environments (
  env_id       TEXT PRIMARY KEY,                 -- e.g. "prod", "staging", "dev"
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id    TEXT PRIMARY KEY,                 -- logical tenant (e.g. "sentinel-main")
  env_id       TEXT NOT NULL REFERENCES environments(env_id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  active       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_tenants_env_active
  ON tenants(env_id, active);

-- =========================================================================================
-- USERS — Global identity (multi-tenant)
-- =========================================================================================

CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,                  -- Discord user ID
  tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  username    TEXT,
  avatar_url  TEXT,
  locale      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_tenant
  ON users(tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_last_seen
  ON users(last_seen DESC);

-- =========================================================================================
-- GUILDS — Per-server configuration (multi-tenant)
-- =========================================================================================

CREATE TABLE IF NOT EXISTS guilds (
  guild_id    TEXT PRIMARY KEY,                  -- Discord guild ID
  tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  language    TEXT NOT NULL DEFAULT 'en',
  modules     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {economy:true, moderation:true, ...}
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {autoroles:{}, logChannel, ...}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guilds_tenant_lang
  ON guilds(tenant_id, language);

CREATE INDEX IF NOT EXISTS idx_guilds_updated
  ON guilds(updated_at DESC);

-- =========================================================================================
-- CHANNELS — Optional per-channel config
-- =========================================================================================

CREATE TABLE IF NOT EXISTS channels (
  channel_id  TEXT PRIMARY KEY,                  -- Discord channel ID
  guild_id    TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'text',      -- text|voice|thread|forum|...
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channels_guild
  ON channels(guild_id);

-- =========================================================================================
-- BALANCES — Global + per-guild currency (multi-tenant)
-- =========================================================================================

CREATE TABLE IF NOT EXISTS balances (
  user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  guild_id   TEXT,                               -- NULL => global scope
  wallet     BIGINT NOT NULL DEFAULT 0 CHECK (wallet >= 0),
  bank       BIGINT NOT NULL DEFAULT 0 CHECK (bank >= 0),
  wins       INTEGER NOT NULL DEFAULT 0,
  losses     INTEGER NOT NULL DEFAULT 0,
  streak     INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_balances_guild
  ON balances(guild_id);

CREATE INDEX IF NOT EXISTS idx_balances_updated
  ON balances(updated_at DESC);

-- =========================================================================================
-- INVENTORIES — Item ownership
-- =========================================================================================

CREATE TABLE IF NOT EXISTS inventories (
  user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  guild_id    TEXT,                               -- optional per-guild inventory
  qty         INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (user_id, item_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_user_guild
  ON inventories(user_id, guild_id);

-- =========================================================================================
-- ECONOMY TRANSACTIONS — Immutable ledger / audit trail
-- =========================================================================================

CREATE TABLE IF NOT EXISTS economy_transactions (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  guild_id      TEXT,
  scope         TEXT NOT NULL DEFAULT 'global',
  type          TEXT NOT NULL,        -- daily|work|crime|gamble|buy|sell|transfer|uno_win|...
  amount        BIGINT NOT NULL,      -- signed delta
  balance_after BIGINT,
  meta          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_time
  ON economy_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tx_tenant_scope
  ON economy_transactions(tenant_id, scope);

CREATE INDEX IF NOT EXISTS idx_tx_type
  ON economy_transactions(type);

-- =========================================================================================
-- SHOP ITEMS — Catalog (multi-tenant)
-- =========================================================================================

CREATE TABLE IF NOT EXISTS shop_items (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       BIGINT NOT NULL CHECK (price >= 0),
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'collectible',
  rarity      TEXT NOT NULL DEFAULT 'common',
  effect      TEXT NOT NULL DEFAULT 'collectible',
  consumable  BOOLEAN NOT NULL DEFAULT false,
  custom      BOOLEAN NOT NULL DEFAULT false,
  added_by    TEXT REFERENCES users(user_id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_shop_tenant_category
  ON shop_items(tenant_id, category);

CREATE INDEX IF NOT EXISTS idx_shop_price_rarity
  ON shop_items(price, rarity);

-- =========================================================================================
-- COOLDOWNS — Action throttling
-- =========================================================================================

CREATE TABLE IF NOT EXISTS cooldowns (
  user_id  TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  action   TEXT NOT NULL,
  guild_id TEXT,
  used_at  BIGINT NOT NULL,   -- epoch ms
  PRIMARY KEY (user_id, action, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_cd_used
  ON cooldowns(used_at DESC);

-- =========================================================================================
-- LEVELS — XP / levels (XP needed = 50*level^2 + 100*level)
-- =========================================================================================

CREATE TABLE IF NOT EXISTS levels (
  user_id   TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  guild_id  TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  xp        BIGINT NOT NULL DEFAULT 0,
  level     INTEGER NOT NULL DEFAULT 0,
  last_msg  BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_levels_guild_xp
  ON levels(guild_id, xp DESC);

CREATE INDEX IF NOT EXISTS idx_levels_last_msg
  ON levels(last_msg DESC);

-- =========================================================================================
-- INFRACTIONS — Moderation ledger + punishment state machine
-- =========================================================================================

CREATE TABLE IF NOT EXISTS infractions (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  guild_id      TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  moderator_id  TEXT REFERENCES users(user_id),
  type          TEXT NOT NULL,        -- warn|timeout|kick|ban
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  active        BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_inf_user_guild
  ON infractions(guild_id, user_id);

CREATE INDEX IF NOT EXISTS idx_inf_type_active
  ON infractions(type, active);

CREATE INDEX IF NOT EXISTS idx_inf_expires
  ON infractions(expires_at);

-- =========================================================================================
-- AUDIT LOGS — System-level events
-- =========================================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  guild_id    TEXT,
  actor_id    TEXT,                          -- user_id or system
  event       TEXT NOT NULL,                 -- e.g. "config.update", "moderation.ban"
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time
  ON audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_event
  ON audit_logs(event);

-- =========================================================================================
-- JOBS / TASK QUEUE — For scheduled operations (e.g. timeouts, reminders)
-- =========================================================================================

CREATE TABLE IF NOT EXISTS jobs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                 -- e.g. "timeout.expire", "reminder.send"
  payload     JSONB NOT NULL,
  run_at      TIMESTAMPTZ NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  locked_at   TIMESTAMPTZ,
  completed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_due
  ON jobs(tenant_id, completed, run_at);

CREATE INDEX IF NOT EXISTS idx_jobs_kind
  ON jobs(kind);

-- =========================================================================================
-- BOT METRICS — Lightweight analytics
-- =========================================================================================

CREATE TABLE IF NOT EXISTS metrics (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  guild_id    TEXT,
  metric      TEXT NOT NULL,                 -- e.g. "commands.used", "errors"
  value       BIGINT NOT NULL DEFAULT 0,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_tenant_metric
  ON metrics(tenant_id, metric);

CREATE INDEX IF NOT EXISTS idx_metrics_time
  ON metrics(created_at DESC);

-- =========================================================================================
-- END OF SENTINEL ENTERPRISE SCHEMA
-- =========================================================================================
