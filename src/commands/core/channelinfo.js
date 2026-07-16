import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';

const TYPES = {
  [ChannelType.GuildText]: 'Text',
  [ChannelType.GuildVoice]: 'Voice',
  [ChannelType.GuildCategory]: 'Category',
  [ChannelType.GuildAnnouncement]: 'Announcement',
  [ChannelType.GuildForum]: 'Forum',
  [ChannelType.GuildStageVoice]: 'Stage',
};

export const data = new SlashCommandBuilder()
  .setName('channelinfo')
  .setDescription('Show details about a channel')
  .addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to here)'));

export async function execute(interaction) {
  const ch = interaction.options.getChannel('channel') ?? interaction.channel;
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`#️⃣ ${ch.name ?? 'channel'}`)
    .addFields(
      { name: 'ID', value: ch.id, inline: true },
      { name: 'Type', value: TYPES[ch.type] ?? String(ch.type), inline: true },
      { name: 'NSFW', value: ch.nsfw ? 'Yes' : 'No', inline: true },
      { name: 'Created', value: `<t:${Math.floor(ch.createdTimestamp / 1000)}:R>`, inline: true },
    );
  if (ch.topic) embed.setDescription(ch.topic);
  await interaction.reply({ embeds: [embed] });
}
