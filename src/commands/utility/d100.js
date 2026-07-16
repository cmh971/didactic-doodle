import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';

export const data = new SlashCommandBuilder().setName('d100').setDescription('Roll a 100-sided die');

export async function execute(interaction) {
  await interaction.reply('🎲 You rolled a **' + rint(1, 100) + '** (d100).');
}
