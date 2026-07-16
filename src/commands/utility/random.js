import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { rint } from '../../util.js';

export const data = new SlashCommandBuilder()
  .setName('random')
  .setDescription('Pick a random number in a range')
  .addIntegerOption((o) => o.setName('min').setDescription('Minimum').setRequired(true))
  .addIntegerOption((o) => o.setName('max').setDescription('Maximum').setRequired(true));

export async function execute(interaction) {
  const min = interaction.options.getInteger('min');
  const max = interaction.options.getInteger('max');
  if (min > max) return interaction.reply({ content: '❌ min must be ≤ max.', flags: MessageFlags.Ephemeral });
  await interaction.reply(`🎲 Random number between **${min}** and **${max}**: **${rint(min, max)}**`);
}
