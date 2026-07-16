import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "What made you smile today?",
  "What's a small win from this week?",
  "Who are you grateful for and why?",
  "What would you tell your younger self?",
  "What are you looking forward to?"
];
export const data = new SlashCommandBuilder().setName('journalprompt').setDescription('Random journalprompt');
export async function execute(interaction) { await interaction.reply('📓 ' + pick(LINES)); }
