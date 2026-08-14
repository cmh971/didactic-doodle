// Loader that brings Chris's hand-written Lua racing pack to life in Discord
// WITHOUT modifying his file (src/commands/core/racing_commands.lua).
//
// His commands are `commands["!car"] = function(args) print("...") end` style, so
// the bridge: (1) neutralises the stray non-Lua "INPORT ANT MODULES" line and the
// bottom self-test loop in memory, (2) captures Lua `print(...)` into a buffer, and
// (3) exposes the local `commands` table + `handleCommand` as globals so JS can
// dispatch a message and read back whatever the command printed → the reply.
import { LuaFactory } from 'wasmoon';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getGarage, savePlayer, ownsCar, ensureStarter } from './racingGame.js';
import { balance, addWallet } from '../economy/store.js';

const RACING_PATH = fileURLToPath(new URL('../commands/core/racing_commands.lua', import.meta.url));

// In-memory clean-up only — the file on disk is never touched.
function loadSource() {
  return readFileSync(RACING_PATH, 'utf8')
    .replace(/^\s*INPORT[^\n]*$/im, '-- (loader: neutralised stray import line)')
    .replace(/--\s*Example Test Execution Loop[\s\S]*$/m, '-- (loader: self-test loop stripped)');
}

// Bridge appended to the SAME chunk, so the file's top-level locals stay in scope.
const BRIDGE = `
RACING_NAMES = function()
  local t = {}
  for k in pairs(commands) do t[#t + 1] = k end
  return table.concat(t, "\\n")
end
RACING_RUN = function(msg) return handleCommand(msg) end
RACING_SETP = function(k, v) if player and v ~= nil then player[k] = v end end
RACING_GETP = function(k) return player and player[k] end
`;

let outputBuffer = [];
let NAMES = new Set();
let enginePromise = null;

async function getEngine() {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const lua = await new LuaFactory().createEngine();
    // His commands call print(...) — capture it instead of writing to stdout.
    lua.global.set('print', (...args) => outputBuffer.push(args.map((v) => (v == null ? '' : String(v))).join(' ')));
    await lua.doString(loadSource() + '\n' + BRIDGE);
    const namesStr = String(lua.global.get('RACING_NAMES')() || '');
    NAMES = new Set(namesStr.split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean));
    console.log(`🏎️ Racing pack loaded — ${NAMES.size} commands.`);
    return lua;
  })();
  return enginePromise;
}

// !<cmd> [args] — runs a racing command from the Lua pack. Returns false (so the
// message keeps flowing) when the command isn't part of the pack.
export async function handleRacingCommand(message) {
  const raw = (message.content || '').trim();
  if (!raw.startsWith('!') || !message.guild) return false;
  const cmd = raw.split(/\s+/)[0].toLowerCase();
  let lua;
  try { lua = await getEngine(); } catch { return false; }
  if (!NAMES.has(cmd)) return false; // not one of ours — let the pipeline continue

  // Load THIS user's saved garage + real wallet into the shared Lua `player` table,
  // run, then read back + persist. The whole block is synchronous (no awaits, no
  // yielded Lua calls) so concurrent commands can't clobber each other's state.
  const uid = message.author.id;
  ensureStarter(uid);
  // Shop gate: you can only swap into a car you actually own. Keeps the dealership
  // meaningful (otherwise !swapcar Formula 1 is a free win).
  if (cmd === '!swapcar') {
    const target = raw.replace(/^!swapcar\b/i, '').trim() || 'GT3 RS';
    if (!ownsCar(uid, target)) {
      await message.reply(`🔒 You don’t own a **${target}** yet. Check \`!dealership\` and grab it with \`!buycar ${target}\`.`).catch(() => {});
      return true;
    }
  }
  const g = getGarage(uid);
  const walletBefore = balance(uid).wallet;
  const setP = lua.global.get('RACING_SETP');
  const getP = lua.global.get('RACING_GETP');
  setP('car', g.car); setP('livery', g.livery); setP('credits', walletBefore);

  outputBuffer = [];
  try {
    lua.global.get('RACING_RUN')(raw); // fully synchronous (no awaited Lua calls)
  } catch (err) {
    console.error('racing run error:', err.message);
    return false;
  }
  // Persist car/livery + reconcile any credit change (!bet/!payout) into the wallet.
  try {
    savePlayer(uid, getP('car'), getP('livery'));
    const delta = Math.round(Number(getP('credits')) - walletBefore);
    if (Number.isFinite(delta) && delta !== 0) addWallet(uid, delta, 'racing');
  } catch { /* keep the reply flowing even if persistence hiccups */ }
  const out = outputBuffer.join('\n').trim();
  outputBuffer = [];
  await message.reply({ content: (out || '🏁 …').slice(0, 1900), allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}

// Warm the engine at startup so the first command is instant.
getEngine().catch((e) => console.error('racing pack failed to load:', e.message));
