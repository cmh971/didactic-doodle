import { SlashCommandBuilder } from 'discord.js';
import { balance, getUser, leaderboard } from '../../economy/store.js';
import { renderProfile } from '../../render/extras.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your (or someone else\'s) UNO Token balance')
  .addUserOption((o) => o.setName('user').setDescription('Whose balance to check'));

export async function execute(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const u = getUser(target.id);
  const b = balance(target.id);
  const board = leaderboard(1000);
  const rank = board.findIndex((r) => r.id === target.id) + 1;
  const img = renderProfile({
    username: target.username,
    wallet: b.wallet,
    bank: b.bank,
    wins: u.wins,
    losses: u.losses,
    rank: rank || null,
  });
  await interaction.reply({ content: `🪙 **${target.username}**'s balance:`, files: [img] });
}
