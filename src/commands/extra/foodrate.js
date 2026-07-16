import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('foodrate').setDescription('Get a random food rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **food** rating: **' + rint(0, 100) + '/100**');
}
