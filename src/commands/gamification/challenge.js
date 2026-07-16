import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "Go 1 hour with no phone.",
  "Compliment 3 people today.",
  "Drink 8 glasses of water.",
  "Win a game without drawing a card.",
  "Learn 5 new words."
];
export const data = new SlashCommandBuilder().setName('challenge').setDescription('Random challenge');
export async function execute(interaction) { await interaction.reply('🎯 ' + pick(LINES)); }
