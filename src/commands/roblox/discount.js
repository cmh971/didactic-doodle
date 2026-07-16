import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('discount')
  .setDescription('Calculate a discounted Robux price')
  .addIntegerOption((o) => o.setName('price').setDescription('Original Robux price').setRequired(true).setMinValue(1))
  .addNumberOption((o) => o.setName('percent').setDescription('Discount %').setRequired(true).setMinValue(0).setMaxValue(100));

export async function execute(interaction) {
  const price = interaction.options.getInteger('price');
  const pct = interaction.options.getNumber('percent');
  const off = Math.round(price * (pct / 100));
  const final = price - off;
  await interaction.reply(`🏷️ **${price.toLocaleString()}** Robux − ${pct}% = **${final.toLocaleString()}** Robux (saved ${off.toLocaleString()}).`);
}
