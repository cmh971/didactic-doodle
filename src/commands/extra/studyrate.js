import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('studyrate').setDescription('Get a random study rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **study** rating: **' + rint(0, 100) + '/100**');
}
