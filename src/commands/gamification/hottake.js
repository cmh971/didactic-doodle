import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Mondays aren't that bad.",
  "Mild salsa is underrated.",
  "Movies are too long now.",
  "Cold pizza > hot pizza.",
  "Texting back fast is a green flag."
];

export const data = new SlashCommandBuilder()
  .setName('hottake')
  .setDescription('Random hottake');

export async function execute(interaction) {
  await interaction.reply('🌶️ ' + pick(LINES));
}
