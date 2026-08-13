// Autoresponders (a Ducky feature Sentinel lacked): kT
// Unlike the event-based automations, these are simple "someone said X → bot says Y".
// Responses support the full template variable library ({user}, {server}, …) and
// can be plain text or an embed. Configured on the website (/autoresponders) and
// saved to the guild settings.
import { EmbedBuilder } from 'discord.js';
import { getCfg, setSetting } from '../setup/store.js';
import { renderTemplate } from './templates.js';
import { randomBytes } from 'node:crypto';

export const MATCH_TYPES = ['contains', 'exact', 'starts', 'ends', 'regex'];

export function getAutoresponders(guildId) {
  return getCfg(guildId)?.settings?.autoresponders || [];
}

export function saveAutoresponders(guildId, list) {
  const clean = (Array.isArray(list) ? list : []).slice(0, 50).map((r) => ({
    id: r.id && /^[a-z0-9]{6,}$/i.test(r.id) ? r.id : randomBytes(5).toString('hex'),
    trigger: String(r.trigger || '').slice(0, 200),
    match: MATCH_TYPES.includes(r.match) ? r.match : 'contains',
    response: String(r.response || '').slice(0, 1800),
    embed: !!r.embed,
    color: /^#?[0-9a-f]{6}$/i.test(r.color || '') ? r.color : '',
    enabled: r.enabled !== false,
    deleteTrigger: !!r.deleteTrigger, // delete the message that triggered it
  })).filter((r) => r.trigger && r.response);
  setSetting(guildId, 'autoresponders', clean);
  return clean;
}

// Does `content` match this responder's trigger?
function matches(content, r) {
  const c = content.toLowerCase();
  const t = r.trigger.toLowerCase();
  switch (r.match) {
    case 'exact': return c.trim() === t.trim();
    case 'starts': return c.startsWith(t);
    case 'ends': return c.endsWith(t);
    case 'regex': try { return new RegExp(r.trigger, 'i').test(content); } catch { return false; }
    default: return c.includes(t); // contains
  }
}

const cooldown = new Map(); // `${guildId}:${channelId}` -> ts (anti-spam)

// Passive: on every message, fire the first matching autoresponder. Never blocks.
export async function checkAutoresponders(message) {
  if (message.author?.bot || !message.guild) return false;
  const list = getAutoresponders(message.guild.id);
  if (!list.length) return false;
  const content = message.content || '';
  if (!content.trim()) return false;

  const key = `${message.guild.id}:${message.channel.id}`;
  if (Date.now() - (cooldown.get(key) || 0) < 2000) return false; // 2s per channel

  const hit = list.find((r) => r.enabled && matches(content, r));
  if (!hit) return false;
  cooldown.set(key, Date.now());

  const ctx = { guild: message.guild, target: message.author, targetMember: message.member, mod: message.author, channel: message.channel };
  const text = renderTemplate(hit.response, ctx);
  try {
    if (hit.embed) {
      const embed = new EmbedBuilder().setDescription(text.slice(0, 4096));
      if (/^#?[0-9a-f]{6}$/i.test(hit.color || '')) embed.setColor(parseInt(hit.color.replace('#', ''), 16));
      else embed.setColor(0x5865f2);
      await message.channel.send({ embeds: [embed], allowedMentions: { parse: ['users'] } });
    } else {
      await message.channel.send({ content: text.slice(0, 2000), allowedMentions: { parse: ['users'] } });
    }
    if (hit.deleteTrigger) await message.delete().catch(() => {});
  } catch { /* missing perms — ignore */ }
  return true;
}
