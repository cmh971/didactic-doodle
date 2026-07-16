import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';

export const data = new SlashCommandBuilder().setName('d6').setDescription('Roll a 6-sided die');

export async function execute(interaction) {
  await interaction.reply('🎲 You rolled a **' + rint(1, 6) + '** (d6).');
}
