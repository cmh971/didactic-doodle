import { SlashCommandBuilder } from 'discord.js';

// Roblox marketplace fee is 30% — creators keep 70%.
const KEEP = 0.7;

export const data = new SlashCommandBuilder()
  .setName('tax')
  .setDescription('Calculate Roblox 30% marketplace tax')
  .addIntegerOption((o) => o.setName('amount').setDescription('Robux amount').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount');
  const afterTax = Math.floor(amount * KEEP);
  const listFor = Math.ceil(amount / KEEP);
  await interaction.reply(
    `💸 **Tax (30%) calculator**\n` +
      `• If you sell for **${amount.toLocaleString()}**, you receive **${afterTax.toLocaleString()}** Robux.\n` +
      `• To actually receive **${amount.toLocaleString()}**, list it for **${listFor.toLocaleString()}** Robux.`,
  );
}
