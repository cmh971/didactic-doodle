import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Patience is a tree whose root is bitter but fruit sweet.",
  "The best time to plant a tree was 20 years ago. The second best is now.",
  "A river cuts rock not by power but persistence.",
  "Fall seven times, stand up eight.",
  "Knowing yourself is the beginning of all wisdom."
];

export const data = new SlashCommandBuilder()
  .setName('wisdom')
  .setDescription('Random wisdom');

export async function execute(interaction) {
  await interaction.reply('🧘 ' + pick(LINES));
}
