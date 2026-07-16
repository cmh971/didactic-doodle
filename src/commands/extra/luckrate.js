import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('luckrate').setDescription('Get a random luck rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **luck** rating: **' + rint(0, 100) + '/100**');
}
