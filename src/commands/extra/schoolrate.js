import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('schoolrate').setDescription('Get a random school rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **school** rating: **' + rint(0, 100) + '/100**');
}
