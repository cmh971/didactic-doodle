import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getLevel, xpNeeded, leaderboard } from '../../systems/leveling.js';
import { renderRankCard } from '../../render/cards.js';

export const data = new SlashCommandBuilder()
  .setName('level')
  .setDescription('Show your (or someone\'s) level & XP as a rank card')
  .addUserOption((o) => o.setName('user').setDescription('Whose level'));

export async function execute(interaction) {
  if (!interaction.guild) return interaction.reply({ content: '❌ Use this in a server.', flags: MessageFlags.Ephemeral });
  await interaction.deferReply();
  const target = interaction.options.getUser('user') ?? interaction.user;
  const row = getLevel(target.id, interaction.guild.id);
  const level = row.level || 1;
  const need = xpNeeded(level);
  const rank = leaderboard(interaction.guild.id, 1000).findIndex((r) => r.id === target.id) + 1;

  const card = await renderRankCard({
    username: target.username,
    avatarURL: target.displayAvatarURL({ extension: 'png', size: 256 }),
    level,
    xp: row.xp,
    need,
    rank: rank || null,
  });
  await interaction.editReply({ files: [card] });
}
