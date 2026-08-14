// Timezone toolkit — shared by the LOA system (activityManagement.js) and anything
// else that needs to turn a human's "2:30pm EST on Aug 20" into a real epoch and
// render it as a Discord timestamp (so every viewer sees their own local time).
//
//   !timezone [zone]   — save / show your timezone (used by .loa request start/end)
import { PermissionFlagsBits } from 'discord.js';
import { getDb } from '../db/index.js';

const db = getDb();
db.exec('CREATE TABLE IF NOT EXISTS user_timezone (user_id TEXT PRIMARY KEY, tz TEXT)');
const q = {
  set: db.prepare('INSERT INTO user_timezone(user_id,tz) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET tz=excluded.tz'),
  get: db.prepare('SELECT tz FROM user_timezone WHERE user_id=?'),
};
export const getUserTz = (userId) => q.get.get(userId)?.tz || null;
export const setUserTz = (userId, tz) => q.set.run(userId, tz);

// ---- timezone resolution --------------------------------------------------
const ABBREV = {
  UTC: 'UTC', GMT: 'UTC', Z: 'UTC',
  EST: 'America/New_York', EDT: 'America/New_York', ET: 'America/New_York',
  CST: 'America/Chicago', CDT: 'America/Chicago', CT: 'America/Chicago',
  MST: 'America/Denver', MDT: 'America/Denver', MT: 'America/Denver',
  PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles', PT: 'America/Los_Angeles',
  AKST: 'America/Anchorage', HST: 'Pacific/Honolulu', AST: 'America/Halifax',
  BST: 'Europe/London', WET: 'Europe/Lisbon', CET: 'Europe/Paris', CEST: 'Europe/Paris',
  EET: 'Europe/Athens', MSK: 'Europe/Moscow', IST: 'Asia/Kolkata',
  GST: 'Asia/Dubai', PKT: 'Asia/Karachi', BDT: 'Asia/Dhaka',
  ICT: 'Asia/Bangkok', SGT: 'Asia/Singapore', HKT: 'Asia/Hong_Kong',
  JST: 'Asia/Tokyo', KST: 'Asia/Seoul', AWST: 'Australia/Perth',
  ACST: 'Australia/Adelaide', AEST: 'Australia/Sydney', AEDT: 'Australia/Sydney',
  NZST: 'Pacific/Auckland', NZDT: 'Pacific/Auckland', BRT: 'America/Sao_Paulo',
};
function validTz(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } }
// → { tz } (IANA) or { offsetMin } (fixed), plus a display label; null if unknown.
export function resolveTz(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/^(?:utc|gmt)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    const offsetMin = sign * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
    return { offsetMin, label: `UTC${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}` };
  }
  const ab = ABBREV[s.toUpperCase()];
  if (ab) return { tz: ab, label: `${s.toUpperCase()} (${ab})` };
  if (validTz(s)) return { tz: s, label: s };
  return null;
}
// Offset (ms) of a tz at a given instant.
function tzOffsetMs(instant, tz) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const hour = p.hour === '24' ? '00' : p.hour;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second) - instant.getTime();
}
// Wall-clock components interpreted in a resolved zone → epoch ms.
export function zonedToEpoch(y, mo, d, h, mi, resolved) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (resolved.offsetMin != null) return guess - resolved.offsetMin * 60000;
  return guess - tzOffsetMs(new Date(guess), resolved.tz);
}

