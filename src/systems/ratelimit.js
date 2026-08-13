// Global anti-spam rate limiter — shared by the bot (button/command spam) and the
// website (API/click spam). Escalation, exactly as specified:
//   spam burst → warning 1 → warning 2 → TIMEOUT (temporary) → LOCKOUT (persistent,
//   owner must review/unlock). Lockout is the ABSOLUTE last resort (only after
//   repeated timeouts). Locks survive restarts (stored in SQLite).
import { getDb } from '../db/index.js';

const db = getDb();
db.exec('CREATE TABLE IF NOT EXISTS ratelimit_locks (actor TEXT PRIMARY KEY, scope TEXT, reason TEXT, at INTEGER)');
const q = {
  lock: db.prepare('INSERT INTO ratelimit_locks(actor,scope,reason,at) VALUES(?,?,?,?) ON CONFLICT(actor) DO UPDATE SET reason=excluded.reason, at=excluded.at'),
  unlock: db.prepare('DELETE FROM ratelimit_locks WHERE actor=?'),
  is: db.prepare('SELECT 1 FROM ratelimit_locks WHERE actor=?'),
  all: db.prepare('SELECT * FROM ratelimit_locks ORDER BY at DESC LIMIT 100'),
};

const CFG = {
  windowMs: 3000,     // burst window
  burst: 6,           // >6 actions in 3s = spam
  warnStrikes: 2,     // two warnings…
  timeoutMs: 5 * 60 * 1000, // …then a 5-minute timeout
  maxTimeouts: 2,     // …two timeouts → locked (last resort)
};
const state = new Map(); // actor -> { times, strikes, timeoutUntil, timeouts }

export function isLocked(actor) { return !!q.is.get(actor); }
export function unlock(actor) { q.unlock.run(actor); state.delete(actor); }
export function listLocked() { return q.all.all(); }

// Returns { action: 'ok'|'warn'|'timeout'|'locked', message?, strikes?, retryMs? }
export function hit(actor, scope = 'bot') {
  if (isLocked(actor)) return { action: 'locked', message: '🔒 You’re locked out for excessive spam. An admin has to review and lift it.' };
  const now = Date.now();
  let s = state.get(actor);
  if (!s) { s = { times: [], strikes: 0, timeoutUntil: 0, timeouts: 0 }; state.set(actor, s); }

  if (s.timeoutUntil > now) {
    return { action: 'timeout', retryMs: s.timeoutUntil - now, message: `⏳ You’re doing that too fast — timed out for ${Math.ceil((s.timeoutUntil - now) / 60000)} more minute(s).` };
  }

  s.times.push(now);
  s.times = s.times.filter((t) => now - t < CFG.windowMs);
  if (s.times.length <= CFG.burst) return { action: 'ok' };

  // over the burst → escalate
  s.times = [];
  s.strikes++;
  if (s.strikes <= CFG.warnStrikes) {
    const final = s.strikes >= CFG.warnStrikes;
    return { action: 'warn', strikes: s.strikes, message: final ? `⚠️ **Final warning** — stop spamming (${s.strikes}/${CFG.warnStrikes}). Next one times you out.` : `⚠️ Slow down! You’re clicking too fast (warning ${s.strikes}/${CFG.warnStrikes}).` };
  }
  // past the warnings → timeout, or lock if they keep it up
  s.strikes = 0; s.timeouts++;
  if (s.timeouts >= CFG.maxTimeouts) {
    q.lock.run(actor, scope, 'Repeated spam after timeouts', now);
    return { action: 'locked', message: '🔒 You’ve been locked out for repeated spam. An admin must review it.' };
  }
  s.timeoutUntil = now + CFG.timeoutMs;
  return { action: 'timeout', retryMs: CFG.timeoutMs, message: `⏳ Too many actions — timed out for ${CFG.timeoutMs / 60000} minutes.` };
}

// ---- owner review: !locks / !unlock ----
const FALLBACK_OWNER = '1183222250153984040';
const isOwner = (id) => { const ids = (process.env.OWNER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean); return ids.length ? ids.includes(id) : id === FALLBACK_OWNER; };
export async function handleRateLimitCommand(message) {
  const m = /^!(locks|unlock)\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m) return false;
  if (!isOwner(message.author.id)) { await message.reply('🔒 Owner only.').catch(() => {}); return true; }
  if (m[1].toLowerCase() === 'locks') {
    const rows = listLocked();
    if (!rows.length) return message.reply('✅ Nobody is locked out.').catch(() => {});
    return message.reply('🔒 **Locked out (awaiting review):**\n' + rows.map((r) => `• \`${r.actor}\` (${r.scope}) — ${r.reason} — <t:${Math.floor(r.at / 1000)}:R>`).join('\n').slice(0, 1900)).catch(() => {});
  }
  const target = (m[2] || '').trim().replace(/[<@!>]/g, '');
  if (!target) return message.reply('Usage: `!unlock <userId>` (or the `web:...` actor from `!locks`)').catch(() => {});
  unlock(target); unlock('web:' + target);
  return message.reply(`✅ Unlocked \`${target}\`. They’re off the naughty list.`).catch(() => {});
}
