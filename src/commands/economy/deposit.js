import { SlashCommandBuilder } from 'discord.js';
import { deposit, balance } from '../../economy/store.js';
import { eph } from '../../util.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('deposit')
  .setDescription('Move tokens from your wallet into the bank')
  .addStringOption((o) => o.setName('amount').setDescription('Amount or "all"').setRequired(true));

export async function execute(interaction) {
  const raw = interaction.options.getString('amount');
  const wallet = balance(interaction.user.id).wallet;
  const amount = raw.toLowerCase() === 'all' ? wallet : parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (!amount || amount <= 0) return interaction.reply(eph('❌ Enter a positive amount or "all".'));
  const r = deposit(interaction.user.id, amount);
  if (!r.ok) return interaction.reply(eph(`❌ ${r.reason}`));
  await interaction.reply(`🏦 Deposited ${TOKEN} **${r.amount.toLocaleString()}** into your bank.`);
}
