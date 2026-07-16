import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('petrate').setDescription('Get a random pet rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **pet** rating: **' + rint(0, 100) + '/100**');
}
