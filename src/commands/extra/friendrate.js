import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('friendrate').setDescription('Get a random friend rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **friend** rating: **' + rint(0, 100) + '/100**');
}
