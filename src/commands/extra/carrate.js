import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('carrate').setDescription('Get a random car rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **car** rating: **' + rint(0, 100) + '/100**');
}
