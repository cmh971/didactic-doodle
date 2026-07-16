import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('movierate').setDescription('Get a random movie rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **movie** rating: **' + rint(0, 100) + '/100**');
}
