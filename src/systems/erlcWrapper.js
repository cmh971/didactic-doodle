// ============================================================================
// ERLC API WRAPPER  (a.k.a. our "electrical panel" for api.erlc.gg)
// ----------------------------------------------------------------------------
// GOAL: instead of every file writing its own fetch() + Server-Key header +
// error handling, they all call THIS file. One place to:
//   1) know the URL + attach the key
//   2) NEVER get IP-banned (a rate-limit "governor" waits when we're near the
//      limit and backs off on 429)
//   3) turn ugly HTTP errors into readable messages
//
// HOW TO USE IT (this is the clean part your other code gets to write):
//   import { erlc } from '../systems/erlcWrapper.js';
//   try {
//     const players = await erlc.getPlayers(serverKey);   // -> array of players
//   } catch (e) {
//     // e.message is friendly, e.status is the HTTP code, e.code is ERLC's code
//   }
//
// TEACHING NOTES are marked with  // 📘
// ============================================================================

const BASE_V1 = 'https://api.erlc.gg/v1';
const BASE_V2 = 'https://api.erlc.gg/v2';

// 📘 A custom error type. When something goes wrong we `throw new ErlcError(...)`.
// Carrying `status` (the HTTP code) and `code` (ERLC's own error number) lets
// callers react differently to, say, a bad key (403) vs. a rate limit (429).
export class ErlcError extends Error {
  constructor(message, status, code) { super(message); this.name = 'ErlcError'; this.status = status; this.code = code; }
}

// 📘 Turn ERLC's numeric error codes / HTTP statuses into human sentences.
// (Codes from ERLC's docs — 9998 = wrong domain, 2000/2001 = key problems, etc.)
function friendly(status, body) {
  const code = body?.code;
  const map = {
    400: 'Bad request to the ER:LC API.',
    403: 'Invalid or missing Server-Key (403). Double-check the key.',
    404: 'That ER:LC server/endpoint was not found.',
    422: 'The ER:LC server has no players or the request was rejected (422).',
    429: 'ER:LC rate limit hit — backing off.',
    500: 'ER:LC had a server error (500). Try again shortly.',
  };
  return (body?.message) || map[status] || `ER:LC API error (HTTP ${status}${code ? `, code ${code}` : ''}).`;
}

// ----------------------------------------------------------------------------
// THE RATE-LIMIT GOVERNOR  (the whole reason this wrapper exists)
// ----------------------------------------------------------------------------
// 📘 ER:LC limits are PER SERVER-KEY, and if you blow them your whole IP gets
// banned. So for each key we keep a little "bucket" that remembers how many
// requests we have left and when the limit resets. We also run one key's
// requests one-at-a-time (a queue) so a burst can't all fire at once.
const buckets = new Map(); // key -> { chain: Promise, remaining: number, resetAt: ms }
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

function bucketFor(key) {
  if (!buckets.has(key)) buckets.set(key, { chain: Promise.resolve(), remaining: Infinity, resetAt: 0 });
  return buckets.get(key);
}

// 📘 `schedule` chains your request onto the key's queue, so requests for the
// same key never overlap. Returns a promise that resolves with your result.
function schedule(key, task) {
  const b = bucketFor(key);
  const run = b.chain.then(task, task); // run after whatever's already queued
  // keep the chain alive but don't let a rejection break future requests
  b.chain = run.then(() => {}, () => {});
  return run;
}

// ----------------------------------------------------------------------------
// THE CORE REQUEST  (everything else is a thin shortcut over this)
// ----------------------------------------------------------------------------
const cache = new Map(); // simple GET cache: cacheKey -> { data, expires }

