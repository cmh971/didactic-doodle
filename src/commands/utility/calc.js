import { SlashCommandBuilder } from 'discord.js';
import { eph } from '../../util.js';

export const data = new SlashCommandBuilder()
  .setName('calc')
  .setDescription('Evaluate a simple math expression')
  .addStringOption((o) => o.setName('expression').setDescription('e.g. 2 + 2 * 10').setRequired(true));

export async function execute(interaction) {
  const expr = interaction.options.getString('expression');
  // Only allow numbers, operators, parentheses, decimal points — no code execution.
  if (!/^[0-9+\-*/.()%\s]+$/.test(expr)) {
    return interaction.reply(eph('❌ Only numbers and + - * / % ( ) are allowed.'));
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('bad');
    await interaction.reply(`🧮 \`${expr}\` = **${result}**`);
  } catch {
    await interaction.reply(eph('❌ Could not evaluate that expression.'));
  }
}
