import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nickname')
  .setDescription('Change or clear a member\'s nickname')
  .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
  .addStringOption((o) => o.setName('nickname').setDescription('New nickname (leave blank to clear)'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames);

export async function execute(interaction) {
  const member = interaction.options.getMember('user');
  const nick = interaction.options.getString('nickname') ?? null;
  if (!member) return interaction.reply({ content: '❌ That user is not in this server.', flags: MessageFlags.Ephemeral });
  try {
    await member.setNickname(nick, `Changed by ${interaction.user.tag}`);
    await interaction.reply(nick ? `✏️ Set **${member.user.tag}**'s nickname to **${nick}**.` : `🧹 Cleared **${member.user.tag}**'s nickname.`);
  } catch (err) {
    await interaction.reply({ content: `❌ Could not change nickname (is my role above theirs?): ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
