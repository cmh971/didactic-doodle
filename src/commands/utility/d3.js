import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';

export const data = new SlashCommandBuilder().setName('d3').setDescription('Roll a 3-sided die');

export async function execute(interaction) {
  await interaction.reply('🎲 You rolled a **' + rint(1, 3) + '** (d3).');
}
