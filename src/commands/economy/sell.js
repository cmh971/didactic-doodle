import { SlashCommandBuilder } from 'discord.js';
import { getItem, hasItem, removeItem, addWallet } from '../../economy/store.js';
import { eph } from '../../util.js';
import { TOKEN } from '../../config.js';
import { fmt } from '../../render/extras.js';

export const data = new SlashCommandBuilder()
  .setName('sell')
  .setDescription('Sell an item back for half its price')
  .addStringOption((o) => o.setName('item').setDescription('Item id').setRequired(true))
  .addIntegerOption((o) => o.setName('amount').setDescription('How many').setMinValue(1));

export async function execute(interaction) {
  const itemId = interaction.options.getString('item');
  const amount = interaction.options.getInteger('amount') ?? 1;
  const item = getItem(itemId);
  if (!item) return interaction.reply(eph(`❌ No item with id \`${itemId}\`.`));
  if (!hasItem(interaction.user.id, itemId) || !removeItem(interaction.user.id, itemId, amount)) {
    return interaction.reply(eph(`❌ You don't own ${amount}× **${item.name}**.`));
  }
  const refund = Math.floor((item.price * amount) / 2);
  addWallet(interaction.user.id, refund);
  await interaction.reply(`💸 Sold **${amount}× ${item.name}** for ${TOKEN} ${fmt(refund)}.`);
}
