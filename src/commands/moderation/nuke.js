import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nuke')
  .setDescription('Wipe this channel by cloning it and deleting the original')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const channel = interaction.channel;
  await interaction.reply('💣 Nuking this channel…');
  try {
    const clone = await channel.clone({ reason: `Nuked by ${interaction.user.tag}` });
    await clone.setPosition(channel.position);
    await channel.delete('Nuked');
    await clone.send(`💥 Channel nuked by ${interaction.user}. Fresh start!`);
  } catch (err) {
    await interaction.editReply(`❌ Could not nuke: ${err.message}`).catch(() => {});
  }
}
