// Builds Discord message payloads (embeds, buttons, menus, images) from game state.
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { renderCard, renderHand, renderTable } from './render/renderer.js';
import { cardLabel } from './uno/Deck.js';
import { MODES, HOUSE_RULES } from './uno/rules.js';

const COLOR_EMOJI = {
  red: '🔴', green: '🟢', blue: '🔵', yellow: '🟡',
  pink: '🩷', teal: '🟦', orange: '🟧', purple: '🟪',
  wild: '⬛',
};

const colorEmoji = (c) => COLOR_EMOJI[c] || '⬛';

// ---- Lobby (before the game starts) ----
export function buildLobby(game) {
  const list = game.players.length
    ? game.players.map((p, i) => `**${i + 1}.** ${p.username}`).join('\n')
    : '_No one yet — be the first!_';

  const mode = MODES.find((m) => m.id === game.mode);
  const rules = [...game.houseRules].map((r) => HOUSE_RULES.find((h) => h.id === r)?.label).filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle('🎴 UNO — Lobby')
    .setColor(0xf1c40f)
    .setDescription(
      `Need **2–10** players. Host <@${game.hostId}> sets the rules & presses **Start**.\n\n` +
        `**Mode:** ${mode.emoji} ${mode.label}\n_${mode.description}_\n` +
        `**House rules:** ${rules.length ? rules.join(', ') : '_none_'}\n\n` +
        `**Players:**\n${list}`,
    );

  const modeMenu = new StringSelectMenuBuilder()
    .setCustomId('uno_mode')
    .setPlaceholder('🎮 Choose the game mode…')
    .addOptions(
      MODES.map((m) => ({
        label: m.label,
        value: m.id,
        description: m.description.slice(0, 100),
        emoji: m.emoji,
        default: m.id === game.mode,
      })),
    );

  const ruleMenu = new StringSelectMenuBuilder()
    .setCustomId('uno_rules')
    .setPlaceholder('⚙️ Toggle house rules (optional)…')
    .setMinValues(0)
    .setMaxValues(HOUSE_RULES.length)
    .addOptions(
      HOUSE_RULES.map((h) => ({
        label: h.label,
        value: h.id,
        description: h.description.slice(0, 100),
        emoji: h.emoji,
        default: game.houseRules.has(h.id),
      })),
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('uno_join').setLabel('Join').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('uno_leave').setLabel('Leave').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('uno_start').setLabel('Start').setStyle(ButtonStyle.Primary).setEmoji('🚀'),
  );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(modeMenu),
      new ActionRowBuilder().addComponents(ruleMenu),
      buttons,
    ],
    files: [],
  };
}

// ---- Public table (during the game) ----
export function buildTable(game) {
  const topFace = game.topFace();
  // Full CPU-rendered table scene PNG (felt, draw pile, discard, players…).
  const sceneBuffer = renderTable({
    topFace,
    currentColor: game.currentColor,
    drawCount: game.drawPile.length,
    direction: game.direction,
    pendingDraw: game.pendingDraw,
    side: game.side,
    mode: game.mode,
    currentIndex: game.currentIndex,
    players: game.players.map((p) => ({ username: p.username, handCount: p.hand.length })),
  });
  const attachment = new AttachmentBuilder(sceneBuffer, { name: 'table.png' });

  const order = game.players
    .map((p, i) => `${i === game.currentIndex ? '▶️ ' : ''}${p.username} — ${p.hand.length} card${p.hand.length === 1 ? '' : 's'}`)
    .join('\n');

  const mode = MODES.find((m) => m.id === game.mode);
  const dir = game.direction === 1 ? 'clockwise ↻' : 'counter-clockwise ↺';
  let extra = '';
  if (game.pendingDraw > 0) extra += `\n🔥 **Draw stack: ${game.pendingDraw}** — stack or take them!`;
  if (game.mode === 'flip') extra += `\n🔃 Side: **${game.side}**`;

  const embed = new EmbedBuilder()
    .setTitle(`${mode.emoji} UNO — ${mode.label}`)
    .setColor(game.side === 'dark' ? 0x2c2f33 : 0x2ecc71)
    .setImage('attachment://table.png')
    .setDescription(
      `${game.lastAction}\n\n` +
        `**Current color:** ${colorEmoji(game.currentColor)} ${game.currentColor}\n` +
        `**Top card:** ${cardLabel(topFace)}\n` +
        `**Direction:** ${dir}${extra}\n\n` +
        `**Turn order:**\n${order}\n\n` +
        `➡️ It's **${game.currentPlayer.username}**'s turn.`,
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('uno_hand').setLabel('Show Hand / Play').setStyle(ButtonStyle.Primary).setEmoji('🖐️'),
    new ButtonBuilder().setCustomId('uno_uno').setLabel('Call UNO!').setStyle(ButtonStyle.Danger).setEmoji('📣'),
    new ButtonBuilder().setCustomId('uno_ai').setLabel('Talk to AI').setStyle(ButtonStyle.Secondary).setEmoji('🤖'),
    new ButtonBuilder().setCustomId('uno_leave').setLabel('Leave').setStyle(ButtonStyle.Secondary).setEmoji('🚪'),
  );

  return { embeds: [embed], components: [row], files: [attachment] };
}

