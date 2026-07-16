import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "…stayed up all night gaming.",
  "…rage quit a board game.",
  "…eaten cereal for dinner.",
  "…pretended to be busy to avoid someone.",
  "…laughed at the wrong moment."
];

export const data = new SlashCommandBuilder()
  .setName('neverhaveiever')
  .setDescription('Random neverhaveiever');

export async function execute(interaction) {
  await interaction.reply('🙊 ' + pick(LINES));
}
