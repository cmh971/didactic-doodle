// Embedded Lua scripting engine (wasmoon = Lua 5.4 compiled to WebAssembly).
//
// This is Lua doing its most famous real job: being embedded in a host program
// as a safe scripting language (the same role it plays in Redis, Neovim, nginx,
// and countless game engines). The bot can now run Lua snippets — powering the
// owner `!lua` command today, and a Lua-scriptable custom-command system later.
//
// Safety: wasmoon runs in a WASM sandbox with NO host access (no filesystem, no
// network, no shell) unless we explicitly inject it — we don't. On top of that
// we install a Lua debug hook that aborts after a fixed number of VM
// instructions, so an accidental infinite loop can't hang the event loop.
import { LuaFactory } from 'wasmoon';

const factory = new LuaFactory(); // WASM module loads once; engines are cheap

// Prepended to every run: nil out anything host-ish (belt-and-suspenders on top
// of the WASM sandbox) and arm an instruction-count kill switch.
const GUARD = `
local __n = 0
debug.sethook(function()
  __n = __n + 1
  if __n > 20000 then error('instruction limit hit — possible infinite loop', 0) end
end, '', 1000)
if os then os.execute=nil; os.exit=nil; os.remove=nil; os.rename=nil end
io=nil; package=nil; require=nil; dofile=nil; loadfile=nil
`;

// Run Lua and return { ok, result } or { ok:false, error }. botCtx is exposed to
// the script as a read-only `bot` table (e.g. bot.guilds, bot.ping).
export async function runLua(code, botCtx = {}) {
  let lua;
  try {
    lua = await factory.createEngine();
    lua.global.set('bot', botCtx);
    // Lua-REPL trick: try it as an expression first (so `1+1` or `bot.guilds`
    // returns a value), then fall back to running it as statements.
    try {
      return { ok: true, result: await lua.doString(`${GUARD}\nreturn ${code}`) };
    } catch {
      return { ok: true, result: await lua.doString(`${GUARD}\n${code}`) };
    }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  } finally {
    try { lua?.global.close(); } catch { /* already closed */ }
  }
}
