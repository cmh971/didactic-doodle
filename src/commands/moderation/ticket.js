import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getCfg } from '../../setup/store.js';
import { buildPanelMessage } from '../../features/tickets.js';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Post the configured ticket panel here (design it in /setup ▸ Tickets)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const cfg = getCfg(interaction.guildId);
  if (!cfg.settings.tickets.enabled) {
    return interaction.reply({ content: '❌ Tickets are disabled. Enable & design them in `/setup` ▸ 🎫 Tickets first.', flags: MessageFlags.Ephemeral });
  }
  await interaction.channel.send(buildPanelMessage(cfg.settings, interaction.guild));
  await interaction.reply({ content: '✅ Ticket panel posted. (Tip: you can also deploy from `/setup` ▸ Tickets.)', flags: MessageFlags.Ephemeral });
}