// ---- Private ephemeral hand view ----
export function buildHandView(game, player) {
  const isTurn = game.currentPlayer.id === player.id && !game.pendingSwap;
  const faces = player.hand.map((c) => game.face(c));
  const buffer = renderHand(faces);
  const attachment = new AttachmentBuilder(buffer, { name: 'hand.png' });

  const components = [];

  if (isTurn) {
    const playable = game.playableIndexes(player);
    if (playable.length) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('uno_play')
        .setPlaceholder(game.pendingDraw > 0 ? 'Stack a Draw card…' : 'Choose a card to play…')
        .addOptions(
          playable.slice(0, 25).map(({ card, i }) => {
            const f = game.face(card);
            return { label: cardLabel(f).slice(0, 100), value: String(i), emoji: colorEmoji(f.color) };
          }),
        );
      components.push(new ActionRowBuilder().addComponents(menu));
    }

    const actions = new ActionRowBuilder();
    if (game.pendingDraw > 0) {
      actions.addComponents(
        new ButtonBuilder()
          .setCustomId('uno_takestack')
          .setLabel(`Take ${game.pendingDraw} cards`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔥'),
      );
    } else {
      const mustPlay = game.houseRules.has('force_play') && game.playableIndexes(player).length > 0;
      actions.addComponents(
        new ButtonBuilder()
          .setCustomId('uno_draw')
          .setLabel('Draw a card')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🃏')
          .setDisabled(game.drawnThisTurn || mustPlay),
        new ButtonBuilder()
          .setCustomId('uno_pass')
          .setLabel('Pass')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏭️')
          .setDisabled(!game.drawnThisTurn),
      );
    }
    actions.addComponents(
      new ButtonBuilder().setCustomId('uno_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
    );
    components.push(actions);
  } else {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('uno_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
      ),
    );
  }

  const content = isTurn
    ? `It's **your turn**. You have **${player.hand.length}** card(s).`
    : `Not your turn. You have **${player.hand.length}** card(s). Current turn: **${game.currentPlayer.username}**.`;

  return { content, files: [attachment], components };
}

// Color-choice prompt for wild cards — colors depend on the current side.
export function buildColorPrompt(game, handIndex) {
  const styleFor = {
    red: ButtonStyle.Danger, yellow: ButtonStyle.Secondary, green: ButtonStyle.Success, blue: ButtonStyle.Primary,
    pink: ButtonStyle.Danger, teal: ButtonStyle.Primary, orange: ButtonStyle.Secondary, purple: ButtonStyle.Primary,
  };
  const row = new ActionRowBuilder().addComponents(
    game.colorChoices().map((c) =>
      new ButtonBuilder()
        .setCustomId(`uno_color:${c}:${handIndex}`)
        .setLabel(c.charAt(0).toUpperCase() + c.slice(1))
        .setStyle(styleFor[c] || ButtonStyle.Secondary)
        .setEmoji(colorEmoji(c)),
    ),
  );
  return { content: '🌈 Choose a color for your wild card:', components: [row], files: [] };
}

// Seven-O: choose which player to swap hands with.
export function buildSwapPrompt(game, player) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('uno_swap')
    .setPlaceholder('Choose a player to swap hands with…')
    .addOptions(
      game.players
        .filter((p) => p.id !== player.id)
        .slice(0, 25)
        .map((p) => ({ label: `${p.username} (${p.hand.length} cards)`.slice(0, 100), value: p.id })),
    );
  return { content: '🔁 **Seven-O:** pick a player to swap hands with:', components: [new ActionRowBuilder().addComponents(menu)], files: [] };
}
