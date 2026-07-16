import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';
const LINES = [
  "I was teaching a cat to play UNO.",
  "I was stuck in a very long elevator chat.",
  "I was reorganizing my sock drawer alphabetically.",
  "I was negotiating peace between two roombas.",
  "I was lost in a corn maze."
];
export const data = new SlashCommandBuilder().setName('alibi').setDescription('Random alibi');
export async function execute(interaction) { await interaction.reply('🕵️ ' + pick(LINES)); }
