import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Is a hotdog a sandwich?",
  "Does pineapple belong on pizza?",
  "Is cereal a soup?",
  "Is water wet?",
  "Should you put milk or cereal first?"
];

export const data = new SlashCommandBuilder()
  .setName('debate')
  .setDescription('Random debate');

export async function execute(interaction) {
  await interaction.reply('⚖️ ' + pick(LINES));
}
