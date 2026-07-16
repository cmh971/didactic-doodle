import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Sandwiches taste better cut diagonally.",
  "Audiobooks count as reading.",
  "Winter is the best season.",
  "Tomatoes are a fruit AND a vegetable.",
  "Group projects can be fun."
];

export const data = new SlashCommandBuilder()
  .setName('unpopular')
  .setDescription('Random unpopular');

export async function execute(interaction) {
  await interaction.reply('🙃 ' + pick(LINES));
}
