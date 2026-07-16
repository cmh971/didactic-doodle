import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { recordInfraction, infractionCount } from '../../systems/automod.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a member (logged to their infraction history)')
  .addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const total = recordInfraction(interaction.guildId, user.id, interaction.user.id, 'warn', reason);
  await user.send(`⚠️ You were warned in **${interaction.guild.name}**: ${reason}`).catch(() => {});
  await interaction.reply(`⚠️ Warned **${user.tag}** — ${reason}\nThey now have **${total}** infraction(s). View with \`/warnings\`.`);
}
