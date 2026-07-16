import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "😌 calm",
  "🔥 unstoppable",
  "😴 sleepy",
  "🤔 pensive",
  "🥳 celebratory",
  "🦝 chaotic"
];
export const data = new SlashCommandBuilder().setName('mood').setDescription('Random mood');
export async function execute(interaction) { await interaction.reply('🎭 ' + pick(LINES)); }
