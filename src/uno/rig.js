// Owner-only UNO "rig" panel. DM the bot `rig` to open a private control panel
// for whatever UNO game you're in — stack your hand, cut down to one card, or
// steal the turn. Gated strictly to the bot owner (OWNER_IDS env).
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { gameManager } from './GameManager.js';
import { cardLabel } from './Deck.js';

const FALLBACK_OWNER = '1183222250153984040';
export function isOwner(userId) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(userId) : userId === FALLBACK_OWNER;
}

// Find the first active game the owner is a player in.
function findOwnerGame(userId) {
  for (const game of gameManager.games.values()) {
    if (game.getPlayer && game.getPlayer(userId)) return game;
  }
  return null;
}

function buildPanel(game, userId) {
  const me = game.getPlayer(userId);
  const top = game.topCard ? cardLabel(game.face(game.topCard)) : '—';
  const turn = game.currentPlayer ? game.currentPlayer.username : '—';
  const mine = game.currentPlayer && game.currentPlayer.id === userId;

  const embed = new EmbedBuilder()
    .setColor(0xffd23f)
    .setTitle('🎛️ UNO Rig Panel — Owner')
    .setDescription(
      `**Channel:** <#${game.channelId}>\n` +
      `**Started:** ${game.started ? 'yes' : 'not yet'}\n` +
      `**Your cards:** ${me ? me.hand.length : '—'}\n` +
      `**Top card:** ${top}\n` +
      `**Current color:** ${game.currentColor || '—'}\n` +
      `**Turn:** ${turn}${mine ? ' ← **YOU**' : ''}`,
    )
    .setFooter({ text: 'Only you can see this. Effects show in-channel next time your hand renders. 😏' });

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rig:draw1').setLabel('Draw 1').setEmoji('🃏').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rig:wild4').setLabel('Give me a Wild+4').setEmoji('🌈').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rig:setone').setLabel('Down to 1 card').setEmoji('🧹').setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rig:myturn').setLabel('Make it my turn').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rig:refresh').setLabel('Refresh').setEmoji('♻️').setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embeds: [embed], components: rows };
}

// DM entrypoint: owner typed "rig".
export async function openRigPanel(message) {
  if (!isOwner(message.author.id)) return false;
  const game = findOwnerGame(message.author.id);
  if (!game) { await message.reply('🃏 You’re not in any active UNO game right now. Join one (`/uno`), then DM me `rig`.').catch(() => {}); return true; }
  await message.reply(buildPanel(game, message.author.id)).catch(() => {});
  return true;
}

// Button handler (registered under the `rig:` prefix).
export async function handleRigButton(interaction) {
  const cid = interaction.customId;
  if (!cid || !cid.startsWith('rig:')) return false;
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: '🔒 Owner only.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  const action = cid.split(':')[1];
  const game = findOwnerGame(interaction.user.id);
  if (!game) {
    await interaction.update({ content: '🃏 That game has ended.', embeds: [], components: [] }).catch(() => {});
    return true;
  }
  const me = game.getPlayer(interaction.user.id);

  try {
    if (action === 'draw1') {
      if (!game.started) { /* nothing to draw */ }
      else { const [c] = game.draw(1); if (c) me.hand.push(c); }
    } else if (action === 'wild4') {
      me.hand.push({ color: 'wild', value: 'wild4' });
    } else if (action === 'setone') {
      const playable = game.playableIndexes(me).map((x) => x.i);
      if (playable.length) me.hand = [me.hand[playable[0]]];
      else me.hand = [{ color: 'wild', value: 'wild4' }]; // guaranteed-playable single card
    } else if (action === 'myturn') {
      const idx = game.players.findIndex((p) => p.id === interaction.user.id);
      if (idx !== -1) { game.currentIndex = idx; game.drawnThisTurn = false; }
    }
    game.lastActive = Date.now();
  } catch { /* keep the panel alive no matter what */ }

  await interaction.update(buildPanel(game, interaction.user.id)).catch(() => {});
  return true;
}
