// Roblox account linking via the PUBLIC Roblox API (no key needed).
// Flow: /link start <username> -> bot gives a code -> user puts it in their Roblox
// profile "About" -> /link verify -> bot reads the profile and confirms.
import { getDb } from '../db/index.js';

const db = getDb();
const st = {
  set: db.prepare('INSERT OR REPLACE INTO roblox_links(guild_id,user_id,roblox_id,roblox_name) VALUES (?,?,?,?)'),
  get: db.prepare('SELECT * FROM roblox_links WHERE guild_id=? AND user_id=?'),
  del: db.prepare('DELETE FROM roblox_links WHERE guild_id=? AND user_id=?'),
  all: db.prepare('SELECT * FROM roblox_links WHERE guild_id=?'),
};
const pending = new Map(); // `${g}:${u}` -> {robloxId, name, code}

export const getLink = (g, u) => st.get.get(g, u);
export const unlink = (g, u) => st.del.run(g, u);
export const allLinks = (g) => st.all.all(g);
export const saveLink = (g, u, robloxId, name) => st.set.run(g, u, String(robloxId), name);

export async function resolveRoblox(username) {
  try {
    const r = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const u = d.data?.[0];
    return u ? { id: String(u.id), name: u.name } : null;
  } catch {
    return null;
  }
}

export async function getDescription(robloxId) {
  try {
    const r = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
    if (!r.ok) return '';
    return (await r.json()).description || '';
  } catch {
    return '';
  }
}

/** Headshot thumbnail URL for a Roblox user id (public API). */
export async function getRobloxAvatar(robloxId) {
  try {
    const r = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`);
    if (!r.ok) return null;
    return (await r.json()).data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

export function startVerify(g, u, robloxId, name) {
  const code = 'UNO-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  pending.set(`${g}:${u}`, { robloxId, name, code });
  return code;
}

export async function completeVerify(g, u) {
  const p = pending.get(`${g}:${u}`);
  if (!p) return { ok: false, reason: 'No pending verification — run `/link start` first.' };
  const desc = await getDescription(p.robloxId);
  if (!desc.includes(p.code)) return { ok: false, reason: 'Code not found in your Roblox profile "About" yet. Add it and retry.' };
  st.set.run(g, u, p.robloxId, p.name);
  pending.delete(`${g}:${u}`);
  return { ok: true, name: p.name, id: p.robloxId };
}
