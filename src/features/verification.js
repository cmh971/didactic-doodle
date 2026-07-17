// Website-driven Roblox verification with a role swap.
//
// Flow: user runs /verify in a server -> bot DMs them a short code phrase ->
// they paste it into their Roblox profile "About" -> on the website they enter
// their Roblox username and confirm ("does this look right?") -> we read their
// Roblox profile, confirm the code is present, then REMOVE the unverified role
// and ADD the verified role configured for that guild.
import { resolveRoblox, getDescription, getRobloxAvatar, saveLink } from './roblox.js';
import { getCfg } from '../setup/store.js';

// Ephemeral pending codes: `${guildId}:${userId}` -> { code, at }
const pending = new Map();
const TTL = 30 * 60 * 1000; // 30 minutes

const WORDS = [
  'apple', 'river', 'tiger', 'cloud', 'stone', 'maple', 'comet', 'ember', 'frost', 'harbor',
  'jungle', 'lunar', 'meadow', 'nebula', 'oasis', 'pepper', 'quartz', 'raven', 'summit', 'thunder',
  'violet', 'willow', 'zephyr', 'anchor', 'blaze', 'cedar', 'delta', 'falcon', 'glacier', 'hazel',
];

function makeCode() {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return `sentinel-${pick()}-${pick()}-${pick()}`;
}

/** Start (or restart) a verification and return the code the user must add to Roblox. */
export function startVerification(guildId, userId) {
  const code = makeCode();
  pending.set(`${guildId}:${userId}`, { code, at: Date.now() });
  return code;
}

/** The active code for this user+guild, or null if none/expired. */
export function pendingCode(guildId, userId) {
  const p = pending.get(`${guildId}:${userId}`);
  if (!p) return null;
  if (Date.now() - p.at > TTL) { pending.delete(`${guildId}:${userId}`); return null; }
  return p.code;
}

/** Preview a Roblox account (for the "does this look right?" step). */
export async function previewRoblox(username) {
  const r = await resolveRoblox(username);
  if (!r) return null;
  const avatar = await getRobloxAvatar(r.id);
  return { id: r.id, name: r.name, avatar };
}

/**
 * Finish verification: confirm the pending code is in the Roblox "About", then
 * swap roles on the member. `client` is the discord.js client.
 */
export async function completeVerification(client, guildId, userId, username) {
  const code = pendingCode(guildId, userId);
  if (!code) return { ok: false, error: 'No active verification. Run /verify in the server first (the code expires after 30 minutes).' };

  const rblx = await resolveRoblox(username);
  if (!rblx) return { ok: false, error: `Couldn't find a Roblox user named "${username}".` };

  const desc = await getDescription(rblx.id);
  if (!String(desc).toLowerCase().includes(code.toLowerCase())) {
    const avatar = await getRobloxAvatar(rblx.id);
    return { ok: false, error: 'Your code isn\'t in your Roblox profile "About" yet. Add it, hit Save on Roblox, then verify again.', roblox: { ...rblx, avatar }, code };
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: 'The bot is not in that server anymore.' };
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return { ok: false, error: 'You are not a member of that server.' };

  const vcfg = getCfg(guildId).settings.verify || {};
  let added = false, removed = false, nick = false;
  if (vcfg.verifiedRoleId) added = await member.roles.add(vcfg.verifiedRoleId, 'Roblox verification').then(() => true).catch(() => false);
  if (vcfg.unverifiedRoleId) removed = await member.roles.remove(vcfg.unverifiedRoleId, 'Roblox verification').then(() => true).catch(() => false);
  if (vcfg.nickname) nick = await member.setNickname(rblx.name).then(() => true).catch(() => false);

  saveLink(guildId, userId, rblx.id, rblx.name);
  pending.delete(`${guildId}:${userId}`);
  const avatar = await getRobloxAvatar(rblx.id);
  return { ok: true, roblox: { ...rblx, avatar }, added, removed, nick };
}
