// Live "pulse" of a guild — a rolling in-memory window of recent message events.
//
// Powers the /pulse dashboard page: messages/min, a 15-minute heartbeat graph, and
// "who's talking right now". Everything here is in-memory and best-effort — it runs
// on every message, so it must NEVER throw into the hot path or hold real memory:
// the window self-prunes to WINDOW_MS, so it stays tiny even in a busy server.
const WINDOW_MS = 15 * 60 * 1000; // keep the last 15 minutes of events
const BUCKETS = 30;               // heartbeat resolution: 30 buckets → 30s each
const events = [];                // { t, g, u } oldest → newest

// Drop everything older than the window. Called on write and on read.
function prune(now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  let i = 0;
  while (i < events.length && events[i].t < cutoff) i++;
  if (i) events.splice(0, i);
}

// Record one human message. Wrapped so a bad message object can never crash the
// message handler.
export function recordPulse(message) {
  try {
    if (!message?.guild || message.author?.bot) return;
    events.push({ t: Date.now(), g: String(message.guild.id), u: String(message.author.id) });
    prune();
  } catch { /* never throw into messageCreate */ }
}

// Snapshot the live pulse for one guild (or all guilds when guildId is null).
export function pulseSnapshot(guildId = null) {
  const now = Date.now();
  prune(now);
  const gid = guildId ? String(guildId) : null;
  const mine = gid ? events.filter((e) => e.g === gid) : events;

  // messages in the last 60s → "messages/min" headline
  const lastMin = mine.reduce((n, e) => n + (e.t >= now - 60000 ? 1 : 0), 0);

  // heartbeat: BUCKETS bins across the whole window, oldest → newest
  const cutoff = now - WINDOW_MS;
  const span = WINDOW_MS / BUCKETS;
  const beats = new Array(BUCKETS).fill(0);
  for (const e of mine) {
    const idx = Math.floor((e.t - cutoff) / span);
    if (idx >= 0 && idx < BUCKETS) beats[idx]++;
  }

  // top talkers across the window
  const counts = new Map();
  for (const e of mine) counts.set(e.u, (counts.get(e.u) || 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, n]) => ({ id, n }));

  return { lastMin, total: mine.length, beats, top, windowMin: WINDOW_MS / 60000, buckets: BUCKETS };
}
