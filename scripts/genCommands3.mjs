// Generates a block of 100 commands in the "extra" category. They register as
// SUBCOMMANDS under hub commands (/extra, /extra2, …) so they don't eat the
// 100 top-level slot limit. 25 topics × 4 suffixes (fact/tip/quote/rate) = 100.
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CMD = join(__dirname, '..', 'src', 'commands');
const dir = join(CMD, 'extra');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const used = new Set();
for (const cat of readdirSync(CMD, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of readdirSync(join(CMD, cat.name)).filter((f) => f.endsWith('.js'))) used.add(f.replace(/\.js$/, ''));
}

const TOPICS = ['life', 'love', 'luck', 'money', 'game', 'food', 'space', 'music', 'sport', 'school', 'work', 'dream', 'future', 'friend', 'pet', 'car', 'travel', 'party', 'study', 'code', 'anime', 'movie', 'book', 'art', 'vibe'];
const SUFFIX = {
  fact: { emoji: '🧠', verb: 'fact', kind: 'pick', pool: 'FACTS' },
  tip: { emoji: '💡', verb: 'tip', kind: 'pick', pool: 'TIPS' },
  quote: { emoji: '💬', verb: 'quote', kind: 'pick', pool: 'QUOTES' },
  rate: { emoji: '🎯', verb: 'rating', kind: 'rate' },
};

const SHARED = `const FACTS = ['it rewards patience','is better shared with friends','changes when you least expect it','is 10% luck and 90% effort','always has another level'];
const TIPS = ['start small and stay consistent','take a short break, then retry','ask someone you trust','write it down first','sleep on the big choices'];
const QUOTES = ['"Keep going." — Everyone wise','"Fortune favors the bold."','"Small steps, big journeys."','"You miss 100% of shots you don\\'t take."','"Done beats perfect."'];`;

let written = 0;
for (const topic of TOPICS) {
  for (const [suffix, meta] of Object.entries(SUFFIX)) {
    const name = `${topic}${suffix}`;
    if (used.has(name)) continue;
    used.add(name);
    let body;
    if (meta.kind === 'rate') {
      body = `import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('${name}').setDescription('Get a random ${topic} ${meta.verb}');
export async function execute(interaction) {
  await interaction.reply('${meta.emoji} Your **${topic}** ${meta.verb}: **' + rint(0, 100) + '/100**');
}
`;
    } else {
      body = `import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
${SHARED}
export const data = new SlashCommandBuilder().setName('${name}').setDescription('A random ${topic} ${meta.verb}');
export async function execute(interaction) {
  await interaction.reply('${meta.emoji} **${topic}** ${meta.verb}: ${topic} ' + pick(${meta.pool}));
}
`;
    }
    writeFileSync(join(dir, `${name}.js`), body);
    written++;
  }
}
// Top up to exactly 100 files in the dir (covers any name collisions).
const count = () => readdirSync(dir).filter((f) => f.endsWith('.js')).length;
let i = 1;
while (count() < 100) {
  const name = `bonus${i++}`;
  const p = join(dir, `${name}.js`);
  if (existsSync(p)) continue;
  writeFileSync(p, `import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('${name}').setDescription('Bonus random roll');
export async function execute(interaction) { await interaction.reply('🎲 ' + rint(1, 1000)); }
`);
}
console.log('extra files now:', count());
