import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getItem } from '../../economy/store.js';
import { eph } from '../../util.js';
import { TOKEN } from '../../config.js';
import { fmt } from '../../render/extras.js';

export const data = new SlashCommandBuilder()
  .setName('iteminfo')
  .setDescription('Show details about a shop item')
  .addStringOption((o) => o.setName('item').setDescription('Item id').setRequired(true));

export async function execute(interaction) {
  const item = getItem(interaction.options.getString('item'));
  if (!item) return interaction.reply(eph('❌ No item with that id. Check `/shop`.'));
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(item.name)
    .setDescription(item.description)
    .addFields(
      { name: 'Price', value: `${TOKEN} ${fmt(item.price)}`, inline: true },
      { name: 'Type', value: item.consumable ? 'Consumable' : 'Collectible', inline: true },
      { name: 'Effect', value: item.effect, inline: true },
      { name: 'ID', value: `\`${item.id}\``, inline: true },
    );
  if (item.custom) embed.setFooter({ text: 'AI-approved community item ✨' });
  await interaction.reply({ embeds: [embed] });
}
