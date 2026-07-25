// !lua — owner-only Lua REPL. Runs a Lua snippet in the embedded, sandboxed VM
// (see luaSandbox.js) and returns the result. The script gets a read-only `bot`
// table with a little live state, so it's a real bot-scripting tool, not a toy.
//   !lua return 2 ^ 10
//   !lua return bot.guilds .. " servers, " .. bot.ping .. "ms"
//   !lua local t={} for i=1,5 do t[i]=i*i end return table.concat(t, ", ")
import { runLua } from './luaSandbox.js';

const FALLBACK_OWNER = '1183222250153984040';
function isOwner(id) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === FALLBACK_OWNER;
}

export async function handleLuaText(message) {
  const raw = (message.content || '').trim();
  if (!/^!lua\b/i.test(raw)) return false;
  if (!isOwner(message.author.id)) { await message.reply('🔒 `!lua` is owner-only.').catch(() => {}); return true; }

  // Strip the command and any ```lua code fences``` people paste.
  const code = raw.replace(/^!lua\b/i, '').replace(/```lua?\s*/gi, '').replace(/```/g, '').trim();
  if (!code) {
    await message.reply('🌙 **Lua REPL** — usage: `!lua <code>`\nTry: `!lua return bot.guilds .. " servers"`').catch(() => {});
    return true;
  }

  const botCtx = {
    guilds: message.client.guilds.cache.size,
    ping: Math.round(message.client.ws.ping),
    uptime: Math.round(process.uptime()),
    users: message.client.users.cache.size,
  };
  const { ok, result, error } = await runLua(code, botCtx);
  if (ok) {
    let out;
    if (result === undefined || result === null) out = 'nil';
    else if (typeof result === 'object') out = JSON.stringify(result);
    else out = String(result);
    await message.reply(`🌙 **Lua** →\n\`\`\`\n${out.slice(0, 1800)}\n\`\`\``).catch(() => {});
  } else {
    await message.reply(`⚠️ **Lua error**\n\`\`\`\n${String(error).slice(0, 1800)}\n\`\`\``).catch(() => {});
  }
  return true;
}
