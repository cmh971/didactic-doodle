import { SlashCommandBuilder } from 'discord.js';
import { balance, getUser } from '../../economy/store.js';
import { renderCoin } from '../../render/extras.js';
import { TOKEN } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('networth')
  .setDescription('Show total net worth (wallet + bank)')
  .addUserOption((o) => o.setName('user').setDescription('Whose net worth'));

export async function execute(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const b = balance(target.id);
  const u = getUser(target.id);
  await interaction.reply({
    content: `💰 **${target.username}** is worth ${TOKEN} **${b.total.toLocaleString()}**\n🏆 ${u.wins} wins · 💀 ${u.losses} losses`,
    files: [renderCoin(b.total, 'NET WORTH')],
  });
}
