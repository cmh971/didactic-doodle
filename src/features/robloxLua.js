// Host loader for roblox.lua — the Lua-written Roblox API wrapper.
// It injects ONE primitive, __http, locked to *.roblox.com, then loads the Lua
// wrapper so scripts can call roblox.getUserId(), roblox.getUser(), etc.
//
//   !roblox return roblox.getUserId("builderman")
//   !roblox local id = roblox.getUserId("Roblox"); return roblox.getAvatar(id)
//
// Any other bot feature can call runRobloxLua(code) too.
import { LuaFactory } from 'wasmoon';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WRAPPER = readFileSync(fileURLToPath(new URL('./roblox.lua', import.meta.url)), 'utf8');
const factory = new LuaFactory();

// The only host primitive the Lua wrapper gets — network, Roblox domains ONLY.
async function robloxHttp(url, method, body) {
  if (!/^https:\/\/[a-z0-9-]+\.roblox\.com\//i.test(String(url || ''))) {
    throw new Error('blocked: __http is restricted to *.roblox.com');
  }
  const res = await fetch(url, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'SentinelBot/1.0' },
    body: (method && method !== 'GET') ? (body || undefined) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  return res.text();
}

// Run a Lua snippet with the `roblox` wrapper in scope. Returns { ok, result|error }.
export async function runRobloxLua(code) {
  const lua = await factory.createEngine();
  try {
    lua.global.set('__http', robloxHttp);
    // Load the Lua wrapper and bind it to a global `roblox` table.
    await lua.doString(`roblox = (function()\n${WRAPPER}\nend)()`);
    // REPL trick: try as an expression first, then as a statement block.
    try { return { ok: true, result: await lua.doString(`return ${code}`) }; }
    catch { return { ok: true, result: await lua.doString(code) }; }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    try { lua.global.close(); } catch { /* already closed */ }
  }
}

function isOwner(id) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === '1183222250153984040';
}

// !roblox <lua> — owner-only REPL over the Lua Roblox wrapper.
export async function handleRobloxLuaCommand(message) {
  const raw = (message.content || '').trim();
  if (!/^!roblox\b/i.test(raw)) return false;
  if (!isOwner(message.author.id)) { await message.reply('🔒 `!roblox` is owner-only.').catch(() => {}); return true; }
  const code = raw.replace(/^!roblox\b/i, '').replace(/```lua?\s*/gi, '').replace(/```/g, '').trim();
  if (!code) {
    await message.reply('🎮 **Roblox Lua** — `!roblox <lua>`\nTry: `!roblox return roblox.getUserId("Roblox")`\nMethods: `getUserId` `getUser` `getDescription` `getAvatar` `getGroupRank` `getGroups` `userByName`').catch(() => {});
    return true;
  }
  await message.react('🎮').catch(() => {});
  const r = await runRobloxLua(code);
  if (!r.ok) { await message.reply(`⚠️ ${r.error}`.slice(0, 1900)).catch(() => {}); return true; }
  let out = r.result;
  if (out === undefined || out === null) out = 'nil';
  else if (typeof out === 'object') { try { out = JSON.stringify(out, null, 2); } catch { out = String(out); } }
  await message.reply(`\`\`\`\n${String(out).slice(0, 1900)}\n\`\`\``).catch(() => {});
  return true;
}
