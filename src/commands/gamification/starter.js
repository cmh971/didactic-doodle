import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "What's a hill you'll die on?",
  "If you had unlimited UNO Tokens, what's the first thing you'd buy?",
  "What's the best meal you've ever had?",
  "Cats or dogs — defend your answer.",
  "What's your most-replayed song?"
];

export const data = new SlashCommandBuilder()
  .setName('starter')
  .setDescription('Random starter');

export async function execute(interaction) {
  await interaction.reply('💬 ' + pick(LINES));
}
