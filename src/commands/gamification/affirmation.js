import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "You are capable of amazing things.",
  "You are enough, exactly as you are.",
  "Your potential is limitless.",
  "You handle challenges with grace.",
  "Good things are coming your way."
];

export const data = new SlashCommandBuilder()
  .setName('affirmation')
  .setDescription('Random affirmation');

export async function execute(interaction) {
  await interaction.reply('💫 ' + pick(LINES));
}
