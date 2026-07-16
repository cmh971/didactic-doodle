import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Dogs' noses are as unique as fingerprints.",
  "A greyhound can beat a cheetah over long distances.",
  "Dogs dream like humans do.",
  "Puppies are born deaf.",
  "A dog's sense of smell is up to 100,000× ours."
];

export const data = new SlashCommandBuilder()
  .setName('dogfact')
  .setDescription('Random dogfact');

export async function execute(interaction) {
  await interaction.reply('🐶 ' + pick(LINES));
}
