#!/usr/bin/env node
// tools/typing.mjs — make the bot show "Sentinel is typing…" in a channel.
// Run this right before replying with say.mjs so the reply feels natural/live.
// A Discord typing indicator lasts ~10s per pulse, so pass a seconds value to
// HOLD it (it re-pulses every ~8s). Run the hold version in the background so
// you can compose + say while it keeps typing.
//
//   node tools/typing.mjs <#channel|name|id>          one ~10s pulse
//   node tools/typing.mjs <#channel|name|id> 15       hold typing ~15s (max 60)
import { api, resolveChannel } from './lib.mjs';

const [target, secArg] = process.argv.slice(2);
if (!target) {
  console.error('usage: node tools/typing.mjs <#channel|name|id> [seconds]');
  process.exit(1);
}

const seconds = secArg ? Math.min(Math.max(parseInt(secArg, 10) || 0, 1), 60) : 0;

try {
  const ch = await resolveChannel(target);
  const pulse = () => api(`/channels/${ch.id}/typing`, { method: 'POST' });
  if (!seconds) {
    await pulse();
    console.log(`✅ Typing pulse sent to #${ch.name} (~10s)`);
  } else {
    const end = Date.now() + seconds * 1000;
    do {
      await pulse();
      const remain = end - Date.now();
      if (remain <= 0) break;
      await new Promise((r) => setTimeout(r, Math.min(8000, remain)));
    } while (Date.now() < end);
    console.log(`✅ Held typing in #${ch.name} for ~${seconds}s`);
  }
} catch (e) {
  console.error('typing error:', e.message);
  process.exit(1);
}
