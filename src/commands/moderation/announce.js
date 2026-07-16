import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Post an announcement embed to a channel')
  .addStringOption((o) => o.setName('message').setDescription('Announcement text').setRequired(true))
  .addChannelOption((o) =>
    o.setName('channel').setDescription('Target channel (defaults to here)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  )
  .addStringOption((o) => o.setName('title').setDescription('Title'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const message = interaction.options.getString('message');
  const title = interaction.options.getString('title') ?? '📢 Announcement';
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(title)
    .setDescription(message)
    .setFooter({ text: `By ${interaction.user.username}` })
    .setTimestamp();
  try {
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ Announcement sent to ${channel}.`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.reply({ content: `❌ Could not send: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}
