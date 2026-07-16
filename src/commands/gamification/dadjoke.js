import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "I'm afraid for the calendar. Its days are numbered.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "I only know 25 letters of the alphabet. I don't know y.",
  "What do you call fake spaghetti? An impasta."
];

export const data = new SlashCommandBuilder()
  .setName('dadjoke')
  .setDescription('Random dadjoke');

export async function execute(interaction) {
  await interaction.reply('👴 ' + pick(LINES));
}
