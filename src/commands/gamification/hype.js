import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "LET'S GOOOO! 🔥",
  "You're built different! 💪",
  "Absolute legend behavior! 🏆",
  "Unstoppable today! ⚡",
  "Main character energy! 🌟"
];

export const data = new SlashCommandBuilder()
  .setName('hype')
  .setDescription('Random hype');

export async function execute(interaction) {
  await interaction.reply('🎉 ' + pick(LINES));
}
