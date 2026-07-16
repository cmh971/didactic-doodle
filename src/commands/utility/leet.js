import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('leet')
  .setDescription("Convert text to l33t speak")
  .addStringOption((o) => o.setName('text').setDescription('Text to transform').setRequired(true));

export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out;
  try { out = (function (t) { return t.replace(/[aeiostAEIOST]/g, c => ({a:'4',e:'3',i:'1',o:'0',s:'5',t:'7',A:'4',E:'3',I:'1',O:'0',S:'5',T:'7'}[c])); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
