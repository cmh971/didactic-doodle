import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "A short story collection.",
  "A mystery you can't put down.",
  "A non-fiction about space.",
  "A fantasy with a great map.",
  "A memoir that surprises you."
];
export const data = new SlashCommandBuilder().setName('bookrec').setDescription('Random bookrec');
export async function execute(interaction) { await interaction.reply('📚 ' + pick(LINES)); }
