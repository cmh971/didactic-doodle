import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('travelrate').setDescription('Get a random travel rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **travel** rating: **' + rint(0, 100) + '/100**');
}
