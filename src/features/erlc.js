// Real ER:LC (Emergency Response: Liberty County) integration via the official
// PRC API (https://apidocs.policeroleplay.community). Needs a private-server key:
// set ERLC_API_KEY in .env, or per-guild settings.erlcKey.
import { getCfg } from '../setup/store.js';

const BASE = 'https://api.policeroleplay.community/v1';

export function erlcKey(guildId) {
  return getCfg(guildId).settings.erlcKey || process.env.ERLC_API_KEY || null;
}

export async function erlc(guildId, path, { method = 'GET', body } = {}) {
  const key = erlcKey(guildId);
  if (!key) return { ok: false, error: 'No ERLC server key set. Add `ERLC_API_KEY` to .env (or settings.erlcKey).' };
  try {
    const r = await fetch(BASE + path, {
      method,
      headers: { 'Server-Key': key, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!r.ok) return { ok: false, error: (data && data.message) || `HTTP ${r.status}`, status: r.status };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Run an in-game command (e.g. ":h hi", ":ban User", ":unban User").
export const runCommand = (guildId, command) => erlc(guildId, '/server/command', { method: 'POST', body: { command } });
