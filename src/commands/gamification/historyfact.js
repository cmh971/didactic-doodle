import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Oxford University is older than the Aztec Empire.",
  "Cleopatra lived closer to the Moon landing than to the pyramids.",
  "The Eiffel Tower was meant to be temporary.",
  "Ancient Romans used crushed mouse brains as toothpaste.",
  "Vikings used melted snow to navigate."
];

export const data = new SlashCommandBuilder()
  .setName('historyfact')
  .setDescription('Random historyfact');

export async function execute(interaction) {
  await interaction.reply('📜 ' + pick(LINES));
}
