import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clap')
  .setDescription('Add 👏 claps 👏 between 👏 words')
  .addStringOption((o) => o.setName('text').setDescription('Text to clap').setRequired(true));

export async function execute(interaction) {
  const out = interaction.options.getString('text').trim().split(/\s+/).join(' 👏 ');
  await interaction.reply(`👏 ${out} 👏`.slice(0, 2000));
}
