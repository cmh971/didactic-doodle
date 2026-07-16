import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "Something upbeat from the 80s.",
  "A lo-fi study mix.",
  "That one song you forgot you loved.",
  "A power ballad to belt out.",
  "Anything with a sax solo."
];
export const data = new SlashCommandBuilder().setName('songrec').setDescription('Random songrec');
export async function execute(interaction) { await interaction.reply('🎵 ' + pick(LINES)); }
