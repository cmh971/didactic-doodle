#!/usr/bin/env node
// tools/demo_typing.mjs — ONE-SHOT live demo of the typing→reply effect.
// Waits for Chris to post in #general, then shows the bot "typing…" for ~5s and
// drops a reply, so it looks like the bot genuinely typed it out. Not part of
// the bot; a hand-run demo. Times out after 90s if nobody types.
import { api, resolveChannel } from './lib.mjs';

const CHRIS = 'chris201492';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ch = await resolveChannel('general');

// Baseline: the newest existing message id, so we only react to something NEW.
const base = await api(`/channels/${ch.id}/messages?limit=1`);
let lastId = base[0]?.id || '0';
console.log('👂 Armed — waiting for you to type in #general…');

const deadline = Date.now() + 90_000;
let target = null;
while (Date.now() < deadline) {
  const msgs = await api(`/channels/${ch.id}/messages?after=${lastId}&limit=10`);
  const fromChris = msgs.filter((m) => m.author?.username === CHRIS);
  if (fromChris.length) { target = fromChris[0]; break; } // newest from Chris
  if (msgs.length) lastId = msgs[0].id;                   // advance past others
  await sleep(2000);
}

if (!target) { console.log('⌛ Timed out — nobody typed. Re-run to try again.'); process.exit(0); }

console.log(`✅ Saw your message: "${(target.content || '').slice(0, 80)}"`);
await sleep(1000);

// Show "typing…" for ~5s (pulse lasts ~10s; one is plenty, second is insurance).
await api(`/channels/${ch.id}/typing`, { method: 'POST' });
await sleep(4000);
await api(`/channels/${ch.id}/typing`, { method: 'POST' });
await sleep(1200);

const said = (target.content || '').replace(/<@!?\d+>/g, '').trim();
const reply = said
  ? 'Yep — I saw that 👀 (and I really did just type this out for a few seconds first). — Sentinel'
  : '👀 You rang? I waited, typed for a few seconds, and here I am. — Sentinel';
await api(`/channels/${ch.id}/messages`, { method: 'POST', body: JSON.stringify({ content: reply }) });
console.log('💬 Replied.');
// end of demo_typing.mjs