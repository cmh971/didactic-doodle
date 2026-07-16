import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "A cozy animated film.",
  "A heist movie with a twist.",
  "A documentary about something weird.",
  "A comfort rewatch.",
  "A sci-fi that makes you think."
];
export const data = new SlashCommandBuilder().setName('movierec').setDescription('Random movierec');
export async function execute(interaction) { await interaction.reply('🎬 ' + pick(LINES)); }
