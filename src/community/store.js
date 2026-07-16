// Live CommunityConfig store (embedded SQLite) — mirrors the Mongoose model's
// fields exactly. Emits events on every change so the dashboard (SSE) and the
// Discord client stay in sync in real time (bidirectional, same process).
import { EventEmitter } from 'node:events';
import { getDb } from '../db/index.js';

const db = getDb();
export const bus = new EventEmitter();

const st = {
  get: db.prepare('SELECT * FROM community_config WHERE guild_id = ?'),
  byCustom: db.prepare('SELECT * FROM community_config WHERE custom_id = ?'),
  ins: db.prepare('INSERT OR IGNORE INTO community_config(guild_id, custom_id) VALUES (?, ?)'),
  pending: db.prepare('SELECT * FROM community_config WHERE is_approved = 0 ORDER BY created_at DESC'),
  all: db.prepare('SELECT * FROM community_config ORDER BY created_at DESC'),
  upd: db.prepare(
    `UPDATE community_config SET custom_id=?, community_name=?, theme_color=?, home_markdown=?,
     verification_required=?, is_approved=?, widgets=? WHERE guild_id=?`,
  ),
};

function rowToConfig(r) {
  if (!r) return null;
  return {
    guildId: r.guild_id,
    customSubdomainOrId: r.custom_id,
    communityName: r.community_name,
    themeColor: r.theme_color,
    homePageMarkdown: r.home_markdown,
    verificationRequired: Boolean(r.verification_required),
    isApproved: Boolean(r.is_approved),
    widgets: JSON.parse(r.widgets || '[]'),
    createdAt: r.created_at,
  };
}

// Ensure a config row exists (defaults to isApproved=false).
export function ensureCommunity(guildId, communityName = 'New Community') {
  const existing = st.get.get(guildId);
  if (existing) return rowToConfig(existing);
  st.ins.run(guildId, guildId); // custom_id defaults to guildId
  const row = st.get.get(guildId);
  row.community_name = communityName;
  st.upd.run(row.custom_id, communityName, row.theme_color, row.home_markdown, 0, 0, row.widgets, guildId);
  const cfg = rowToConfig(st.get.get(guildId));
  bus.emit('change', cfg);
  return cfg;
}

export const getCommunity = (guildId) => rowToConfig(st.get.get(guildId)) || ensureCommunity(guildId);
export const getCommunityByCustomId = (customId) => rowToConfig(st.byCustom.get(customId));
export const listPending = () => st.pending.all().map(rowToConfig);
export const listAll = () => st.all.all().map(rowToConfig);

export function updateCommunity(guildId, patch) {
  const cur = getCommunity(guildId);
  const next = { ...cur, ...patch };
  st.upd.run(
    next.customSubdomainOrId || guildId,
    next.communityName,
    next.themeColor,
    next.homePageMarkdown,
    next.verificationRequired ? 1 : 0,
    next.isApproved ? 1 : 0,
    JSON.stringify(next.widgets || []),
    guildId,
  );
  const saved = getCommunity(guildId);
  bus.emit('change', saved); // → SSE to browsers + any in-process listeners
  return saved;
}

export const setApproved = (guildId, approved) => updateCommunity(guildId, { isApproved: approved });
