import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "I told my computer I needed a break, and it said \"no problem — I'll go to sleep.\"",
  "I'm on a seafood diet. I see food and I eat it.",
  "Parallel lines have so much in common; shame they'll never meet.",
  "I have a joke about chemistry, but I don't think it'll get a reaction."
];

export const data = new SlashCommandBuilder()
  .setName('oneliner')
  .setDescription('Random oneliner');

export async function execute(interaction) {
  await interaction.reply('🎤 ' + pick(LINES));
}
