import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, getItem } from '../../economy/store.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Show your owned items')
  .addUserOption((o) => o.setName('user').setDescription('Whose inventory'));

export async function execute(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const u = getUser(target.id);
  const entries = Object.entries(u.inventory);
  const desc = entries.length
    ? entries
        .map(([id, qty]) => {
          const item = getItem(id);
          return `**${item ? item.name : id}** ×${qty}  \`${id}\``;
        })
        .join('\n')
    : '_Empty — visit the `/shop`!_';
  const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle(`🎒 ${target.username}'s Inventory`).setDescription(desc);
  await interaction.reply({ embeds: [embed] });
}
