import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Make the bot say something')
  .addStringOption((o) => o.setName('message').setDescription('What to say').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const message = interaction.options.getString('message');
  await interaction.reply({ content: '✅ Sent.', flags: MessageFlags.Ephemeral });
  await interaction.channel.send(message.slice(0, 2000));
}
