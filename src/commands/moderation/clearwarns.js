import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { clearInfractions } from '../../systems/automod.js';

export const data = new SlashCommandBuilder()
  .setName('clearwarns')
  .setDescription('Clear all infractions/warnings for a member')
  .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const removed = clearInfractions(interaction.guildId, user.id);
  await interaction.reply(`🧹 Cleared **${removed}** infraction(s) for **${user.tag}**.`);
}
