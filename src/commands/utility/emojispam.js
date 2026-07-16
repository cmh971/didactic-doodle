import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('emojispam')
  .setDescription("Sprinkle emoji between words")
  .addStringOption((o) => o.setName('text').setDescription('Text to transform').setRequired(true));

export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out;
  try { out = (function (t) { const e=['✨','🔥','💯','🎉','😎','🌟'];return t.split(' ').join(' '+e[Math.floor(Math.random()*e.length)]+' '); })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
