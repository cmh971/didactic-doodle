import { SlashCommandBuilder } from 'discord.js';
import { eph, rint } from '../../util.js';

export const data = new SlashCommandBuilder()
  .setName('roll')
  .setDescription('Roll dice in NdM notation (e.g. 2d6)')
  .addStringOption((o) => o.setName('dice').setDescription('Like 2d6, d20, 4d8'));

export async function execute(interaction) {
  const spec = (interaction.options.getString('dice') ?? '1d6').toLowerCase().replace(/\s/g, '');
  const m = spec.match(/^(\d*)d(\d+)$/);
  if (!m) return interaction.reply(eph('❌ Use NdM notation, e.g. `2d6` or `d20`.'));
  const count = Math.min(parseInt(m[1] || '1', 10), 50);
  const sides = Math.min(parseInt(m[2], 10), 1000);
  if (count < 1 || sides < 2) return interaction.reply(eph('❌ Invalid dice.'));
  const rolls = Array.from({ length: count }, () => rint(1, sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  await interaction.reply(`🎲 **${spec}** → [${rolls.join(', ')}] = **${total}**`);
}
