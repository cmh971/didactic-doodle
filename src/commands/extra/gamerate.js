import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('gamerate').setDescription('Get a random game rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **game** rating: **' + rint(0, 100) + '/100**');
}
