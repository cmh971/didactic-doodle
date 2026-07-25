// Real ER:LC (Emergency Response: Liberty County) integration via the official
// PRC API (https://apidocs.policeroleplay.community). Needs a private-server key:
// set ERLC_API_KEY in .env, or per-guild settings.erlcKey.
import { getCfg } from '../setup/store.js';
import { decryptSecret } from '../systems/secureStore.js';
import { cache } from '../db/cache.js';

const BASE = 'https://api.policeroleplay.community/v1';
// Short-lived cache for GET reads. The ER:LC API is the slow part (a network
// round-trip to another server) — caching its responses for a few seconds means
// repeated reads (dashboard polling, the session builder, back-to-back /erlc)
// return instantly from Redis/memory instead of re-hitting their API. THIS is
// the real "ER:LC accelerator" (you can't speed up someone else's webserver,
// but you can stop asking it the same question 10× a second).
const ERLC_CACHE_TTL = 8; // seconds

export function erlcKey(guildId) {
  const s = getCfg(guildId).settings;
  // Preferred: the dual-guarded encrypted key (set via dashboard). Falls back to a
  // legacy plaintext value or the global env key.
  if (s.erlcKeyEnc) {
    const dec = decryptSecret(s.erlcKeyEnc);
    if (dec) return dec;
  }
  return s.erlcKey || process.env.ERLC_API_KEY || null;
}

export async function erlc(guildId, path, { method = 'GET', body } = {}) {
  const key = erlcKey(guildId);
  if (!key) return { ok: false, error: 'No ERLC server key set. Add `ERLC_API_KEY` to .env (or settings.erlcKey).' };

  const cacheable = method === 'GET';
  const ckey = `erlc:${guildId}:${path}`;
  if (cacheable) {
    try { const hit = await cache.get(ckey); if (hit) return { ok: true, data: JSON.parse(hit), cached: true }; } catch { /* cache miss/parse — fall through */ }
  }

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
    if (cacheable) { try { await cache.set(ckey, JSON.stringify(data), ERLC_CACHE_TTL); } catch { /* cache write best-effort */ } }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Run an in-game command (e.g. ":h hi", ":ban User", ":unban User").
export const runCommand = (guildId, command) => erlc(guildId, '/server/command', { method: 'POST', body: { command } });
