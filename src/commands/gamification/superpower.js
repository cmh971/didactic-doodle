import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "🕒 Time control",
  "🦅 Flight",
  "👻 Invisibility",
  "🧠 Telepathy",
  "⚡ Super speed",
  "💪 Super strength"
];
export const data = new SlashCommandBuilder().setName('superpower').setDescription('Random superpower');
export async function execute(interaction) { await interaction.reply('🦸 ' + pick(LINES)); }
