import { SlashCommandBuilder } from 'discord.js';

const MAP = { a: '🅰️', b: '🅱️', o: '⭕', i: 'ℹ️', x: '❌', '!': '❗', '?': '❓' };

export const data = new SlashCommandBuilder()
  .setName('emojify')
  .setDescription('Turn letters into emoji')
  .addStringOption((o) => o.setName('text').setDescription('Text to emojify').setRequired(true));

export async function execute(interaction) {
  const out = [...interaction.options.getString('text').toLowerCase()]
    .map((c) => {
      if (MAP[c]) return MAP[c];
      if (c >= 'a' && c <= 'z') return `:regional_indicator_${c}:`;
      if (c >= '0' && c <= '9') return `${c}⃣`;
      return c;
    })
    .join('');
  await interaction.reply(out.slice(0, 2000));
}
