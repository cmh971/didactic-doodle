// Handles all button / select-menu interactions for UNO.
import { MessageFlags } from 'discord.js';
import { gameManager } from './uno/GameManager.js';
import { buildLobby, buildTable, buildHandView, buildColorPrompt, buildSwapPrompt } from './ui.js';
import { cardLabel } from './uno/Deck.js';
import { MODES, HOUSE_RULES } from './uno/rules.js';
import { resetHistory } from './ai/gemini.js';
import { settleGame } from './economy/settle.js';
import { renderWinBanner } from './render/extras.js';
import { WIN_REWARD, TOKEN } from './config.js';

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });

// Re-render the public table message (the one stored on the game).
async function updatePublicTable(game, channel) {
  if (!game.tableMessageId) return;
  try {
    const msg = await channel.messages.fetch(game.tableMessageId);
    await msg.edit(buildTable(game));
  } catch {
    /* message may have been deleted; ignore */
  }
}

export async function handleComponent(interaction) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  const id = interaction.customId;
  if (!id.startsWith('uno_')) return;

  const game = gameManager.get(interaction.channelId);
  if (!game) {
    return interaction.reply(ephemeral('This game no longer exists. Start a new one with `/uno new`.'));
  }
  const userId = interaction.user.id;

  // ---- Lobby: mode / house-rule dropdowns (host only) ----
  if (id === 'uno_mode' || id === 'uno_rules') {
    if (game.started) return interaction.reply(ephemeral('The game already started.'));
    if (userId !== game.hostId) return interaction.reply(ephemeral('Only the host can change the rules.'));
    if (id === 'uno_mode') {
      const choice = interaction.values[0];
      if (MODES.some((m) => m.id === choice)) game.mode = choice;
    } else {
      game.houseRules = new Set(interaction.values.filter((v) => HOUSE_RULES.some((h) => h.id === v)));
    }
    return interaction.update(buildLobby(game));
  }

  // ---- Lobby controls ----
  if (id === 'uno_join') {
    const r = game.addPlayer(userId, interaction.user.username);
    if (!r.ok) return interaction.reply(ephemeral(`❌ ${r.reason}`));
    return interaction.update(buildLobby(game));
  }

  if (id === 'uno_leave') {
    const r = game.removePlayer(userId);
    if (!r.ok) return interaction.reply(ephemeral(`❌ ${r.reason}`));
    if (game.started) {
      if (game.players.length < 2) {
        gameManager.delete(game.channelId);
        return interaction.update({ content: '🛑 Not enough players left. Game ended.', embeds: [], components: [], files: [] });
      }
      await interaction.update(buildTable(game));
    } else {
      await interaction.update(buildLobby(game));
    }
    return;
  }

  if (id === 'uno_start') {
    if (userId !== game.hostId) return interaction.reply(ephemeral('Only the host can start the game.'));
    const r = game.start();
    if (!r.ok) return interaction.reply(ephemeral(`❌ ${r.reason}`));
    game.tableMessageId = interaction.message.id;
    return interaction.update(buildTable(game));
  }

  // ---- Below requires the user to be a player ----
  const player = game.getPlayer(userId);
  if (!player) return interaction.reply(ephemeral('You are not in this game. Join during the lobby phase.'));

  if (id === 'uno_hand' || id === 'uno_refresh') {
    const view = buildHandView(game, player);
    if (id === 'uno_refresh') return interaction.update({ content: view.content, files: view.files, components: view.components });
    return interaction.reply({ ...view, flags: MessageFlags.Ephemeral });
  }

  if (id === 'uno_ai') {
    try {
      resetHistory(userId);
      await interaction.user.send(
        `👋 Hi **${interaction.user.username}**! I'm your private UNO AI coach (powered by Gemini).\n` +
          `I can see **only your hand** — no one else's. Ask me anything, like *"what should I play?"*\n` +
          `Just reply here in DMs to chat.`,
      );
      return interaction.reply(ephemeral('🤖 I just sent you a DM — check your messages!'));
    } catch {
      return interaction.reply(ephemeral('❌ I could not DM you. Enable **Direct Messages** for this server and try again.'));
    }
  }

  if (id === 'uno_uno') {
    const r = game.callUno(userId);
    if (!r.ok) return interaction.reply(ephemeral(`❌ ${r.reason}`));
    await updatePublicTable(game, interaction.channel);
    return interaction.reply(ephemeral('📣 You called UNO!'));
  }

  if (id === 'uno_draw') {
    const r = game.drawForTurn(userId);
    if (!r.ok) {
      if (r.reason === 'stack') return interaction.reply(ephemeral('🔥 There is a Draw stack — use the **Take cards** button.'));
      return interaction.reply(ephemeral(`❌ ${r.reason}`));
    }
    await updatePublicTable(game, interaction.channel);
    const view = buildHandView(game, player);
    const note = r.playable
      ? `🃏 You drew **${cardLabel(r.card)}** — play it, or pass.`
      : `🃏 You drew ${r.count} card(s). Last: **${cardLabel(r.card)}** (not playable). Press **Pass**.`;
    return interaction.update({ content: note, files: view.files, components: view.components });
  }

  if (id === 'uno_takestack') {
    const r = game.takeStack(userId);
    if (!r.ok) return interaction.reply(ephemeral(`❌ ${r.reason}`));
    await updatePublicTable(game, interaction.channel);
    if (game.finished) {
      const payout = settleGame(game);
      gameManager.delete(game.channelId);
      return interaction.update({ content: `🔥 You took ${r.drew} cards.${payout ?? ''}`, files: [], components: [] });
    }
    return interaction.update({ content: `🔥 You took the stack (+${r.drew}) and your turn ended.`, files: [], components: [] });
  }

  if (id === 'uno_pass') {
    const r = game.pass(userId);
    if (!r.ok) return interaction.reply(ephemeral(`❌ ${r.reason}`));
    await updatePublicTable(game, interaction.channel);
    return interaction.update({ content: '⏭️ You passed your turn.', files: [], components: [] });
  }

  // ---- Seven-O swap target chosen ----
  if (id === 'uno_swap') {
    const targetId = interaction.values[0];
    const r = game.completeSwap(userId, targetId);
    if (!r.ok) return interaction.reply(ephemeral(`❌ ${r.reason}`));
    await updatePublicTable(game, interaction.channel);
    return interaction.update({ content: `🔁 ${game.lastAction}`, files: [], components: [] });
  }

  // ---- Play a card from the hand select menu ----
  if (id === 'uno_play') {
    const handIndex = parseInt(interaction.values[0], 10);
    const card = player.hand[handIndex];
    if (!card) return interaction.reply(ephemeral('❌ That card is no longer in your hand.'));
    // playCard returns 'pick-color' for any wild that still needs a color.
    return resolvePlay(interaction, game, player, handIndex, null);
  }

  // ---- Wild color chosen ----
  if (id.startsWith('uno_color:')) {
    const [, color, idxStr] = id.split(':');
    return resolvePlay(interaction, game, player, parseInt(idxStr, 10), color);
  }
}

async function resolvePlay(interaction, game, player, handIndex, color) {
  const r = game.playCard(player.id, handIndex, color);
  if (!r.ok) {
    if (r.reason === 'pick-color') {
      return interaction.update(buildColorPrompt(game, handIndex));
    }
    return interaction.reply(ephemeral(`❌ ${r.reason}`));
  }

  await updatePublicTable(game, interaction.channel);

  if (r.won) {
    const payout = settleGame(game);
    gameManager.delete(game.channelId);
    const banner = renderWinBanner(`+${TOKEN} ${WIN_REWARD.toLocaleString()} tokens`);
    return interaction.update({
      content: `🎉 You played your last card — **you win!**${payout ?? ''}`,
      files: [banner],
      components: [],
    });
  }

  if (r.needSwap) {
    return interaction.update(buildSwapPrompt(game, player));
  }

  const view = buildHandView(game, player);
  return interaction.update({ content: `✅ ${r.message}`, files: view.files, components: view.components });
}
