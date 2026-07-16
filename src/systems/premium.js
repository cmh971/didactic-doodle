// Premium tier (per-guild). Premium servers get boosted payouts, a badge, and
// access to premium-only perks. Granted by a bot owner (OWNER_IDS) or redeem code.
import { getGuild, saveGuild } from './guilds.js';

export const DAILY_MULT = 2;
export const WORK_MULT = 2;
export const GAMBLE_EDGE = 0.05; // small bonus win-chance on gambles

export const PREMIUM_PERKS = [
  '💰 **2× daily & work** payouts',
  '🎰 Slightly better gambling odds',
  '💎 Exclusive premium badge on your profile',
  '🤖 Priority AI responses',
  '🛒 Access to premium-only shop items',
  '✨ Early access to new features',
];

export function getPremium(guildId) {
  const g = getGuild(guildId);
  return g.settings.premium || { active: false, until: 0 };
}

export function isPremium(guildId) {
  if (!guildId) return false;
  const p = getPremium(guildId);
  if (!p.active) return false;
  if (p.until && Date.now() > p.until) return false;
  return true;
}

export function grantPremium(guildId, days = 30) {
  const g = getGuild(guildId);
  const until = days > 0 ? Date.now() + days * 86_400_000 : 0; // 0 = lifetime
  g.settings = { ...g.settings, premium: { active: true, until } };
  saveGuild(g);
  return g.settings.premium;
}

export function revokePremium(guildId) {
  const g = getGuild(guildId);
  g.settings = { ...g.settings, premium: { active: false, until: 0 } };
  saveGuild(g);
}
