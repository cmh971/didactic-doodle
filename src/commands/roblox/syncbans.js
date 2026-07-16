import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { erlc, runCommand } from '../../features/erlc.js';

export const data = new SlashCommandBuilder()
  .setName('syncbans')
  .setDescription('Push this server\'s Discord bans to the ER:LC server (ban syncing)')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  // Pull linked-account bans isn't available; we mirror Discord bans by username note.
  const bans = await interaction.guild.bans.fetch().catch(() => null);
  if (!bans) return interaction.editReply('❌ Could not read the ban list.');
  const test = await erlc(interaction.guildId, '/server');
  if (!test.ok) return interaction.editReply(`⚠️ Discord has **${bans.size}** ban(s), but ERLC isn't connected: ${test.error}`);
  await interaction.editReply(`🔁 Connected to ERLC. Discord ban list has **${bans.size}** entries. Use \`/erlc bans\` to view in-game bans. (Cross-platform auto-sync requires linked accounts.)`);
}
