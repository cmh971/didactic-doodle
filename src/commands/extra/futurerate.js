import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('futurerate').setDescription('Get a random future rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **future** rating: **' + rint(0, 100) + '/100**');
}
