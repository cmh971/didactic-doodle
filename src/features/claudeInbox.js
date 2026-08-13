// "!claude" — Chris's bridge for sending Claude (me) images/files when he can't
// paste them into the remote-desktop CLI. He attaches image(s) to a Discord
// message with `!claude [note]` (works in a server OR in a DM to the bot), the
// bot downloads them into data/claude-inbox/, and I open them with my Read tool.
//
//   !claude                         (with 1+ attachments)
//   !claude look at this error      (attachment + a note)
//   !claude latest                  → tells you what's currently waiting for me
//
// Owner-only so randoms can't dump files onto the box.
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INBOX = fileURLToPath(new URL('../../data/claude-inbox/', import.meta.url));
const LATEST = INBOX + '_latest.json';
const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;

function isOwner(id) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === '1183222250153984040';
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const safe = (n) => (n || 'file').replace(/[^\w.\-]+/g, '_').slice(-60);

export async function handleClaudeInbox(message) {
  const raw = (message.content || '').trim();
  const isDMImage = !message.guild && message.attachments?.size > 0; // DMing the bot an image
  if (!/^!claude\b/i.test(raw) && !isDMImage) return false;
  if (!isOwner(message.author.id)) {
    if (/^!claude\b/i.test(raw)) await message.reply('🔒 `!claude` is owner-only.').catch(() => {});
    return /^!claude\b/i.test(raw); // only "handle" (swallow) if they explicitly typed it
  }

  const note = raw.replace(/^!claude\b/i, '').trim();

  // "!claude latest" — report what's already waiting.
  if (/^latest$/i.test(note)) {
    const info = await fs.readFile(LATEST, 'utf8').then(JSON.parse).catch(() => null);
    if (!info?.files?.length) { await message.reply('📭 Nothing in the Claude inbox right now.').catch(() => {}); return true; }
    await message.reply(`📥 Waiting for Claude (${info.at}):\n${info.note ? `📝 ${info.note}\n` : ''}` +
      info.files.map((f) => `• \`${f.name}\``).join('\n')).catch(() => {});
    return true;
  }

  if (!message.attachments || message.attachments.size === 0) {
    await message.reply('📎 Attach an image (or file) to the same message as `!claude`, then send. I’ll pick it up.').catch(() => {});
    return true;
  }

  await fs.mkdir(INBOX, { recursive: true });
  const saved = [];
  const when = stamp();
  let i = 0;
  for (const att of message.attachments.values()) {
    i++;
    const name = `${when}-${i}-${safe(att.name)}`;
    try {
      const res = await fetch(att.url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await fs.writeFile(INBOX + name, Buffer.from(await res.arrayBuffer()));
      saved.push({ name, isImage: IMAGE_RE.test(att.name || ''), type: att.contentType, size: att.size, from: att.name });
    } catch (e) {
      saved.push({ name: att.name, error: e.message });
    }
  }

  const ok = saved.filter((s) => !s.error);
  const record = {
    at: new Date().toISOString(),
    note: note || null,
    from: { id: message.author.id, tag: message.author.tag || message.author.username },
    dir: INBOX,
    files: ok.map((s) => ({ name: s.name, path: INBOX + s.name, isImage: s.isImage, type: s.type, size: s.size, originalName: s.from })),
  };
  await fs.writeFile(LATEST, JSON.stringify(record, null, 2)).catch(() => {});

  const imgs = ok.filter((s) => s.isImage).length;
  await message.reply(
    `📥 **Got it — ${ok.length} file${ok.length === 1 ? '' : 's'} saved for Claude**${imgs ? ` (${imgs} image${imgs === 1 ? '' : 's'})` : ''}.\n` +
    (note ? `📝 Note: ${note}\n` : '') +
    ok.map((s) => `• \`${s.name}\``).join('\n') +
    (saved.some((s) => s.error) ? `\n⚠️ ${saved.filter((s) => s.error).length} failed to download.` : '') +
    `\n\nNext time you talk to me in the CLI, just say “check my images” and I’ll open them. 💤 Sleep well.`,
  ).catch(() => {});
  return true;
}
