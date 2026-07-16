import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "🍿 popcorn",
  "🍫 chocolate",
  "🧀 cheese & crackers",
  "🍎 apple slices",
  "🍪 cookies",
  "🥨 pretzels"
];
export const data = new SlashCommandBuilder().setName('snack').setDescription('Random snack');
export async function execute(interaction) { await interaction.reply('🍿 ' + pick(LINES)); }
