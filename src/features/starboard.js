// ============================================================================
// SENTINEL STARBOARD — rebuilt: per-guild SQLite config + de-duplication.
// One post per message (edits the ⭐ count as it grows instead of re-posting),
// optional dedicated #starboard channel, and star-removal handling.
// ============================================================================
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getDb } from '../db/index.js';

const db = getDb();
// Config table is ours; the posts table already exists in the base schema
// (src/db/sqlite.js) with guild_id/source_msg_id/star_msg_id — extend it with the
// two columns we need (idempotent: ALTER throws & is ignored if already present).
db.exec(`
  CREATE TABLE IF NOT EXISTS starboard_config (
    guild_id  TEXT PRIMARY KEY,
    enabled   INTEGER DEFAULT 1,
    threshold INTEGER DEFAULT 3,
    channel_id TEXT,
    emoji     TEXT DEFAULT '⭐'
  );
`);
try { db.exec('ALTER TABLE starboard_posts ADD COLUMN star_channel_id TEXT'); } catch { /* exists */ }
try { db.exec('ALTER TABLE starboard_posts ADD COLUMN count INTEGER DEFAULT 0'); } catch { /* exists */ }

const stmt = {
  getCfg: db.prepare('SELECT * FROM starboard_config WHERE guild_id = ?'),
  upsertCfg: db.prepare(`
    INSERT INTO starboard_config(guild_id, enabled, threshold, channel_id, emoji)
    VALUES (@guild_id, @enabled, @threshold, @channel_id, @emoji)
    ON CONFLICT(guild_id) DO UPDATE SET enabled=@enabled, threshold=@threshold, channel_id=@channel_id, emoji=@emoji
  `),
  getPost: db.prepare('SELECT * FROM starboard_posts WHERE guild_id = ? AND source_msg_id = ?'),
  savePost: db.prepare(`
    INSERT INTO starboard_posts(guild_id, source_msg_id, star_msg_id, star_channel_id, count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, source_msg_id) DO UPDATE SET star_msg_id = excluded.star_msg_id, star_channel_id = excluded.star_channel_id, count = excluded.count
  `),
  delPost: db.prepare('DELETE FROM starboard_posts WHERE guild_id = ? AND source_msg_id = ?'),
};

const DEFAULT_CFG = { enabled: 1, threshold: 3, channel_id: null, emoji: '⭐' };

export function getStarConfig(guildId) {
  return stmt.getCfg.get(guildId) || { guild_id: guildId, ...DEFAULT_CFG };
}

// Persist config. Pass any subset of { enabled, threshold, channelId, emoji }.
export function configureStarboard(guildId, opts = {}) {
  const cur = getStarConfig(guildId);
  const next = {
    guild_id: guildId,
    enabled: opts.enabled != null ? (opts.enabled ? 1 : 0) : cur.enabled,
    threshold: typeof opts.threshold === 'number' ? Math.max(1, Math.floor(opts.threshold)) : cur.threshold,
    channel_id: opts.channelId !== undefined ? (opts.channelId || null) : cur.channel_id,
    emoji: opts.emoji || cur.emoji || '⭐',
  };
  stmt.upsertCfg.run(next);
  return next;
}

function emojiMatches(reaction, wanted) {
  const e = reaction.emoji;
  return e?.name === wanted || e?.toString() === wanted || (wanted === '⭐' && e?.name === '🌟');
}

function buildEmbed(message, count, emoji) {
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL?.() })
    .setDescription(message.content || '*No text content*')
    .addFields({ name: 'Jump', value: `[Go to message](${message.url})`, inline: true })
    .setFooter({ text: `${emoji} ${count} • #${message.channel?.name || 'channel'}` })
    .setTimestamp(message.createdTimestamp || Date.now());
  const img = message.attachments?.find?.((a) => (a.contentType || '').startsWith('image/')) || message.attachments?.first?.();
  if (img) embed.setImage(img.url);
  return embed;
}

async function resolveTarget(message, cfg) {
  if (cfg.channel_id) {
    const ch = message.guild.channels.cache.get(cfg.channel_id) || (await message.guild.channels.fetch(cfg.channel_id).catch(() => null));
    if (ch) return ch;
  }
  return message.channel; // fall back to the same channel
}

// A ⭐ was added. Post (once) or update the running count.
export async function handleStar(reaction) {
  try {
    if (reaction.partial) await reaction.fetch().catch(() => {});
    let message = reaction.message;
    if (message?.partial) message = await message.fetch().catch(() => null);
    if (!message || !message.guild) return;

    const cfg = getStarConfig(message.guild.id);
    if (!cfg.enabled) return;
    if (!emojiMatches(reaction, cfg.emoji)) return;
    // Never star messages that are already in the starboard channel (avoids loops).
    if (cfg.channel_id && message.channel.id === cfg.channel_id) return;

    const count = reaction.count || 0;
    const existing = stmt.getPost.get(message.guild.id, message.id);

    if (count < cfg.threshold) return; // not enough stars yet (and nothing posted)

    if (existing) {
      // Already on the board → just edit the count, don't re-post.
      const ch = message.guild.channels.cache.get(existing.star_channel_id);
      const starMsg = ch && (await ch.messages.fetch(existing.star_msg_id).catch(() => null));
      if (starMsg) {
        await starMsg.edit({ embeds: [buildEmbed(message, count, cfg.emoji)] }).catch(() => {});
        stmt.savePost.run(message.guild.id, message.id, existing.star_msg_id, existing.star_channel_id, count);
      } else {
        stmt.delPost.run(message.guild.id, message.id); // post was deleted — allow a fresh one
      }
      return;
    }

    // First time crossing the threshold → post it and remember the post.
    const target = await resolveTarget(message, cfg);
    const perms = target.permissionsFor?.(message.guild.members.me);
    if (perms && !perms.has(PermissionFlagsBits.SendMessages)) return;
    const posted = await target.send({ embeds: [buildEmbed(message, count, cfg.emoji)] }).catch(() => null);
    if (posted) stmt.savePost.run(message.guild.id, message.id, posted.id, target.id, count);
  } catch (err) {
    console.error('Starboard add error:', err.message);
  }
}

// A ⭐ was removed. Update the count, or pull the post if it drops below threshold.
export async function handleStarRemove(reaction) {
  try {
    if (reaction.partial) await reaction.fetch().catch(() => {});
    let message = reaction.message;
    if (message?.partial) message = await message.fetch().catch(() => null);
    if (!message || !message.guild) return;

    const cfg = getStarConfig(message.guild.id);
    if (!emojiMatches(reaction, cfg.emoji)) return;
    const existing = stmt.getPost.get(message.guild.id, message.id);
    if (!existing) return;

    const count = reaction.count || 0;
    const ch = message.guild.channels.cache.get(existing.star_channel_id);
    const starMsg = ch && (await ch.messages.fetch(existing.star_msg_id).catch(() => null));

    if (count < cfg.threshold) {
      // Dropped below the bar → remove the post so it can re-earn its place later.
      if (starMsg) await starMsg.delete().catch(() => {});
      stmt.delPost.run(message.guild.id, message.id);
      return;
    }
    if (starMsg) {
      await starMsg.edit({ embeds: [buildEmbed(message, count, cfg.emoji)] }).catch(() => {});
      stmt.savePost.run(message.guild.id, message.id, existing.star_channel_id, existing.star_message_id, count);
    }
  } catch (err) {
    console.error('Starboard remove error:', err.message);
  }
}
