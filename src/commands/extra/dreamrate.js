import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('dreamrate').setDescription('Get a random dream rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **dream** rating: **' + rint(0, 100) + '/100**');
}
