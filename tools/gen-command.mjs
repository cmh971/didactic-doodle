#!/usr/bin/env node
// Command scaffolder — generates a ready-to-edit slash-command file so you can
// add real commands fast (instead of copy-pasting boilerplate). It writes ONE
// starter file you then fill in; it does not spam junk commands.
//
// Usage:
//   node tools/gen-command.mjs <name> <category> "<description>"
//   node tools/gen-command.mjs coolfact gamification "Send a cool fact"
//
// Categories map to src/commands/<category>/. New non-primary commands are auto-
// packed into a hub by the registry (Discord caps 100 top-level slash commands),
// so you can keep adding them safely.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [name, category = 'utility', ...descParts] = process.argv.slice(2);
const description = descParts.join(' ') || 'A new command';

if (!name || !/^[a-z][a-z0-9]{1,31}$/.test(name)) {
  console.error('error: give a lowercase command name (2-32 chars). e.g. `node tools/gen-command.mjs coolfact gamification "..."`');
  process.exit(1);
}

const dir = join(root, 'src', 'commands', category);
const file = join(dir, `${name}.js`);
if (existsSync(file)) { console.error(`error: ${file} already exists`); process.exit(1); }
mkdirSync(dir, { recursive: true });

const template = `import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('${name}')
  .setDescription(${JSON.stringify(description.slice(0, 100))})
  .addStringOption((o) => o.setName('input').setDescription('Your input').setRequired(false));

export async function execute(interaction) {
  const input = interaction.options.getString('input') || 'world';
  // TODO: your logic here.
  await interaction.reply(\`Hello, \${input}! (from /${name})\`);
}
`;

writeFileSync(file, template);
console.log(`✅ created src/commands/${category}/${name}.js`);
console.log('   edit the execute() body, then restart the bot to register it.');
