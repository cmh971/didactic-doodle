import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Show information about a user')
  .addUserOption((o) => o.setName('user').setDescription('User (defaults to you)'));

export async function execute(interaction) {
  const user = interaction.options.getUser('user') ?? interaction.user;
  const member = interaction.options.getMember('user') ?? interaction.member;

  const embed = new EmbedBuilder()
    .setTitle(`👤 ${user.tag}`)
    .setColor(0x5865f2)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'ID', value: user.id, inline: true },
      { name: 'Bot?', value: user.bot ? 'Yes' : 'No', inline: true },
      { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: false },
    );

  if (member?.joinedTimestamp) {
    embed.addFields({ name: 'Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: false });
    const roles = member.roles.cache.filter((r) => r.id !== interaction.guild.id).map((r) => r.toString());
    if (roles.length) embed.addFields({ name: `Roles (${roles.length})`, value: roles.join(' ').slice(0, 1024) });
  }

  await interaction.reply({ embeds: [embed] });
}
