import { SlashCommandBuilder } from 'discord.js';
import { renderMeme } from '../../render/extras.js';

export const data = new SlashCommandBuilder()
  .setName('meme')
  .setDescription('Generate a quick top/bottom-text meme image')
  .addStringOption((o) => o.setName('top').setDescription('Top text').setRequired(true))
  .addStringOption((o) => o.setName('bottom').setDescription('Bottom text').setRequired(true));

export async function execute(interaction) {
  const top = interaction.options.getString('top');
  const bottom = interaction.options.getString('bottom');
  await interaction.reply({ files: [renderMeme(top, bottom)] });
}
