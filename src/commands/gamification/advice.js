import { SlashCommandBuilder } from 'discord.js';
import { pick } from '../../util.js';

const LINES = [
  "Drink some water right now.",
  "Say the thing you've been putting off.",
  "Sleep on big decisions.",
  "Back up your files today.",
  "Be kind; everyone's fighting something."
];

export const data = new SlashCommandBuilder()
  .setName('advice')
  .setDescription('Random advice');

export async function execute(interaction) {
  await interaction.reply('🧠 ' + pick(LINES));
}
