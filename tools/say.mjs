#!/usr/bin/env node
// tools/say.mjs — let the lead dev talk to the community THROUGH the bot.
// This posts a REAL public message. We talk, but not too much — use sparingly.
//
//   node tools/say.mjs <#channel|name|id> <your message...>
//   node tools/say.mjs general "Hey everyone — quick heads up ..."
import { api, resolveChannel } from './lib.mjs';

const [target, ...rest] = process.argv.slice(2);
const content = rest.join(' ').trim();

if (!target || !content) {
  console.error('usage: node tools/say.mjs <#channel|name|id> <message>');
  process.exit(1);
}

try {
  const ch = await resolveChannel(target);
  await api(`/channels/${ch.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });
  console.log(`✅ Sent to #${ch.name}:\n   ${content}`);
} catch (e) {
  console.error('say error:', e.message);
  process.exit(1);
}
