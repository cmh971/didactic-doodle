import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "My homework was abducted by aliens.",
  "The dog learned to use the shredder.",
  "Mercury was in retrograde.",
  "I was helping a turtle cross the road.",
  "My alarm betrayed me."
];

export const data = new SlashCommandBuilder()
  .setName('excuse')
  .setDescription('Random excuse');

export async function execute(interaction) {
  await interaction.reply('🤥 ' + pick(LINES));
}
