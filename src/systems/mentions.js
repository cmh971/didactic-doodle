// Bot @mention inbox. When someone pings the bot, messageCreate calls
// recordMention() — the AI no longer auto-replies to pings, so this makes sure
// the ping still reaches us: it logs the ping (mirrored to the dashboard + PM2)
// and appends a line to data/mentions.jsonl. `node tools/peek.mjs pings` reads
// it back as a notification inbox for the lead dev.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const FILE = 'data/mentions.jsonl';

export function recordMention(message) {
  const entry = {
    at: new Date().toISOString(),
    guild: message.guild?.name,
    guildId: message.guild?.id,
    channel: message.channel?.name,
    channelId: message.channel?.id,
    author: message.author?.username,
    authorId: message.author?.id,
    content: (message.content || '').replace(/<@!?\d+>/g, '').trim().slice(0, 500),
    url: message.url,
  };
  console.log(`📣 PING — ${entry.author} pinged the bot in #${entry.channel}: ${entry.content || '(no text)'}`);
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    appendFileSync(FILE, JSON.stringify(entry) + '\n');
  } catch { /* inbox is best-effort; never break message handling over it */ }
  return entry;
}

export function readMentions(limit = 20) {
  try {
    const lines = readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}
