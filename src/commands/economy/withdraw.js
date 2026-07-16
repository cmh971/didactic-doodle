import { SlashCommandBuilder } from 'discord.js';
import { withdraw, balance } from '../../economy/store.js';
import { eph } from '../../util.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('withdraw')
  .setDescription('Move tokens from your bank into your wallet')
  .addStringOption((o) => o.setName('amount').setDescription('Amount or "all"').setRequired(true));

export async function execute(interaction) {
  const raw = interaction.options.getString('amount');
  const bank = balance(interaction.user.id).bank;
  const amount = raw.toLowerCase() === 'all' ? bank : parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (!amount || amount <= 0) return interaction.reply(eph('❌ Enter a positive amount or "all".'));
  const r = withdraw(interaction.user.id, amount);
  if (!r.ok) return interaction.reply(eph(`❌ ${r.reason}`));
  await interaction.reply(`🏧 Withdrew ${TOKEN} **${r.amount.toLocaleString()}** to your wallet.`);
}
