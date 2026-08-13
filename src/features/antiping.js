// Anti-Ping (a Ducky "Discord Pings" feature): protect high-ranking staff/roles
// from being @pinged. When a non-exempt member pings a protected user or role,
// the bot can warn, delete the message, and/or time them out. Configured on the
// website (/antiping), saved to guild settings.
import { PermissionFlagsBits } from 'discord.js';
import { getCfg, setSetting } from '../setup/store.js';

const IDS = (a) => (Array.isArray(a) ? a : []).filter((x) => /^\d{15,25}$/.test(String(x))).slice(0, 25);

export function getAntiping(guildId) {
  const d = getCfg(guildId)?.settings?.antiping || {};
  return {
    enabled: !!d.enabled,
    roles: d.roles || [], users: d.users || [], exemptRoles: d.exemptRoles || [],
    action: ['warn', 'delete', 'both'].includes(d.action) ? d.action : 'warn',
    message: d.message || '', timeout: d.timeout || 0,
  };
}
export function saveAntiping(guildId, cfg) {
  const clean = {
    enabled: !!cfg.enabled,
    roles: IDS(cfg.roles), users: IDS(cfg.users), exemptRoles: IDS(cfg.exemptRoles),
    action: ['warn', 'delete', 'both'].includes(cfg.action) ? cfg.action : 'warn',
    message: String(cfg.message || '').slice(0, 500),
    timeout: Math.max(0, Math.min(1440, parseInt(cfg.timeout, 10) || 0)),
  };
  setSetting(guildId, 'antiping', clean);
  return clean;
}

const cd = new Map(); // per-user cooldown so we don't spam actions
// Passive. Returns true only if it DELETED the message (so the pipeline stops).
export async function checkAntiping(message) {
  if (message.author?.bot || !message.guild) return false;
  const cfg = getAntiping(message.guild.id);
  if (!cfg.enabled || (!cfg.roles.length && !cfg.users.length)) return false;

  const member = message.member;
  // Exempt: anyone who can manage messages, or holds an exempt role.
  if (member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return false;
  if (cfg.exemptRoles.some((r) => member?.roles?.cache?.has(r))) return false;

  // Was a protected user or role pinged?
  let pingedName = null;
  for (const u of (message.mentions?.users?.values?.() || [])) {
    if (u.id === message.author.id) continue;
    if (cfg.users.includes(u.id)) { pingedName = u.username; break; }
    const m = message.guild.members.cache.get(u.id);
    if (m && cfg.roles.some((r) => m.roles.cache.has(r))) { pingedName = u.username; break; }
  }
  if (!pingedName && message.mentions?.roles?.some?.((r) => cfg.roles.includes(r.id))) pingedName = 'that role';
  if (!pingedName) return false;

  const key = `${message.guild.id}:${message.author.id}`;
  if (Date.now() - (cd.get(key) || 0) < 3000) return false;
  cd.set(key, Date.now());

  let deleted = false;
  try {
    if (cfg.action === 'delete' || cfg.action === 'both') { await message.delete().catch(() => {}); deleted = true; }
    if (cfg.action === 'warn' || cfg.action === 'both') {
      const warn = (cfg.message || `🔕 {user}, please don’t ping **${pingedName}** — they’re protected staff.`)
        .replace(/\{user\}/g, `<@${message.author.id}>`).replace(/\{staff\}/g, pingedName);
      const sent = await message.channel.send({ content: warn.slice(0, 2000), allowedMentions: { users: [message.author.id] } }).catch(() => null);
      if (sent) setTimeout(() => sent.delete().catch(() => {}), 8000);
    }
    if (cfg.timeout > 0 && member?.moderatable) await member.timeout(cfg.timeout * 60000, 'Anti-ping: pinged protected staff').catch(() => {});
  } catch { /* missing perms — ignore */ }
  return deleted;
}
