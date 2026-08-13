// Registry + dispatcher for the "?" command pack (see ./commands.js).
import COMMANDS from './commands.js';

// Human labels/emojis for the help UI, keyed by the categories used in commands.js.
export const QCAT_META = {
  qtext: { emoji: '✍️', label: 'Text (?)' },
  qmath: { emoji: '🔢', label: 'Math & Convert (?)' },
  qfun: { emoji: '🎉', label: 'More Fun (?)' },
  qutil: { emoji: '🧰', label: 'Utilities (?)' },
  // ---- expansion-pack categories (the road to 1,000) ----
  qcasino: { emoji: '🎰', label: 'Casino & Events (?)' },
  qai: { emoji: '🧠', label: 'AI Memory (?)' },
  qtext2: { emoji: '✂️', label: 'Text Tools (?)' },
  qmath2: { emoji: '➗', label: 'More Math (?)' },
  qgen: { emoji: '🎲', label: 'Generators (?)' },
  qgame: { emoji: '🕹️', label: 'Mini-Games (?)' },
  qconv: { emoji: '📐', label: 'Unit Conversions (?)' },
  qmath3: { emoji: '🧮', label: 'Geometry & Stats (?)' },
  qcipher: { emoji: '🔐', label: 'Ciphers & Encoders (?)' },
  qstr: { emoji: '🔤', label: 'String Tools (?)' },
  qtime: { emoji: '⏰', label: 'Date & Time (?)' },
  qgen2: { emoji: '🧪', label: 'More Generators (?)' },
  qstyle: { emoji: '🔠', label: 'Text Styles (?)' },
  qmath4: { emoji: '📊', label: 'Advanced Math (?)' },
  qcipher2: { emoji: '🕵️', label: 'More Ciphers (?)' },
  qstr2: { emoji: '📝', label: 'More String Tools (?)' },
  qtime2: { emoji: '📅', label: 'More Time Tools (?)' },
  qgen3: { emoji: '🎁', label: 'Random Generators (?)' },
  qstyle2: { emoji: '😀', label: 'Kaomoji & Faces (?)' },
  qphys: { emoji: '⚛️', label: 'Physics & Formulas (?)' },
  qgen4: { emoji: '🎰', label: 'Fantasy Generators (?)' },
  qmath5: { emoji: '📐', label: 'More Geometry (?)' },
  qkao: { emoji: '🙂', label: 'Kaomoji Library (?)' },
  qaero: { emoji: '✈️', label: 'Aviation (?)' },
  qauto: { emoji: '🏎️', label: 'Automotive (?)' },
  qfin: { emoji: '💰', label: 'Finance (?)' },
  qsci: { emoji: '🔬', label: 'Science (?)' },
  qmusic: { emoji: '🎵', label: 'Music Theory (?)' },
  qmath6: { emoji: '🧠', label: 'Algorithms (?)' },
  qapi: { emoji: '🌐', label: 'Live APIs & Games (?)' },
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
  // Both "?" and "," trigger the command pack (some people type "," naturally).
  if (!(raw.startsWith('?') || raw.startsWith(',')) || raw.length < 2) return false;
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
    // Commands may also return a message payload ({ embeds }, { content }, { files }).
    else if (result && typeof result === 'object' && (result.embeds || result.content || result.files)) {
      await message.reply({ allowedMentions: { parse: [] }, ...result }).catch(() => {});
    }
  } catch (err) {
    await message.reply(`⚠️ ${err.message}`).catch(() => {});
  }
  return true;
}
