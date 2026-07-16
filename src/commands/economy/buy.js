import { SlashCommandBuilder } from 'discord.js';
import { getItem, balance, addWallet, addItem } from '../../economy/store.js';
import { eph } from '../../util.js';
import { TOKEN } from '../../config.js';
import { fmt } from '../../render/extras.js';

export const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Buy an item from the shop')
  .addStringOption((o) => o.setName('item').setDescription('Item id (see /shop)').setRequired(true))
  .addIntegerOption((o) => o.setName('amount').setDescription('How many').setMinValue(1));

export async function execute(interaction) {
  const itemId = interaction.options.getString('item');
  const amount = interaction.options.getInteger('amount') ?? 1;
  const item = getItem(itemId);
  if (!item) return interaction.reply(eph(`❌ No item with id \`${itemId}\`. Check \`/shop\`.`));

  const cost = item.price * amount;
  const b = balance(interaction.user.id);
  if (b.wallet < cost) {
    return interaction.reply(eph(`❌ You need ${TOKEN} ${fmt(cost)} but only have ${TOKEN} ${fmt(b.wallet)} in your wallet.`));
  }
  addWallet(interaction.user.id, -cost);
  addItem(interaction.user.id, itemId, amount);
  await interaction.reply(`✅ Bought **${amount}× ${item.name}** for ${TOKEN} ${fmt(cost)}! Use it with \`/use ${itemId}\`.`);
}
