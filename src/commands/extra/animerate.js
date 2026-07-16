import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('animerate').setDescription('Get a random anime rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **anime** rating: **' + rint(0, 100) + '/100**');
}
