import { SlashCommandBuilder } from 'discord.js';
export const data = new SlashCommandBuilder().setName('underline').setDescription("U̲n̲d̲e̲r̲l̲i̲n̲e̲ text")
  .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));
export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out; try { out = (function (t) { return [...t].map(c=>c+'\\u0332').join(''); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
