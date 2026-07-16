import { SlashCommandBuilder } from 'discord.js';
export const data = new SlashCommandBuilder().setName('strike').setDescription("A̶d̶d̶ ̶s̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶")
  .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));
export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out; try { out = (function (t) { return [...t].map(c=>c+'\\u0336').join(''); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