// ---- flexible date/time parsing ------------------------------------------
const MN = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function parseDateTime(str) {
  if (!str) return null;
  let s = String(str).trim();
  let h = 0, mi = 0;
  const tm = s.match(/(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?/i);
  if (tm) {
    h = +tm[1]; mi = +tm[2];
    const ap = (tm[3] || '').toLowerCase();
    if (ap.startsWith('p') && h < 12) h += 12;
    if (ap.startsWith('a') && h === 12) h = 0;
    s = s.replace(tm[0], ' ');
  } else {
    const ampmOnly = s.match(/\b(\d{1,2})\s*([ap]\.?m\.?)\b/i);
    if (ampmOnly) { h = +ampmOnly[1]; const ap = ampmOnly[2].toLowerCase(); if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0; s = s.replace(ampmOnly[0], ' '); }
  }
  let y, mo, d;
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const us = s.match(/(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?/);
  const mnm = s.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (iso) { y = +iso[1]; mo = +iso[2]; d = +iso[3]; }
  else if (mnm) { mo = MN[mnm[1]]; d = +mnm[2]; y = mnm[3] ? +mnm[3] : new Date().getUTCFullYear(); }
  else if (us) { mo = +us[1]; d = +us[2]; y = us[3] ? (+us[3] < 100 ? 2000 + +us[3] : +us[3]) : new Date().getUTCFullYear(); }
  else return null;
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  return { y, mo, d, h, mi };
}

export const ts = (epochMs, style = 'F') => `<t:${Math.floor(epochMs / 1000)}:${style}>`;
export const humanDur = (ms) => {
  const mins = Math.round(ms / 60000), days = Math.floor(mins / 1440), hrs = Math.floor((mins % 1440) / 60), m = mins % 60;
  return [days && `${days}d`, hrs && `${hrs}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m';
};

// Parse "<start> | <end> [| tz]" (or "<start> to <end>") into resolved epochs, using
// the user's saved tz unless an override is given. Returns { startAt, endAt, label }
// or { error }.
export function parseWindow(startStr, endStr, tzOverride, userId) {
  const resolved = resolveTz(tzOverride) || resolveTz(getUserTz(userId));
  if (!resolved) {
    return { error: tzOverride
      ? `I don’t recognise the timezone **${tzOverride}**. Try \`America/New_York\`, \`EST\`, or \`UTC-5\`.`
      : 'Set your timezone first with `!timezone <zone>` (e.g. `!timezone EST`), or add one to the request.' };
  }
  const s = parseDateTime(startStr), e = parseDateTime(endStr);
  if (!s) return { error: `Couldn’t read the **start** date/time: \`${startStr}\`. Try \`2026-08-20 2:30pm\`.` };
  if (!e) return { error: `Couldn’t read the **end** date/time: \`${endStr}\`. Try \`2026-08-27 9:00am\`.` };
  const startAt = zonedToEpoch(s.y, s.mo, s.d, s.h, s.mi, resolved);
  const endAt = zonedToEpoch(e.y, e.mo, e.d, e.h, e.mi, resolved);
  if (endAt <= startAt) return { error: 'The **end** time has to be after the **start** time.' };
  return { startAt, endAt, label: resolved.label };
}

// ---- !timezone / !tz ------------------------------------------------------
export async function handleTimezoneText(message) {
  const raw = (message.content || '').trim();
  if (!message.guild || !/^!(timezone|tz)\b/i.test(raw)) return false;
  const arg = raw.replace(/^!(timezone|tz)\b/i, '').trim();
  if (!arg) {
    const cur = getUserTz(message.author.id);
    await message.reply(cur
      ? `🕒 Your saved timezone is **${cur}** — it’s ${ts(Date.now(), 't')} for you. Change it with \`!timezone <zone>\`.`
      : '🕒 You haven’t set a timezone. Use `!timezone <zone>` — e.g. `!timezone EST`, `!timezone America/New_York`, or `!timezone UTC-5`. It’s used for `.loa` start/end times.').catch(() => {});
    return true;
  }
  const r = resolveTz(arg);
  if (!r) { await message.reply(`❌ Don’t recognise **${arg}**. Try a name like \`America/New_York\`, an abbreviation like \`EST\`, or \`UTC-5\`.`).catch(() => {}); return true; }
  if (r.offsetMin != null) { await message.reply('⚠️ Fixed offsets like that aren’t saved (they don’t track daylight saving). Save a named zone instead — e.g. `!timezone EST` — you can still use an offset on a single request.').catch(() => {}); return true; }
  setUserTz(message.author.id, r.tz);
  await message.reply(`✅ Saved your timezone as **${r.tz}**. Your \`.loa\` start/end times will use it. Right now it’s ${ts(Date.now(), 't')} for you.`).catch(() => {});
  return true;
}
