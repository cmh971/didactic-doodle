// Registry + dispatcher for the "?" command pack (see ./commands.js).
import COMMANDS from './commands.js';

// Human labels/emojis for the help UI, keyed by the categories used in commands.js.
export const QCAT_META = {
  qtext: { emoji: '✍️', label: 'Text (?)' },
  qmath: { emoji: '🔢', label: 'Math & Convert (?)' },
  qfun: { emoji: '🎉', label: 'More Fun (?)' },
  qutil: { emoji: '🧰', label: 'Utilities (?)' },
};

// name/alias -> command
const LOOKUP = new Map();
for (const cmd of COMMANDS) {
  LOOKUP.set(cmd.name, cmd);
  for (const a of cmd.aliases || []) LOOKUP.set(a, cmd);
}

export function prefixCommandCount() { return COMMANDS.length; }

// Flat list for the /help menu: [{ name, description, category, prefix }]
export function listForHelp() {
  return COMMANDS.map((c) => ({ name: c.name, description: c.description, category: c.category, prefix: '?' }));
}

function helpText() {
  const byCat = {};
  for (const c of COMMANDS) (byCat[c.category] ??= []).push(c.name);
  let out = `🧩 **${COMMANDS.length} "?" commands** — type \`?name\` (e.g. \`?reverse hello\`)\n`;
  for (const [cat, names] of Object.entries(byCat)) {
    out += `\n**${QCAT_META[cat]?.emoji || '•'} ${QCAT_META[cat]?.label || cat}**\n> ${names.map((n) => `\`?${n}\``).join(' ')}`;
  }
  return out.slice(0, 1900);
}

// messageCreate hook. Returns true if it handled a "?" command.
export async function handlePrefixCommand(message) {
  const raw = (message.content || '').trim();
  if (!raw.startsWith('?') || raw.length < 2) return false;
  const [word, ...restArr] = raw.slice(1).split(/\s+/);
  const name = word.toLowerCase();

  if (name === 'help' || name === 'commands' || name === 'cmds') {
    await message.reply(helpText()).catch(() => {});
    return true;
  }

  const cmd = LOOKUP.get(name);
  if (!cmd) return false; // not one of ours — let normal processing continue

  const args = restArr.join(' ');
  try {
    const result = await cmd.run({ args, argv: restArr, message });
    if (typeof result === 'string' && result.trim()) await message.reply(result.slice(0, 2000)).catch(() => {});
  } catch (err) {
    await message.reply(`⚠️ ${err.message}`).catch(() => {});
  }
  return true;
}
