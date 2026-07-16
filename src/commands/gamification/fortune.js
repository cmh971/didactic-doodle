import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "A pleasant surprise is waiting for you.",
  "Your hard work will soon pay off.",
  "Adventure is on the horizon.",
  "A good time to start something new.",
  "Luck favors you today."
];

export const data = new SlashCommandBuilder()
  .setName('fortune')
  .setDescription('Random fortune');

export async function execute(interaction) {
  await interaction.reply('🥠 ' + pick(LINES));
}
