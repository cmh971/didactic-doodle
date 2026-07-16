import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('sportrate').setDescription('Get a random sport rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **sport** rating: **' + rint(0, 100) + '/100**');
}
