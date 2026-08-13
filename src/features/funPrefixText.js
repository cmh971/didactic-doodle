// Honours the exact prefixes Chris asked for on two API commands:
//   !fact     → a random useless fact       (! prefix)
//   ^advice   → a random piece of advice     (^ prefix)
// Everything else in this family lives on the "?" pack (see prefix/commands.js).
import { getFact, getAdvice } from './funApis.js';

export async function handleFunPrefix(message) {
  const raw = (message.content || '').trim();
  if (/^!fact\b/i.test(raw)) {
    try { await message.reply(`🧠 **Did you know?**\n${await getFact()}`); }
    catch (e) { await message.reply(`⚠️ Couldn't fetch a fact: ${e.message}`).catch(() => {}); }
    return true;
  }
  if (/^\^advice\b/i.test(raw)) {
    try { await message.reply(`💡 ${await getAdvice()}`); }
    catch (e) { await message.reply(`⚠️ Couldn't fetch advice: ${e.message}`).catch(() => {}); }
    return true;
  }
  return false;
}
