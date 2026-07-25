// !py / !python — owner-only Python REPL. Runs a snippet through the machine's
// real Python interpreter (confirmed installed) and returns stdout/stderr.
//
// ⚠️ Unlike !lua (WASM-sandboxed, no host access), this executes REAL Python on
// the host with full access to files/network. That's why it is strictly
// owner-only and time-limited. It's a genuine bot-scripting tool: the script
// gets live bot state via the SENTINEL_BOT env var (JSON).
//   !py print(2 ** 10)
//   !py import os, json; b=json.loads(os.environ["SENTINEL_BOT"]); print(b["guilds"], "servers")
import { spawn } from 'node:child_process';

const FALLBACK_OWNER = '1183222250153984040';
function isOwner(id) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === FALLBACK_OWNER;
}

// Run `python -I -c <code>` with a hard timeout; resolve combined output.
function runPython(code, botCtx) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('python', ['-I', '-c', code], {
        timeout: 10_000, // hard kill after 10s
        killSignal: 'SIGKILL',
        env: { ...process.env, SENTINEL_BOT: JSON.stringify(botCtx) },
        windowsHide: true,
      });
    } catch (e) { return resolve({ ok: false, out: `spawn failed: ${e.message}` }); }

    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (e) => resolve({ ok: false, out: e.code === 'ENOENT' ? 'Python not found on PATH.' : e.message }));
    child.on('close', (code, signal) => {
      if (signal === 'SIGKILL') return resolve({ ok: false, out: '⏱ Timed out (killed after 10s).' });
      resolve({ ok: code === 0, out: out.trim() || '(no output — did you print()?)' });
    });
  });
}

export async function handlePyText(message) {
  const raw = (message.content || '').trim();
  if (!/^!(py|python)\b/i.test(raw)) return false;
  if (!isOwner(message.author.id)) { await message.reply('🔒 `!py` is owner-only (it runs real Python on the host).').catch(() => {}); return true; }

  const code = raw.replace(/^!(py|python)\b/i, '').replace(/```py(thon)?\s*/gi, '').replace(/```/g, '').trim();
  if (!code) {
    await message.reply('🐍 **Python REPL** — usage: `!py <code>` (use `print(...)` for output)\nTry: `!py print(2 ** 10)`').catch(() => {});
    return true;
  }

  const botCtx = {
    guilds: message.client.guilds.cache.size,
    ping: Math.round(message.client.ws.ping),
    uptime: Math.round(process.uptime()),
    users: message.client.users.cache.size,
  };
  const { ok, out } = await runPython(code, botCtx);
  await message.reply(`${ok ? '🐍 **Python**' : '⚠️ **Python error**'} →\n\`\`\`\n${String(out).slice(0, 1800)}\n\`\`\``).catch(() => {});
  return true;
}
