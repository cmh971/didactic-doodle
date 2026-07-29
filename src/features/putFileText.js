// !putfile <path> — owner-only. The inverse of !source: you attach a text/code
// file (or paste a ```code block```) and give a target path, and it writes that
// content into the project. Built for editing the bot from a remote desktop
// where typing into an editor is painful.
//
// Safety rails (this writes real code into the running bot):
//   • owner only
//   • path is confined to the project root (no ../ escapes)
//   • .env / keys / .git / node_modules are hard-blocked
//   • only text/code extensions are allowed
//   • the existing file is backed up to <path>.bak before overwrite
//   • .js/.json is syntax-checked; if it's broken, the write is AUTO-REVERTED
//     so a bad paste can never brick the bot on the next restart
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);
const ROOT = process.cwd();
const FALLBACK_OWNER = '1183222250153984040';
const isOwner = (id) => {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === FALLBACK_OWNER;
};

const BLOCK = /(^|[\\/])\.env|(^|[\\/])\.git[\\/]|node_modules[\\/]|\.pem$|\.key$|id_rsa|credentials|token/i;
const ALLOW_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.json', '.html', '.css', '.md', '.txt', '.yml', '.yaml', '.svg']);
const MAX_BYTES = 2 * 1024 * 1024;

async function syntaxCheckJs(abs) {
  try { await pexec(process.execPath, ['--check', abs]); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e.stderr || e.message || '').slice(0, 1500) }; }
}

export async function handlePutFileText(message) {
  const m = /^!(putfile|writefile|savefile)\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m) return false;
  if (!isOwner(message.author.id)) { await message.reply('🔒 Owner only.').catch(() => {}); return true; }

  const rest = (m[2] || '').trim();
  if (!rest || /^(help|\?)$/i.test(rest.split(/\s/)[0])) {
    await message.reply('💾 **!putfile `<path>`** — writes a file into the project.\n• Attach a `.txt`/`.js`/etc. file **or** include a ```` ```code block``` ````\n• e.g. `!putfile src/features/pathText.js` + attach the new file\nGuards: owner-only · can’t leave the project · `.env`/keys blocked · auto-backup to `.bak` · JS/JSON auto-reverts if broken.').catch(() => {});
    return true;
  }

  // First whitespace-delimited token is the target path.
  const relPath = rest.split(/\s+/)[0];
  const abs = resolve(ROOT, relPath);
  const ext = extname(abs).toLowerCase();

  // ---- validate the destination BEFORE touching anything ----
  if (BLOCK.test(relPath)) { await message.reply(`🔒 \`${relPath}\` is protected and can’t be written.`).catch(() => {}); return true; }
  if (!abs.startsWith(ROOT)) { await message.reply('⛔ That path is outside the project folder.').catch(() => {}); return true; }
  if (!ALLOW_EXT.has(ext)) { await message.reply(`⛔ Extension \`${ext || '(none)'}\` isn’t allowed. Text/code files only.`).catch(() => {}); return true; }

  // ---- resolve the content: attachment first, then a fenced code block ----
  let content = null;
  let sourceLabel = '';
  const att = [...message.attachments.values()][0];
  if (att) {
    try {
      const res = await fetch(att.url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) { await message.reply(`⛔ File too big (${(buf.length / 1048576).toFixed(1)}MB, max 2MB).`).catch(() => {}); return true; }
      content = buf.toString('utf8');
      sourceLabel = `attachment \`${att.name}\``;
    } catch (e) { await message.reply(`⚠️ Couldn’t download the attachment: ${e.message}`).catch(() => {}); return true; }
  } else {
    const cb = /```(?:[\w.+-]+)?\r?\n([\s\S]*?)```/.exec(rest);
    if (cb) { content = cb[1]; sourceLabel = 'code block'; }
  }
  if (content == null) { await message.reply('❓ Give me the content — attach a text/code file, or paste a ```` ```code block``` ````.').catch(() => {}); return true; }

  // ---- back up, write, verify ----
  let backedUp = false;
  try {
    if (existsSync(abs)) { await copyFile(abs, abs + '.bak'); backedUp = true; }
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
  } catch (e) { await message.reply(`⚠️ Write failed: ${e.message}`).catch(() => {}); return true; }

  const revert = async () => { if (backedUp) await copyFile(abs + '.bak', abs).catch(() => {}); };

  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    const chk = await syntaxCheckJs(abs);
    if (!chk.ok) {
      await revert();
      await message.reply(`❌ **Syntax error — write REVERTED** (bot kept safe):\n\`\`\`\n${chk.error}\n\`\`\``).catch(() => {});
      return true;
    }
  } else if (ext === '.json') {
    try { JSON.parse(content); }
    catch (e) { await revert(); await message.reply(`❌ **Invalid JSON — write REVERTED:** ${e.message}`).catch(() => {}); return true; }
  }

  const okNote = ext === '.json' ? ' · ✅ valid JSON' : (['.js', '.mjs', '.cjs'].includes(ext) ? ' · ✅ syntax OK' : '');
  await message.reply(`💾 Saved **${content.length}** chars to \`${relPath}\` (from ${sourceLabel})${backedUp ? ` · backup at \`${relPath}.bak\`` : ''}${okNote}\nSay **restart** when you want me to reload the bot.`).catch(() => {});
  return true;
}
