import { SlashCommandBuilder } from 'discord.js';
import { eph, pick } from '../../util.js';

export const data = new SlashCommandBuilder()
  .setName('choose')
  .setDescription('Let the bot pick between options')
  .addStringOption((o) => o.setName('options').setDescription('Comma-separated options').setRequired(true));

export async function execute(interaction) {
  const opts = interaction.options
    .getString('options')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (opts.length < 2) return interaction.reply(eph('❌ Give me at least 2 comma-separated options.'));
  await interaction.reply(`🤔 I choose: **${pick(opts)}**`);
}
