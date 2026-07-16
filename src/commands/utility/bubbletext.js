import { SlashCommandBuilder } from 'discord.js';
export const data = new SlashCommandBuilder().setName('bubbletext').setDescription("Ⓑⓤⓑⓑⓛⓔ text")
  .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));
export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out; try { out = (function (t) { return [...t].map(c=>{const x=c.toLowerCase();const i=x.charCodeAt(0)-97;return (i>=0&&i<26)?String.fromCodePoint(0x24D0+i):c;}).join(''); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
