import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('wavetext')
  .setDescription("wAvE cAsE your text")
  .addStringOption((o) => o.setName('text').setDescription('Text to transform').setRequired(true));

export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out;
  try { out = (function (t) { return [...t].map((c,i)=>i%2?c.toUpperCase():c.toLowerCase()).join(''); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
