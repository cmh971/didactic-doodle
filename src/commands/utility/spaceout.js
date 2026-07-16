import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('spaceout')
  .setDescription("S p a c e   o u t   text")
  .addStringOption((o) => o.setName('text').setDescription('Text to transform').setRequired(true));

export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out;
  try { out = (function (t) { return [...t].join(' '); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
