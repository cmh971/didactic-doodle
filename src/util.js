// Small shared helpers for the economy / fun commands.
import { MessageFlags } from 'discord.js';

export const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

export function fmtDuration(ms) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec || !parts.length) parts.push(`${sec}s`);
  return parts.join(' ');
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const rint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
