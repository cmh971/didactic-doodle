// !source — owner-only. DMs you source files so you can read/copy them off a
// remote desktop where you can't select text in the editor. Sends named bundles
// ("path", "search", "3d") or any relative file path under the project. Results
// are always delivered by DM (never dumped in a public channel), and .env / keys
// / secrets are hard-blocked so nothing sensitive can leak.
import { AttachmentBuilder } from 'discord.js';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const ROOT = process.cwd();
const FALLBACK_OWNER = '1183222250153984040';
const isOwner = (id) => {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === FALLBACK_OWNER;
};

// Never send these, even to the owner (secrets live here, not in the code).
const BLOCK = /(^|[\\/])\.env|\.pem$|\.key$|id_rsa|credentials|token/i;

const BUNDLES = {
  path: ['src/features/pathText.js', 'src/features/pathfind.js', 'src/events/messageCreate.js'],
  search: ['src/features/searchText.js', 'src/features/search.js'],
  '3d': ['src/features/modelText.js', 'src/web/public/model.html', 'src/web/public/make3d.html'],
};

async function collect(relPaths) {
  const atts = [];
  const notes = [];
  for (const rel of relPaths.slice(0, 10)) {
    if (BLOCK.test(rel)) { notes.push(`\`${rel}\` — 🔒 blocked (sensitive)`); continue; }
    const abs = resolve(ROOT, rel);
    if (!abs.startsWith(ROOT)) { notes.push(`\`${rel}\` — ⛔ outside project`); continue; }
    try {
      const buf = await readFile(abs);
      if (buf.length > 8 * 1024 * 1024) { notes.push(`\`${rel}\` — too big (${(buf.length / 1048576).toFixed(1)}MB)`); continue; }
      atts.push(new AttachmentBuilder(buf, { name: basename(rel) }));
    } catch { notes.push(`\`${rel}\` — not found`); }
  }
  return { atts, notes };
}

export async function handleSourceText(message) {
  const m = /^!(source|code)\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m) return false;
  if (!isOwner(message.author.id)) { await message.reply('🔒 Owner only.').catch(() => {}); return true; }

  const arg = (m[2] || '').trim() || 'path';
  if (/^(list|help|\?)$/i.test(arg)) {
    await message.reply(`📂 **!source** — I DM you source files.\n• \`!source path\` — the pathfinding files\n• \`!source search\` — the search files\n• \`!source 3d\` — the 3D viewer files\n• \`!source src/features/x.js\` — any file by path\nBundles: ${Object.keys(BUNDLES).map((b) => `\`${b}\``).join(', ')}`).catch(() => {});
    return true;
  }

  const paths = BUNDLES[arg.toLowerCase()] || [arg];
  const { atts, notes } = await collect(paths);
  const dest = message.channel?.isDMBased?.() ? message.channel : await message.author.createDM().catch(() => null);

  if (!atts.length) {
    await message.reply(`⚠️ Nothing to send.\n${notes.join('\n')}`).catch(() => {});
    return true;
  }
  if (!dest) { await message.reply('⚠️ I couldn’t open a DM with you (are your DMs closed?).').catch(() => {}); return true; }

  const header = `📄 **${atts.length} file(s)** — ${BUNDLES[arg.toLowerCase()] ? `\`${arg}\` bundle` : `\`${arg}\``}${notes.length ? `\n${notes.join('\n')}` : ''}`;
  await dest.send({ content: header, files: atts }).catch(async (e) => {
    await message.reply(`⚠️ Couldn’t DM the files: ${e.message}`).catch(() => {});
  });
  if (!message.channel?.isDMBased?.()) await message.reply(`📬 Sent ${atts.length} file(s) to your DMs.`).catch(() => {});
  return true;
}
