import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { punish } from '../../features/management.js';
import { infractionCount } from '../../systems/automod.js';

export const data = new SlashCommandBuilder()
  .setName('modstats')
  .setDescription('View staff moderation stats')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((s) => s.setName('view').setDescription('View a staff member\'s stats').addUserOption((o) => o.setName('user').setDescription('Staff member')))
  .addSubcommand((s) => s.setName('leaderboard').setDescription('Top staff by punishments logged'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const g = interaction.guildId;

  if (sub === 'leaderboard') {
    const rows = punish.leaderboard.all(g);
    if (!rows.length) return interaction.reply('No punishment activity yet.');
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('🏆 Staff Leaderboard')
      .setDescription(rows.map((r, i) => `**${i + 1}.** <@${r.moderator_id}> — **${r.n}** punishments`).join('\n'));
    return interaction.reply({ embeds: [embed] });
  }

  const user = interaction.options.getUser('user') ?? interaction.user;
  const punishments = punish.byMod.get(g, user.id).n;
  const warns = infractionCount(g, user.id);
  const embed = new EmbedBuilder().setColor(0x3498db).setTitle(`👮 Mod Stats — ${user.username}`)
    .addFields(
      { name: 'Punishments logged', value: String(punishments), inline: true },
      { name: 'Discord infractions issued/received', value: String(warns), inline: true },
    );
  return interaction.reply({ embeds: [embed] });
}
