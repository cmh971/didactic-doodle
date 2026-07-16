// Bad-word filter system.
//
// Detection layers (cheapest first — Gemini is only touched on borderline cases):
//   1) Exact match  — a whole word IS a bad word after leetspeak normalization.
//   2) Fuzzy match  — a bad word is padded/spaced inside one message ("f u c k").
//   3) Cross-message — a slur spelled across the user's last ~2 minutes of messages.
// Layers 2 and 3 are ambiguous, so Gemini confirms real intent before we act,
// which kills false positives like "is a dis" -> "sadis".
//
// Escalation ladder (per-user, per-guild, its own strike counter):
//   1 warn · 2 stern warn · 3 timeout (1h) · 4 kick · 5 ban (staff approval required)
import {
  PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} from 'discord.js';
import { getDb } from '../db/index.js';
import { getCfg } from '../setup/store.js';
import { recordInfraction } from './automod.js';
import { analyzeMessage, blobHasBadword, normalizeToken, aiIsBadword } from '../ai/gemini.js';

const TIMEOUT_MS = 60 * 60_000;   // strike 3 -> 1-hour timeout
const WINDOW_MS = 2 * 60_000;     // cross-message look-back window
const APPROVAL_MS = 6 * 60_000;   // ban-approval prompt lifetime

/* ---------------------------------- strike storage ---------------------------------- */

const db = getDb();
db.exec(`
CREATE TABLE IF NOT EXISTS badword_strikes (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  strikes  INTEGER NOT NULL DEFAULT 0,
  last_at  INTEGER,
  PRIMARY KEY (guild_id, user_id)
);
`);

const bumpStmt = db.prepare(`
  INSERT INTO badword_strikes (guild_id, user_id, strikes, last_at)
  VALUES (?, ?, 1, ?)
  ON CONFLICT(guild_id, user_id)
  DO UPDATE SET strikes = strikes + 1, last_at = excluded.last_at
`);
const getStmt = db.prepare('SELECT strikes FROM badword_strikes WHERE guild_id = ? AND user_id = ?');
const resetStmt = db.prepare('DELETE FROM badword_strikes WHERE guild_id = ? AND user_id = ?');

export function getStrikes(guildId, userId) {
  return getStmt.get(guildId, userId)?.strikes ?? 0;
}
export function resetStrikes(guildId, userId) {
  resetStmt.run(guildId, userId);
}
function bumpStrike(guildId, userId) {
  bumpStmt.run(guildId, userId, Date.now());
  return getStrikes(guildId, userId);
}

/* --------------------------------- config helpers ---------------------------------- */

export function isBadwordFilterOn(guildId) {
  return Boolean(getCfg(guildId).settings.automod.badwords);
}

function logChannelFor(message) {
  const s = getCfg(message.guild.id).settings;
  const id = s.automod.logChannel || s.logChannel;
  const ch = id && message.guild.channels.cache.get(id);
  return ch?.isTextBased?.() ? ch : message.channel;
}

/* ---------------------------- in-memory rolling state ------------------------------ */

const windows = new Map();      // `${guild}:${user}` -> [{ blob, t }]
const pendingBans = new Map();  // `${guild}:${user}` -> { timer }

/* --------------------------------- main entry -------------------------------------- */

// Returns a notice string if it acted (the message is already deleted), else null.
export async function scanBadwords(message) {
  if (!message.guild || message.author.bot) return null;
  if (!isBadwordFilterOn(message.guild.id)) return null;
  const member = message.member;
  if (!member) return null;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return null; // never staff
  const content = (message.content || '').trim();
  if (!content) return null;

  const gid = message.guild.id;
  const key = `${gid}:${message.author.id}`;
  const now = Date.now();
  const curBlob = normalizeToken(content);

  // record into the rolling window (drop anything older than the look-back)
  const recent = (windows.get(key) || []).filter((e) => now - e.t < WINDOW_MS);
  recent.push({ blob: curBlob, t: now });
  windows.set(key, recent);

  // 1) current message
  const res = analyzeMessage(content);
  let bad = res.level === 'exact';
  if (!bad && res.level === 'fuzzy') bad = await aiIsBadword(content); // borderline -> AI

  // 2) cross-message stitch — someone spelling a slur across short messages.
  // Only short fragments (<= 6 chars) are stitched, so normal multi-message
  // chatter never triggers an AI call; and only if the current message alone
  // didn't already form it.
  if (!bad) {
    const frags = recent.filter((e) => e.blob.length <= 6).map((e) => e.blob);
    if (frags.length > 1) {
      const combined = frags.join('');
      if (combined.length >= 4 && blobHasBadword(combined) && !blobHasBadword(curBlob)) {
        bad = await aiIsBadword(frags.join(' '));
      }
    }
  }

  if (!bad) return null;

  windows.delete(key); // reset after a catch so fragments aren't double-counted
  await message.delete().catch(() => {});
  return punish(message, member, content);
}

