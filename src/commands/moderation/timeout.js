import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Temporarily mute (time out) a member')
  .addUserOption((o) => o.setName('user').setDescription('Member to time out').setRequired(true))
  .addIntegerOption((o) =>
    o.setName('minutes').setDescription('Duration in minutes (0 to remove)').setRequired(true).setMinValue(0).setMaxValue(40320),
  )
  .addStringOption((o) => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  const member = interaction.options.getMember('user');
  const minutes = interaction.options.getInteger('minutes');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  if (!member) {
    return interaction.reply({ content: '❌ That user is not in this server.', flags: MessageFlags.Ephemeral });
  }

  try {
    if (minutes === 0) {
      await member.timeout(null, `Timeout removed by ${interaction.user.tag}`);
      return interaction.reply(`🔊 Removed timeout from **${member.user.tag}**.`);
    }
    await member.timeout(minutes * 60_000, `${reason} (by ${interaction.user.tag})`);
    await interaction.reply(`🔇 Timed out **${member.user.tag}** for **${minutes} min**. Reason: ${reason}`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not time out that user: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
