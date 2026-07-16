import { SlashCommandBuilder } from 'discord.js';
import { eph } from '../../util.js';
import { renderColor } from '../../render/extras.js';

export const data = new SlashCommandBuilder()
  .setName('colorpick')
  .setDescription('Preview a hex color (or get a random one)')
  .addStringOption((o) => o.setName('hex').setDescription('Hex like #ff8800 (blank = random)'));

export async function execute(interaction) {
  let hex = interaction.options.getString('hex');
  if (!hex) {
    hex = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  } else {
    hex = hex.startsWith('#') ? hex : `#${hex}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return interaction.reply(eph('❌ Use a hex like `#ff8800`.'));
  }
  await interaction.reply({ content: `🎨 **${hex.toUpperCase()}**`, files: [renderColor(hex)] });
}