/* --------------------------------- escalation -------------------------------------- */

async function punish(message, member, content) {
  const gid = message.guild.id;
  const strikes = bumpStrike(gid, member.id);
  const reason = `Bad-word filter — strike ${strikes}`;
  // Also log to the shared infraction history so /warnings shows it.
  recordInfraction(gid, member.id, member.client.user.id, 'badword', reason);

  switch (Math.min(strikes, 5)) {
    case 1:
      return `⚠️ ${message.author}, watch your language. **Warning (strike 1/5).**`;
    case 2:
      return `🚨 ${message.author}, **stern warning (strike 2/5)** — next offense is a timeout.`;
    case 3:
      await member.timeout(TIMEOUT_MS, reason).catch(() => {});
      return `🔇 ${message.author} was **timed out for 1 hour (strike 3/5)** for repeated bad language.`;
    case 4:
      await member.kick(reason).catch(() => {});
      return `👢 ${message.author} was **kicked (strike 4/5)** for repeated bad language.`;
    default:
      await requestBanApproval(message, member, content, strikes);
      return `🔨 ${message.author} reached **strike 5/5** — a **ban is pending staff approval**.`;
  }
}

async function requestBanApproval(message, member, content, strikes) {
  const gid = message.guild.id;
  const key = `${gid}:${member.id}`;
  if (pendingBans.has(key)) return; // one prompt at a time

  const ch = logChannelFor(message);
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('🔨 Ban approval needed')
    .setDescription(`**${member.user.tag}** hit **strike 5** on the bad-word filter.`)
    .addFields(
      { name: 'Member', value: `${member} \`${member.id}\``, inline: true },
      { name: 'Strikes', value: String(strikes), inline: true },
      { name: 'Triggering message', value: content.slice(0, 400) || '*(deleted)*' },
    )
    .setFooter({ text: 'Anyone with Ban Members can decide • expires in 6 minutes' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bwban:approve:${gid}:${member.id}`).setLabel('Approve ban').setEmoji('🔨').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`bwban:deny:${gid}:${member.id}`).setLabel('Cancel').setEmoji('✅').setStyle(ButtonStyle.Secondary),
  );

  const sent = await ch.send({ embeds: [embed], components: [row] }).catch(() => null);
  if (!sent) return;

  const timer = setTimeout(() => {
    pendingBans.delete(key);
    sent.edit({
      content: '⌛ Ban request expired (no staff response within 6 minutes).',
      embeds: sent.embeds,
      components: [],
    }).catch(() => {});
  }, APPROVAL_MS);

  pendingBans.set(key, { timer });
}

/* ----------------------------- ban approval buttons -------------------------------- */

export async function handleBadwordBanButton(interaction) {
  if (!interaction.customId.startsWith('bwban:')) return false;
  const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    await interaction.reply(eph('❌ You need the **Ban Members** permission to decide this.'));
    return true;
  }

  const [, action, gid, userId] = interaction.customId.split(':');
  const key = `${gid}:${userId}`;
  const pending = pendingBans.get(key);
  if (!pending) {
    await interaction.update({
      content: '⌛ This ban request already expired or was handled.',
      embeds: interaction.message.embeds,
      components: [],
    }).catch(() => {});
    return true;
  }
  clearTimeout(pending.timer);
  pendingBans.delete(key);

  if (action === 'deny') {
    await interaction.update({
      content: `✅ Ban **cancelled** by ${interaction.user}. Strikes kept — use \`/badwords reset\` to clear them.`,
      embeds: interaction.message.embeds,
      components: [],
    }).catch(() => {});
    return true;
  }

  let result;
  try {
    await interaction.guild.bans.create(userId, {
      reason: `Bad-word filter strike 5 — approved by ${interaction.user.tag}`,
    });
    resetStrikes(gid, userId);
    result = `🔨 <@${userId}> was **banned** (approved by ${interaction.user}).`;
  } catch (err) {
    result = `❌ Ban failed: ${err.message}`;
  }
  await interaction.update({ content: result, embeds: interaction.message.embeds, components: [] }).catch(() => {});
  return true;
}
