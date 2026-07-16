import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getShopItems } from '../../economy/store.js';
import { renderShopBanner, fmt } from '../../render/extras.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder().setName('shop').setDescription('Browse the UNO Token shop');

export async function execute(interaction) {
  const items = getShopItems();
  const embed = new EmbedBuilder()
    .setColor(0x0f3460)
    .setTitle('🛒 UNO Shop')
    .setDescription(
      items
        .map(
          (i) =>
            `**${i.name}** — ${TOKEN} ${fmt(i.price)}\n` +
            `\`${i.id}\` · ${i.description}`,
        )
        .join('\n\n') + `\n\nBuy with \`/buy <id>\` · use with \`/use <id>\``,
    )
    .setImage('attachment://shop.png');
  await interaction.reply({ embeds: [embed], files: [renderShopBanner()] });
}
