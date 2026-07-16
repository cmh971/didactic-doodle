// Second generation pass — tops the bot up to 200 commands.
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CMD = join(__dirname, '..', 'src', 'commands');

const used = new Set();
for (const cat of readdirSync(CMD, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of readdirSync(join(CMD, cat.name)).filter((f) => f.endsWith('.js'))) used.add(f.replace(/\.js$/, ''));
}
let written = 0;
function emit(cat, name, body) {
  if (used.has(name)) return;
  used.add(name);
  const dir = join(CMD, cat);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.js`), body);
  written++;
}

// ---- more pick commands ----
const PICKS = {
  rant: ['Why do socks disappear in the laundry?!', 'Loading screens are a personal attack.', 'Why is there always one stair that isn\'t there?', 'Group chats that ping at 3am should be illegal.', 'Stickers that won\'t peel cleanly — pure evil.'],
  haiku: ['Cards on the table / a wild four changes it all / silence, then a groan', 'Tokens in my purse / I gamble them all away / the slots show three sevens', 'Winter UNO night / the reverse card spins us back / friendships gently tested'],
  mood: ['😌 calm', '🔥 unstoppable', '😴 sleepy', '🤔 pensive', '🥳 celebratory', '🦝 chaotic'],
  bucketlist: ['See the northern lights.', 'Learn to cook one signature dish.', 'Win a UNO tournament.', 'Visit a country you can\'t pronounce.', 'Watch a sunrise and a sunset same day.'],
  challenge: ['Go 1 hour with no phone.', 'Compliment 3 people today.', 'Drink 8 glasses of water.', 'Win a game without drawing a card.', 'Learn 5 new words.'],
  journalprompt: ['What made you smile today?', 'What\'s a small win from this week?', 'Who are you grateful for and why?', 'What would you tell your younger self?', 'What are you looking forward to?'],
  songrec: ['Something upbeat from the 80s.', 'A lo-fi study mix.', 'That one song you forgot you loved.', 'A power ballad to belt out.', 'Anything with a sax solo.'],
  movierec: ['A cozy animated film.', 'A heist movie with a twist.', 'A documentary about something weird.', 'A comfort rewatch.', 'A sci-fi that makes you think.'],
  bookrec: ['A short story collection.', 'A mystery you can\'t put down.', 'A non-fiction about space.', 'A fantasy with a great map.', 'A memoir that surprises you.'],
  snack: ['🍿 popcorn', '🍫 chocolate', '🧀 cheese & crackers', '🍎 apple slices', '🍪 cookies', '🥨 pretzels'],
  superpower: ['🕒 Time control', '🦅 Flight', '👻 Invisibility', '🧠 Telepathy', '⚡ Super speed', '💪 Super strength'],
  alibi: ['I was teaching a cat to play UNO.', 'I was stuck in a very long elevator chat.', 'I was reorganizing my sock drawer alphabetically.', 'I was negotiating peace between two roombas.', 'I was lost in a corn maze.'],
};
const pickTpl = (name, lines, e) =>
  `import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = ${JSON.stringify(lines, null, 2)};
export const data = new SlashCommandBuilder().setName('${name}').setDescription('Random ${name}');
export async function execute(interaction) { await interaction.reply('${e} ' + pick(LINES)); }
`;
const E = { rant: '😤', haiku: '🍃', mood: '🎭', bucketlist: '🪣', challenge: '🎯', journalprompt: '📓', songrec: '🎵', movierec: '🎬', bookrec: '📚', snack: '🍿', superpower: '🦸', alibi: '🕵️' };
for (const [n, l] of Object.entries(PICKS)) emit('gamification', n, pickTpl(n, l, E[n]));

// ---- more transforms (unicode styling via combining marks / maps) ----
const TR = {
  mirror: { d: 'Mirror each line of text', b: `return t.split('\\\\n').map(l=>[...l].reverse().join('')).join('\\\\n');` },
  strike: { d: 'A̶d̶d̶ ̶s̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶', b: `return [...t].map(c=>c+'\\\\u0336').join('');` },
  underline: { d: 'U̲n̲d̲e̲r̲l̲i̲n̲e̲ text', b: `return [...t].map(c=>c+'\\\\u0332').join('');` },
  bubbletext: { d: 'Ⓑⓤⓑⓑⓛⓔ text', b: `return [...t].map(c=>{const x=c.toLowerCase();const i=x.charCodeAt(0)-97;return (i>=0&&i<26)?String.fromCodePoint(0x24D0+i):c;}).join('');` },
};
const trTpl = (name, d, body) =>
  `import { SlashCommandBuilder } from 'discord.js';
export const data = new SlashCommandBuilder().setName('${name}').setDescription(${JSON.stringify(d)})
  .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));
export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out; try { out = (function (t) { ${body} })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\\u200b' });
}
`;
for (const [n, { d, b }] of Object.entries(TR)) emit('utility', n, trTpl(n, d, b));

// ---- more generators ----
const GENS = {
  d1000: { d: 'Roll a 1000-sided die', c: `return '🎲 ' + rint(1,1000);` },
  dndstats: { d: 'Roll a D&D stat block (4d6 drop lowest ×6)', c: `const roll=()=>{const r=[rint(1,6),rint(1,6),rint(1,6),rint(1,6)].sort((a,b)=>a-b);return r[1]+r[2]+r[3];};return '🐉 STR ' + roll() + ' · DEX ' + roll() + ' · CON ' + roll() + ' · INT ' + roll() + ' · WIS ' + roll() + ' · CHA ' + roll();` },
  randomfood: { d: 'Pick a random food', c: `return '🍽️ ' + pick(['tacos','ramen','pizza','sushi','curry','burgers','dumplings','pasta','pho','falafel']);` },
  randomdrink: { d: 'Pick a random drink', c: `return '🥤 ' + pick(['iced coffee','bubble tea','lemonade','hot cocoa','smoothie','green tea','milkshake','sparkling water']);` },
  randomgame: { d: 'Pick a random game to play', c: `return '🎮 ' + pick(['UNO','chess','Mario Kart','Minecraft','Among Us','Tetris','Stardew Valley','Rocket League']);` },
};
const genTpl = (name, d, c) =>
  `import { SlashCommandBuilder } from 'discord.js';
import { rint, pick } from '../../util.js';
export const data = new SlashCommandBuilder().setName('${name}').setDescription(${JSON.stringify(d)});
export async function execute(interaction) { const out = (function () { ${c} })(); await interaction.reply(String(out).slice(0, 1990)); }
`;
for (const [n, { d, c }] of Object.entries(GENS)) emit('utility', n, genTpl(n, d, c));

console.log('Pass 2 generated', written, 'new command files.');
