// The one "big" infraction embed — used for the in-channel reply, the mod-log
// mirror, and the website live-preview. Fully configurable per guild from the
// dashboard (/infractions). All the ! moderation commands (warn/mute/kick/ban)
// funnel through applyInfraction, which renders THIS embed, so it's one unified
// look everywhere.
import { EmbedBuilder } from 'discord.js';
import { getCfg } from '../setup/store.js';

const ACTION = {
  warn: { emoji: '⚠️', noun: 'Warning', color: 0x3498db },
  mute: { emoji: '🔇', noun: 'Mute', color: 0xf1c40f },
  kick: { emoji: '👢', noun: 'Kick', color: 0xe67e22 },
  ban: { emoji: '🔨', noun: 'Ban', color: 0xe74c3c },
};

export const DEFAULT_EMBED_CFG = {
  enabled: true,                                   // post the big embed in-channel
  titleTemplate: '{emoji} {TYPE_UPPER} — Case #{case}',
  colorByAction: true,                             // per-action color vs. fixed
  color: '#5865f2',                                // used when colorByAction=false
  thumbnail: 'target',                             // 'target' | 'server' | 'none'
  showStrikeMeter: true,                           // 🟥🟥🟥⬜⬜ visual strike bar
  showEscalation: true,                            // Warn → Mute → Kick → Ban ladder
  showModerator: true,
  showOffenderId: true,
  showTotalCases: true,
  showReason: true,
  showNotes: true,
  showExpires: true,
  showIssuedAt: true,
  footerText: '{guild} · Staff Management · Case #{case}',
  bannerUrl: '',                                   // optional big image
  extraNote: '',                                   // custom line in the description
  pingOffender: false,                             // @mention offender in content
};

const BOOLS = ['enabled', 'colorByAction', 'showStrikeMeter', 'showEscalation', 'showModerator', 'showOffenderId', 'showTotalCases', 'showReason', 'showNotes', 'showExpires', 'showIssuedAt', 'pingOffender'];

// A visual strike meter — filled squares for strikes so far, out of 5.
function strikeMeter(count) {
  const n = Math.max(1, Math.min(5, count || 1));
  return '🟥'.repeat(n) + '⬜'.repeat(5 - n) + (count > 5 ? ` +${count - 5}` : '');
}
// The escalation ladder with the current step highlighted.
function escalationLadder(action) {
  const steps = [['warn', 'Warn'], ['mute', 'Mute'], ['kick', 'Kick'], ['ban', 'Ban']];
  return steps.map(([k, label]) => (k === action ? `__**${label}**__` : label)).join('  →  ');
}

// Merge the stored config over defaults.
export function getEmbedCfg(guildId) {
  const stored = (getCfg(guildId)?.settings?.infractionEmbed) || {};
  return { ...DEFAULT_EMBED_CFG, ...stored };
}

// Keep only known keys with the right types (used before saving from the web).
export function sanitizeEmbedCfg(input = {}) {
  const out = {};
  for (const k of Object.keys(DEFAULT_EMBED_CFG)) {
    if (!(k in input)) continue;
    if (BOOLS.includes(k)) out[k] = Boolean(input[k]);
    else if (k === 'thumbnail') out[k] = ['target', 'server', 'none'].includes(input[k]) ? input[k] : 'target';
    else out[k] = String(input[k] ?? '').slice(0, 400);
  }
  return { ...DEFAULT_EMBED_CFG, ...out };
}

const fill = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

// data = { guildName, guildIcon, target:{tag,id,avatarURL}, moderatorId, action,
//          appliedLabel, reason, notes, caseId, count, expiresAt, issuedAt }
export function buildInfractionEmbed(data, cfg = DEFAULT_EMBED_CFG) {
  const meta = ACTION[data.action] || { emoji: '•', noun: data.action, color: 0x5865f2 };
  const vars = {
    emoji: meta.emoji, TYPE: meta.noun, TYPE_UPPER: meta.noun.toUpperCase(), type: meta.noun.toLowerCase(),
    case: data.caseId, guild: data.guildName || 'Server',
    user: data.target?.tag || 'user', moderator: `@${data.moderatorId || ''}`,
  };

  const color = cfg.colorByAction ? meta.color : parseInt(String(cfg.color).replace('#', ''), 16) || 0x5865f2;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `${data.target?.tag || 'Unknown'} • ${data.target?.id || '—'}`, iconURL: data.target?.avatarURL || undefined })
    .setTitle(fill(cfg.titleTemplate, vars).slice(0, 256))
    .setTimestamp(data.issuedAt ? data.issuedAt * 1000 : Date.now());

  // Premium description: headline → divider → strike meter → escalation ladder.
  const desc = [];
  // appliedLabel already carries its own emoji (e.g. "🔨 Permanently banned").
  const headline = data.appliedLabel || `${meta.emoji} ${meta.noun}`;
  desc.push(`> **${headline}** in **${data.guildName || 'this server'}**`);
  desc.push('━━━━━━━━━━━━━━━━━━━━━━');
  if (cfg.showStrikeMeter) desc.push(`**Strike ${data.count ?? 1}**   ${strikeMeter(data.count)}`);
  if (cfg.showEscalation) desc.push(`📈 ${escalationLadder(data.action)}`);
  if (cfg.extraNote) desc.push(`\n${fill(cfg.extraNote, vars)}`);
  embed.setDescription(desc.join('\n').slice(0, 4096));

  const fields = [];
  fields.push({ name: '👤 Offender', value: `<@${data.target?.id}>`, inline: true });
  if (cfg.showModerator) fields.push({ name: '🛡️ Moderator', value: `<@${data.moderatorId}>`, inline: true });
  if (cfg.showTotalCases) fields.push({ name: '📊 Total Cases', value: `\`${data.count ?? 1}\``, inline: true });
  if (cfg.showReason) fields.push({ name: '📝 Reason', value: '```\n' + (data.reason || 'No reason provided').slice(0, 1000) + '\n```' });
  if (cfg.showNotes && data.notes) fields.push({ name: '🗒️ Staff Notes', value: '```\n' + String(data.notes).slice(0, 1000) + '\n```' });
  if (cfg.showExpires) fields.push({ name: '⏳ Expires', value: data.expiresAt ? `<t:${data.expiresAt}:R>` : '`Permanent`', inline: true });
  if (cfg.showIssuedAt) fields.push({ name: '🕒 Issued', value: `<t:${data.issuedAt || Math.floor(Date.now() / 1000)}:f>`, inline: true });
  if (cfg.showOffenderId) fields.push({ name: '🆔 Case ID', value: `\`#${data.caseId}\``, inline: true });
  embed.addFields(fields.slice(0, 25));

  if (cfg.thumbnail === 'target' && data.target?.avatarURL) embed.setThumbnail(data.target.avatarURL);
  else if (cfg.thumbnail === 'server' && data.guildIcon) embed.setThumbnail(data.guildIcon);
  if (cfg.bannerUrl && /^https?:\/\//.test(cfg.bannerUrl)) embed.setImage(cfg.bannerUrl);
  embed.setFooter({ text: fill(cfg.footerText, vars).slice(0, 2048), iconURL: data.guildIcon || undefined });

  return embed;
}
