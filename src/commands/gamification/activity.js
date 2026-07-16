import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Go for a 10-minute walk.",
  "Do 20 jumping jacks.",
  "Write down 3 things you're grateful for.",
  "Tidy your desk.",
  "Stretch for 2 minutes."
];

export const data = new SlashCommandBuilder()
  .setName('activity')
  .setDescription('Random activity');

export async function execute(interaction) {
  await interaction.reply('🏃 ' + pick(LINES));
}
