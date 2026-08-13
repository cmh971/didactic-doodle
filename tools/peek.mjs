#!/usr/bin/env node
// tools/peek.mjs — the lead dev's "eyes on the server" tool. READ-ONLY.
// See the community, watch #bug-reports, grab screenshot URLs, check pings.
//
//   node tools/peek.mjs guilds                    list guilds the bot is in
//   node tools/peek.mjs channels                  list channels in the guild
//   node tools/peek.mjs <#name|name|id> [n]       last n messages (default 15, max 50)
//   node tools/peek.mjs bugs [n]                   shortcut for #bug-reports
//   node tools/peek.mjs pings [n]                  recent @mentions of the bot (the inbox)
//
// Env: DISCORD_TOKEN (from .env). PEEK_GUILD overrides the target guild.
import { api, textChannels, resolveChannel } from './lib.mjs';
import { readMentions } from '../src/systems/mentions.js';

function fmtMessages(msgs) {
  return msgs.slice().reverse().map((m) => {
    const when = new Date(m.timestamp).toLocaleString();
    const who = m.author?.username || '??';
    const atts = (m.attachments || []).map((a) => `\n      📎 ${a.filename} → ${a.url}`).join('');
    const embeds = (m.embeds || []).length ? `\n      [${m.embeds.length} embed(s)]` : '';
    const body = (m.content || '(no text)').replace(/\n/g, '\n      ');
    return `• [${when}] ${who}: ${body}${atts}${embeds}`;
  }).join('\n');
}

const [cmd = 'channels', arg2] = process.argv.slice(2);

try {
  if (cmd === 'guilds') {
    const gs = await api('/users/@me/guilds');
    console.log(gs.map((g) => `${g.name}  |  ${g.id}`).join('\n'));
  } else if (cmd === 'channels') {
    const chs = await textChannels();
    console.log(chs.map((c) => `${c.type === 5 ? '📢' : '# '} ${c.name}  |  ${c.id}`).join('\n'));
  } else if (cmd === 'pings') {
    const n = Math.min(Math.max(parseInt(arg2, 10) || 20, 1), 100);
    const items = readMentions(n);
    if (!items.length) {
      console.log('No pings recorded yet. (They start logging here once the bot is @mentioned after restart.)');
    } else {
      console.log(items.map((p) =>
        `• [${new Date(p.at).toLocaleString()}] ${p.author} in #${p.channel}: ${p.content || '(no text)'}\n      ${p.url || ''}`,
      ).join('\n'));
    }
  } else {
    const q = cmd === 'bugs' ? 'bug-reports' : cmd;
    const n = Math.min(Math.max(parseInt(arg2, 10) || 15, 1), 50);
    const ch = await resolveChannel(q);
    const msgs = await api(`/channels/${ch.id}/messages?limit=${n}`);
    console.log(`# ${ch.name} — last ${msgs.length} message(s)\n`);
    console.log(msgs.length ? fmtMessages(msgs) : '(no messages)');
  }
} catch (e) {
  console.error('peek error:', e.message);
  process.exit(1);
}
