import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('bookrate').setDescription('Get a random book rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **book** rating: **' + rint(0, 100) + '/100**');
}
