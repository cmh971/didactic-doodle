import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Cats sleep 13–16 hours a day.",
  "A group of cats is called a clowder.",
  "Cats have 32 muscles in each ear.",
  "A cat's purr vibrates at a healing frequency.",
  "Cats can't taste sweetness."
];

export const data = new SlashCommandBuilder()
  .setName('catfact')
  .setDescription('Random catfact');

export async function execute(interaction) {
  await interaction.reply('🐱 ' + pick(LINES));
}
