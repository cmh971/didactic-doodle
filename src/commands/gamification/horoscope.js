import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "The stars say: take a risk today.",
  "Cosmic energy favors bold moves.",
  "A calm day rewards patience.",
  "Trust your gut this afternoon.",
  "Good fortune flows toward you."
];

export const data = new SlashCommandBuilder()
  .setName('horoscope')
  .setDescription('Random horoscope');

export async function execute(interaction) {
  await interaction.reply('♈ ' + pick(LINES));
}
