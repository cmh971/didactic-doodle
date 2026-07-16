import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('partyrate').setDescription('Get a random party rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **party** rating: **' + rint(0, 100) + '/100**');
}
