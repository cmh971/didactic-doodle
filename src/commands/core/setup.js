import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { renderPanel } from '../../setup/ui.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Open the full configuration wizard (browse pages with the ◀️ ▶️ arrows)')
  .addIntegerOption((o) => o.setName('page').setDescription('Jump straight to a page number'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: '❌ Use /setup inside a server.', flags: MessageFlags.Ephemeral });
  }
  const page = (interaction.options.getInteger('page') ?? 1) - 1;
  const panel = renderPanel(interaction.client, interaction.guildId, page < 0 ? 0 : page);
  // Public so others can see the panel; button/modal handlers still require Manage Server.
  await interaction.reply(panel);
}
