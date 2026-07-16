import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "You'll find money in an old pocket soon.",
  "A pleasant message is coming your way.",
  "You'll win your next UNO game.",
  "Today is your lucky color day.",
  "Someone is thinking about you."
];

export const data = new SlashCommandBuilder()
  .setName('prediction')
  .setDescription('Random prediction');

export async function execute(interaction) {
  await interaction.reply('🔮 ' + pick(LINES));
}
