import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';

export const data = new SlashCommandBuilder().setName('d2').setDescription('Roll a 2-sided die');

export async function execute(interaction) {
  await interaction.reply('🎲 You rolled a **' + rint(1, 2) + '** (d2).');
}
