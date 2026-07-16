import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('moneyrate').setDescription('Get a random money rating');
export async function execute(interaction) {
  await interaction.reply('🎯 Your **money** rating: **' + rint(0, 100) + '/100**');
}
