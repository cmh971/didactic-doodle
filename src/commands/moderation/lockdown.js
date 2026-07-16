import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('lockdown')
  .setDescription('Lock EVERY text channel so @everyone can\'t send messages')
  .addStringOption((o) => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  await interaction.deferReply();
  const everyone = interaction.guild.roles.everyone;
  const reason = interaction.options.getString('reason') ?? 'Server lockdown';
  let locked = 0;
  for (const channel of interaction.guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason });
      locked++;
    } catch {
      /* skip channels we can't edit */
    }
  }
  await interaction.editReply(`🔒 **Server lockdown** — locked **${locked}** channel(s). Reason: ${reason}`);
}
