import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('artrate').setDescription('Get a random art rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **art** rating: **' + rint(0, 100) + '/100**');
}
