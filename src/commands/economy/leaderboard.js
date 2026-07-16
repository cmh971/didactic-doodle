import { SlashCommandBuilder } from 'discord.js';
import { leaderboard } from '../../economy/store.js';
import { renderLeaderboard } from '../../render/extras.js';
import { eph } from '../../util.js';

export const data = new SlashCommandBuilder().setName('leaderboard').setDescription('See the richest UNO players');

export async function execute(interaction) {
  const top = leaderboard(10);
  if (!top.length) return interaction.reply(eph('No one has any tokens yet — play `/uno` or claim `/daily`!'));

  const rows = [];
  for (const entry of top) {
    let name = `User ${entry.id.slice(-4)}`;
    try {
      const user = await interaction.client.users.fetch(entry.id);
      name = user.username;
    } catch {
      /* ignore */
    }
    rows.push({ name, total: entry.total });
  }
  await interaction.reply({ files: [renderLeaderboard(rows)] });
}
