import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('spacerate').setDescription('Get a random space rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **space** rating: **' + rint(0, 100) + '/100**');
}
