import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('liferate').setDescription('Get a random life rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **life** rating: **' + rint(0, 100) + '/100**');
}