async function core(key, url, { method = 'GET', body = null, cacheTtl = 0, retries = 2 } = {}) {
  if (!key) throw new ErlcError('No Server-Key provided.', 0);

  // 📘 Serve from cache for repeated GET polls (e.g. two features asking for the
  // player list within a few seconds) — saves a real API hit.
  const cacheKey = method + ' ' + url;
  if (method === 'GET' && cacheTtl > 0) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.data;
  }

  return schedule(key, async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const b = bucketFor(key);
      // 📘 If we're out of budget, wait until the window resets before firing.
      if (b.remaining <= 0 && b.resetAt > Date.now()) await sleep(b.resetAt - Date.now() + 50);

      let res;
      try {
        res = await fetch(url, {
          method,
          headers: { 'Server-Key': key, 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(15000),
        });
      } catch (e) {
        if (attempt < retries) { await sleep(500 * (attempt + 1)); continue; } // network blip → retry
        throw new ErlcError(e.name === 'TimeoutError' ? 'ER:LC API timed out.' : `Network error: ${e.message}`, 0);
      }

      // 📘 Read the rate-limit headers ER:LC sends back and remember them.
      const remaining = Number(res.headers.get('X-RateLimit-Remaining'));
      const reset = Number(res.headers.get('X-RateLimit-Reset'));
      if (!Number.isNaN(remaining)) b.remaining = remaining;
      if (!Number.isNaN(reset)) b.resetAt = reset > 1e12 ? reset : reset * 1000; // secs or ms → ms

      const text = await res.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }

      // 📘 429 = we hit the limit. Wait the server-told amount, then retry.
      if (res.status === 429) {
        const wait = Number(res.headers.get('Retry-After')) * 1000 || (data?.retry_after ? data.retry_after * 1000 : 2000);
        b.remaining = 0; b.resetAt = Date.now() + wait;
        if (attempt < retries) { await sleep(wait + 50); continue; }
        throw new ErlcError('ER:LC rate limit — try again shortly.', 429, data?.code);
      }

      if (!res.ok) throw new ErlcError(friendly(res.status, data), res.status, data?.code);

      if (method === 'GET' && cacheTtl > 0) cache.set(cacheKey, { data, expires: Date.now() + cacheTtl });
      return data;
    }
  });
}

// ----------------------------------------------------------------------------
// THE FRIENDLY METHODS  (this is what the rest of the bot actually calls)
// ----------------------------------------------------------------------------
export const erlc = {
  raw: core, // escape hatch if you need a custom call

  // --- v1 reads (default 5s cache so pollers don't double-hit) ---
  getServer: (key, ttl = 5000) => core(key, `${BASE_V1}/server`, { cacheTtl: ttl }),
  getPlayers: (key, ttl = 5000) => core(key, `${BASE_V1}/server/players`, { cacheTtl: ttl }),
  getVehicles: (key, ttl = 5000) => core(key, `${BASE_V1}/server/vehicles`, { cacheTtl: ttl }),
  getQueue: (key, ttl = 5000) => core(key, `${BASE_V1}/server/queue`, { cacheTtl: ttl }),
  getJoinLogs: (key, ttl = 5000) => core(key, `${BASE_V1}/server/joinlogs`, { cacheTtl: ttl }),
  getKillLogs: (key, ttl = 5000) => core(key, `${BASE_V1}/server/killlogs`, { cacheTtl: ttl }),
  getCommandLogs: (key, ttl = 5000) => core(key, `${BASE_V1}/server/commandlogs`, { cacheTtl: ttl }),
  getModCalls: (key, ttl = 5000) => core(key, `${BASE_V1}/server/modcalls`, { cacheTtl: ttl }),
  getBans: (key, ttl = 10000) => core(key, `${BASE_V1}/server/bans`, { cacheTtl: ttl }),

  // --- v1 write: run an in-game command (e.g. ":pm player msg") ---
  runCommand: (key, command) => core(key, `${BASE_V1}/server/command`, { method: 'POST', body: { command } }),

  // --- v2: one call that can bundle many datasets via query flags ---
  // e.g. getV2(key, { Players:true, Vehicles:true, CommandLogs:true })
  getV2: (key, flags = { Players: true }, ttl = 5000) => {
    const qs = Object.entries(flags).filter(([, v]) => v).map(([k]) => `${k}=true`).join('&');
    return core(key, `${BASE_V2}/server?${qs}`, { cacheTtl: ttl });
  },
};

export default erlc;
