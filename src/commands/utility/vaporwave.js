import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('vaporwave')
  .setDescription("ｆｕｌｌ-ｗｉｄｔｈ vaporwave text")
  .addStringOption((o) => o.setName('text').setDescription('Text to transform').setRequired(true));

export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out;
  try { out = (function (t) { return [...t].map(c=>{const o=c.charCodeAt(0);return o>=33&&o<=126?String.fromCharCode(o+65248):c===' '?'　':c;}).join(''); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
