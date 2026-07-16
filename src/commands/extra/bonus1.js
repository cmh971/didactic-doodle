import { SlashCommandBuilder } from 'discord.js';
import { rint } from '../../util.js';
export const data = new SlashCommandBuilder().setName('bonus1').setDescription('Bonus random roll');
export async function execute(interaction) { await interaction.reply('🎲 ' + rint(1, 1000)); }
