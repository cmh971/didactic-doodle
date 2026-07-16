import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('binencode')
  .setDescription("Encode text to binary")
  .addStringOption((o) => o.setName('text').setDescription('Text to transform').setRequired(true));

export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out;
  try { out = (function (t) { return [...t].map(c=>c.charCodeAt(0).toString(2).padStart(8,'0')).join(' '); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
