import { shuffle } from './Deck.js';

// ============================================================================
// Game modes and house rules — the "all versions of UNO" config.
// A mode picks the deck; house rules are toggles layered on top of any mode.
// ============================================================================

export const MODES = [
  { id: 'classic', label: 'Classic UNO', emoji: '🎴', description: 'The standard 108-card game.' },
  { id: 'nomercy', label: 'UNO No Mercy', emoji: '💀', description: 'Brutal cards (Draw 6/10, Skip Everyone), stacking, out at 25 cards.' },
  { id: 'flip', label: 'UNO Flip', emoji: '🔃', description: 'Double-sided cards. Flip toggles the whole game to the nasty Dark side.' },
  { id: 'allwild', label: 'UNO All Wild', emoji: '🌈', description: 'Every card is wild — play anything, chaos guaranteed.' },
];

export const HOUSE_RULES = [
  { id: 'stacking', label: 'Stacking', emoji: '📚', description: 'Stack Draw cards instead of drawing (forced on in No Mercy).' },
  { id: 'seven_o', label: 'Seven-O', emoji: '🔁', description: 'Play a 7 to swap hands with someone; play a 0 to rotate all hands.' },
  { id: 'draw_to_match', label: 'Draw to Match', emoji: '🃏', description: 'Keep drawing until you get a playable card.' },
  { id: 'force_play', label: 'Force Play', emoji: '⚡', description: 'If you can play, you must — no drawing/passing.' },
];

// Colors per side.
export const LIGHT_COLORS = ['red', 'yellow', 'green', 'blue'];
export const DARK_COLORS = ['pink', 'teal', 'orange', 'purple'];
export const ALL_COLORS = [...LIGHT_COLORS, ...DARK_COLORS];

// How many cards each "draw" value forces.
export const DRAW_AMOUNT = {
  draw1: 1, draw2: 2, draw4: 4, draw5: 5, draw6: 6, draw10: 10,
  wild2: 2, wild4: 4, wild6: 6, wild10: 10,
};

export const DRAW_VALUES = new Set(Object.keys(DRAW_AMOUNT));
// Wild values that require the player to choose a color.
export const WILD_VALUES = new Set(['wild', 'wild2', 'wild4', 'wild6', 'wild10', 'wildcolor']);

export function isDrawValue(v) { return DRAW_VALUES.has(v); }
export function isWildValue(v) { return WILD_VALUES.has(v); }

// ---- Deck builders ------------------------------------------------------

function classicDeck() {
  const deck = [];
  for (const color of LIGHT_COLORS) {
    deck.push({ color, value: '0' });
    for (let n = 1; n <= 9; n++) {
      deck.push({ color, value: String(n) }, { color, value: String(n) });
    }
    for (const v of ['skip', 'reverse', 'draw2']) {
      deck.push({ color, value: v }, { color, value: v });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild' });
    deck.push({ color: 'wild', value: 'wild4' });
  }
  return deck;
}

function noMercyDeck() {
  const deck = [];
  for (const color of LIGHT_COLORS) {
    deck.push({ color, value: '0' });
    for (let n = 1; n <= 9; n++) {
      deck.push({ color, value: String(n) }, { color, value: String(n) });
    }
    // Action cards (No Mercy has colored Draw 4 & Draw 6, plus Skip Everyone & Discard All)
    for (const v of ['skip', 'reverse', 'draw2']) {
      deck.push({ color, value: v }, { color, value: v });
    }
    deck.push({ color, value: 'draw4' });
    deck.push({ color, value: 'draw6' });
    deck.push({ color, value: 'skipall' });
    deck.push({ color, value: 'discardall' });
  }
  for (let i = 0; i < 4; i++) deck.push({ color: 'wild', value: 'wild' });
  for (let i = 0; i < 4; i++) deck.push({ color: 'wild', value: 'wild4' });
  for (let i = 0; i < 3; i++) deck.push({ color: 'wild', value: 'wild6' });
  for (let i = 0; i < 2; i++) deck.push({ color: 'wild', value: 'wild10' });
  for (let i = 0; i < 3; i++) deck.push({ color: 'wild', value: 'wildcolor' });
  return deck;
}

function allWildDeck() {
  const deck = [];
  const pool = [
    ['wild', 18],
    ['wild2', 10],
    ['wild4', 8],
    ['wildskip', 8],
    ['wildreverse', 8],
  ];
  for (const [value, count] of pool) {
    for (let i = 0; i < count; i++) deck.push({ color: 'wild', value });
  }
  return deck;
}

// Flip: each card has a light face and a dark face. faceOf() in Game picks one.
function flipDeck() {
  const light = [];
  for (const color of LIGHT_COLORS) {
    for (let n = 1; n <= 9; n++) light.push({ color, value: String(n) }, { color, value: String(n) });
    for (const v of ['skip', 'reverse', 'draw1', 'flip']) light.push({ color, value: v }, { color, value: v });
  }
  for (let i = 0; i < 8; i++) light.push({ color: 'wild', value: 'wild' });
  for (let i = 0; i < 8; i++) light.push({ color: 'wild', value: 'wild2' });

  const dark = [];
  for (const color of DARK_COLORS) {
    for (let n = 1; n <= 9; n++) dark.push({ color, value: String(n) }, { color, value: String(n) });
    for (const v of ['skipall', 'reverse', 'draw5', 'flip']) dark.push({ color, value: v }, { color, value: v });
  }
  for (let i = 0; i < 8; i++) dark.push({ color: 'wild', value: 'wild' });
  for (let i = 0; i < 8; i++) dark.push({ color: 'wild', value: 'wildcolor' });

  // Pair light & dark faces into double-sided cards.
  shuffle(light);
  shuffle(dark);
  const n = Math.min(light.length, dark.length);
  const deck = [];
  for (let i = 0; i < n; i++) deck.push({ light: light[i], dark: dark[i] });
  return deck;
}

export function buildDeckForMode(mode) {
  switch (mode) {
    case 'nomercy': return noMercyDeck();
    case 'allwild': return allWildDeck();
    case 'flip': return flipDeck();
    default: return classicDeck();
  }
}
