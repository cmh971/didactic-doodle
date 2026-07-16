import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('loverate').setDescription('Get a random love rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **love** rating: **' + rint(0, 100) + '/100**');
}
