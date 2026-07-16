import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('pirate')
  .setDescription("Talk like a pirate")
  .addStringOption((o) => o.setName('text').setDescription('Text to transform').setRequired(true));

export async function execute(interaction) {
  const t = interaction.options.getString('text');
  let out;
  try { out = (function (t) { return t.replace(/\\byou\\b/gi,'ye').replace(/\\bmy\\b/gi,'me').replace(/\\bis\\b/gi,'be').replace(/\\bhello\\b/gi,'ahoy')+' arr! 🏴‍☠️'; })(t); } catch { out = '⚠️ Could not transform that.'; }
  await interaction.reply({ content: String(out ?? '').slice(0, 1990) || '\u200b' });
}
