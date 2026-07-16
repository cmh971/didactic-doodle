import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Add or remove a role from a member')
  .addStringOption((o) =>
    o.setName('action').setDescription('Add or remove').setRequired(true).addChoices(
      { name: 'add', value: 'add' },
      { name: 'remove', value: 'remove' },
    ),
  )
  .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
  .addRoleOption((o) => o.setName('role').setDescription('Role to add/remove').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  const action = interaction.options.getString('action');
  const member = interaction.options.getMember('user');
  const role = interaction.options.getRole('role');

  if (!member) {
    return interaction.reply({ content: '❌ That user is not in this server.', flags: MessageFlags.Ephemeral });
  }

  try {
    if (action === 'add') {
      await member.roles.add(role);
      await interaction.reply(`✅ Added **${role.name}** to **${member.user.tag}**.`);
    } else {
      await member.roles.remove(role);
      await interaction.reply(`✅ Removed **${role.name}** from **${member.user.tag}**.`);
    }
  } catch (err) {
    await interaction.reply({
      content: `❌ Could not update roles (is my role above that one?): ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
