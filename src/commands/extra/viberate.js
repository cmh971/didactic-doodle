import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('viberate').setDescription('Get a random vibe rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **vibe** rating: **' + rint(0, 100) + '/100**');
}
