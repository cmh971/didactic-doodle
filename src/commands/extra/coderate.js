import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('coderate').setDescription('Get a random code rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **code** rating: **' + rint(0, 100) + '/100**');
}
