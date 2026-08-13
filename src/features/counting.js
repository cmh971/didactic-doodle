// Counting game — members count upward in a dedicated channel. The bot checks each
// number is the next one (and that nobody counts twice in a row); a mistake resets
// the streak. Configured on the /setup wizard's Counting page (settings.counting).
import { getCfg } from '../setup/store.js';
import { getDb } from '../db/index.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS counting (
  guild_id TEXT PRIMARY KEY, current INTEGER NOT NULL DEFAULT 0, last_user TEXT, best INTEGER NOT NULL DEFAULT 0
)`);
const q = {
  get: db.prepare('SELECT current, last_user, best FROM counting WHERE guild_id=?'),
  set: db.prepare(`INSERT INTO counting(guild_id,current,last_user,best) VALUES (?,?,?,?)
                   ON CONFLICT(guild_id) DO UPDATE SET current=excluded.current, last_user=excluded.last_user, best=excluded.best`),
};

export async function handleCountingMessage(message) {
  const cfg = getCfg(message.guild.id).settings.counting || {};
  if (!cfg.enabled || cfg.channel !== message.channel.id) return false;

  const n = Number((message.content || '').trim());
  if (!Number.isInteger(n)) return false; // not a number → let it be a normal message

  const row = q.get.get(message.guild.id) || { current: 0, last_user: null, best: 0 };
  const expected = row.current + 1;

  if (n !== expected || message.author.id === row.last_user) {
    q.set.run(message.guild.id, 0, null, row.best);
    await message.react('❌').catch(() => {});
    const why = message.author.id === row.last_user ? 'you can’t count twice in a row' : `expected **${expected}**`;
    await message.channel.send(`💥 **${message.author.username}** broke the count at **${row.current}** — ${why}! Back to **1**.`).catch(() => {});
    return true;
  }

  const best = Math.max(row.best, n);
  q.set.run(message.guild.id, n, message.author.id, best);
  await message.react(n > row.best ? '🏆' : '✅').catch(() => {});
  return true;
}
