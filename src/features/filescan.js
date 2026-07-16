// File scanner — watches messages for dangerous attachments, warns the sender,
// and deletes the message if a file looks unsafe. WATCHER, not a slash command.
import { EmbedBuilder } from 'discord.js';
import { basename } from 'node:path';

// Extensions that can run code / install software / modify the system.
const EXT_DANGER = new Set([
  'exe', 'msi', 'msix', 'com', 'scr', 'pif', 'cpl', 'gadget', 'application',
  'bat', 'cmd', 'vbs', 'vbe', 'js', 'jse', 'ws', 'wsf', 'wsh', 'ps1', 'ps2',
  'psc1', 'psc2', 'sh', 'bash', 'py', 'pyc', 'rb', 'pl',
  'jar', 'apk', 'app', 'deb', 'rpm', 'dmg',
  'dll', 'reg', 'lnk', 'inf', 'hta', 'chm', 'scf', 'sct', 'msc',
]);

// Archives are allowed (not auto-blocked) — we can't see inside them here.
const EXT_ARCHIVES = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2']);

// Pull the lowercase extension from a filename, e.g. "virus.EXE" -> "exe".
function extensionOf(name) {
  const base = basename(String(name || ''));
  const dot = base.lastIndexOf('.');
  if (dot === -1) return '';
  return base.slice(dot + 1).toLowerCase().trim();
}

// Catch fake double extensions like "photo.jpg.exe".
function detectObfuscation(name) {
  const parts = String(name || '').toLowerCase().split('.');
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    if (EXT_DANGER.has(last) && !EXT_DANGER.has(secondLast)) {
      return `File name appears **obfuscated** (multiple extensions ending in .${last}).`;
    }
  }
  return null;
}

// Discord sometimes tells us the file's real MIME type — a name can lie, this can't.
function mimeLooksDangerous(type) {
  if (!type) return false;
  const t = type.toLowerCase();
  return (
    t.includes('application/x-msdownload') ||
    t.includes('application/x-ms-installer') ||
    t.includes('application/x-executable') ||
    t.includes('application/x-sh') ||
    t.includes('application/x-bat') ||
    t.includes('application/x-python')
  );
}

// Inspect one attachment. Returns a reason string if unsafe, or null if fine.
function inspect(attachment) {
  const name = attachment.name || '';
  const ext = extensionOf(name);
  const mime = attachment.contentType || '';

  if (EXT_DANGER.has(ext)) return `\`.${ext}\` files can run or install software on your device.`;

  const ob = detectObfuscation(name);
  if (ob) return ob;

  if (mimeLooksDangerous(mime)) return `This file's MIME type (\`${mime}\`) indicates executable content.`;

  // Archives pass through for now (allowed but noted in EXT_ARCHIVES).
  if (EXT_ARCHIVES.has(ext)) return null;

  return null;
}

function buildNotice(message, flagged) {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('🛡️ Unsafe file blocked')
    .setDescription(
      `${message.author}, your message was removed because it contained a file that could be harmful.\n\n` +
      flagged.map((f) => `• **${f.name}** — ${f.reason}`).join('\n'),
    )
    .setFooter({ text: 'If you believe this was a mistake, contact a staff member.' });
}

// The watcher. Returns true if it deleted the message (so the pipeline stops).
export async function handleFileScan(message) {
  try {
    if (!message.attachments || message.attachments.size === 0) return false;

    const flagged = [];
    for (const attachment of message.attachments.values()) {
      const reason = inspect(attachment);
      if (reason) flagged.push({ name: attachment.name, reason });
    }

    if (flagged.length === 0) return false;

    await message.delete().catch(() => {});

    const embed = buildNotice(message, flagged);
    const notice = await message.channel
      .send({ content: `${message.author}`, embeds: [embed] })
      .catch(() => null);

    // Your change kept: the notice now auto-deletes after 30 seconds.
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 30000);

    return true;
  } catch (err) {
    console.error('filescan error:', err?.message);
    return false;
  }
}
