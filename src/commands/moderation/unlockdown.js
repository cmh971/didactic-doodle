import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unlockdown')
  .setDescription('Lift a server-wide lockdown on all text channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  await interaction.deferReply();
  const everyone = interaction.guild.roles.everyone;
  let unlocked = 0;
  for (const channel of interaction.guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null });
      unlocked++;
    } catch {
      /* skip */
    }
  }
  await interaction.editReply(`🔓 Lockdown lifted — unlocked **${unlocked}** channel(s).`);
}
