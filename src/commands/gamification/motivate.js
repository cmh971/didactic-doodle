import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Push yourself, because no one else will do it for you.",
  "Great things never came from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Little progress each day adds up to big results.",
  "Don't stop until you're proud."
];

export const data = new SlashCommandBuilder()
  .setName('motivate')
  .setDescription('Random motivate');

export async function execute(interaction) {
  await interaction.reply('🔥 ' + pick(LINES));
}
