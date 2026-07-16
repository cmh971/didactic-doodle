import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('musicrate').setDescription('Get a random music rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **music** rating: **' + rint(0, 100) + '/100**');
}
