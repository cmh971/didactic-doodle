import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('workrate').setDescription('Get a random work rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **work** rating: **' + rint(0, 100) + '/100**');
}
