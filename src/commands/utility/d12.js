import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';

export const data = new SlashCommandBuilder().setName('d12').setDescription('Roll a 12-sided die');

export async function execute(interaction) {
  await interaction.reply('🎲 You rolled a **' + rint(1, 12) + '** (d12).');
}
