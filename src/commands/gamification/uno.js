import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { gameManager } from '../../uno/GameManager.js';
import { buildLobby, buildTable } from '../../ui.js';

export const data = new SlashCommandBuilder()
  .setName('uno')
  .setDescription('Play UNO with images rendered on the CPU')
  .addSubcommand((s) => s.setName('new').setDescription('Start a new UNO lobby in this channel'))
  .addSubcommand((s) => s.setName('status').setDescription('Show the current game state'))
  .addSubcommand((s) => s.setName('end').setDescription('End the game in this channel'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const channelId = interaction.channelId;
  const existing = gameManager.get(channelId);

  if (sub === 'new') {
    if (existing && !existing.finished) {
      return interaction.reply({
        content: '⚠️ A game is already running in this channel. Use `/uno end` first.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const game = gameManager.create(channelId, interaction.user.id);
    game.addPlayer(interaction.user.id, interaction.user.username);

    const reply = await interaction.reply({ ...buildLobby(game), withResponse: true });
    // Remember the lobby/table message so we can edit it later.
    game.tableMessageId = reply.resource.message.id;
    return;
  }

  if (sub === 'status') {
    if (!existing) {
      return interaction.reply({ content: 'No game here. Start one with `/uno new`.', flags: MessageFlags.Ephemeral });
    }
    const payload = existing.started ? buildTable(existing) : buildLobby(existing);
    return interaction.reply(payload);
  }

  if (sub === 'end') {
    if (!existing) {
      return interaction.reply({ content: 'No game to end here.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.user.id !== existing.hostId) {
      return interaction.reply({ content: 'Only the host can end the game.', flags: MessageFlags.Ephemeral });
    }
    gameManager.delete(channelId);
    return interaction.reply('🛑 The UNO game has been ended.');
  }
}
