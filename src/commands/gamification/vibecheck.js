import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Vibe: immaculate ✨",
  "Vibe: chaotic good 😈",
  "Vibe: sleepy but happy 😴",
  "Vibe: main character 🌟",
  "Vibe: gremlin mode 🦝"
];

export const data = new SlashCommandBuilder()
  .setName('vibecheck')
  .setDescription('Random vibecheck');

export async function execute(interaction) {
  await interaction.reply('✨ ' + pick(LINES));
}
