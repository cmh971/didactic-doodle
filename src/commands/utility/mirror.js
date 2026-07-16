import { SlashCommandBuilder } from 'discord.js';
export const data = new SlashCommandBuilder().setName('mirror').setDescription("Mirror each line of text")
  .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));
export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out; try { out = (function (t) { return t.split('\\n').map(l=>[...l].reverse().join('')).join('\\n'); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
