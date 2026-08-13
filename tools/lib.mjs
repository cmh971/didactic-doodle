// tools/lib.mjs — shared Discord REST helpers for the lead-dev tools (peek/say).
// Uses the bot token from .env. Nothing here runs as part of the bot itself.
import 'dotenv/config';

export const TOKEN = process.env.DISCORD_TOKEN;
export const GUILD = process.env.PEEK_GUILD || '1521295950654734538'; // Sentinel
const API = 'https://discord.com/api/v10';

if (!TOKEN) { console.error('❌ No DISCORD_TOKEN in .env'); process.exit(1); }

export async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bot ${TOKEN}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export const strip = (s) => String(s || '').replace(/[^\w-]/g, '').toLowerCase();

export async function textChannels() {
  const chs = await api(`/guilds/${GUILD}/channels`);
  return chs.filter((c) => [0, 5, 15].includes(c.type)); // text, announce, forum
}

export async function resolveChannel(q) {
  const raw = String(q).replace(/[<#>]/g, '');
  if (/^\d{5,}$/.test(raw)) return { id: raw, name: raw };
  const chs = await textChannels();
  const nq = strip(raw);
  const hit = chs.find((c) => strip(c.name) === nq) || chs.find((c) => strip(c.name).includes(nq));
  if (!hit) throw new Error(`No channel matching "${q}". Run: node tools/peek.mjs channels`);
  return hit;
}
