// UNO Deck Engine v5 — Supreme Edition
// • Standard 108-card UNO deck
// • Supports expansions (UNO+, custom wilds, custom draws)
// • Card rarity, power scoring, metadata
// • Seeded shuffle option
// • Rich card labels with emojis
// • Validation + comparison helpers

export const COLORS = ["red", "green", "blue", "yellow"];
export const WILD = "wild";

// Base values for standard UNO
export const STANDARD_VALUES = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "skip", "reverse", "draw2",
];

// Expansion values (UNO+ custom)
export const EXPANSION_VALUES = [
  "draw1", "draw4", "draw5", "draw6", "draw10",
  "skipall", "discardall", "flip",
  "wild", "wild2", "wild4", "wild6", "wild10",
  "wildcolor", "wildskip", "wildreverse",
];

// Rarity tiers for cosmetics / shop items / AI weighting
export const RARITY = {
  common: 1,
  special: 2,
  wild: 3,
  ultra: 4,
};

// Emoji mapping for fun labels
const COLOR_EMOJI = {
  red: "🔴",
  green: "🟢",
  blue: "🔵",
  yellow: "🟡",
  wild: "🌈",
};

const VALUE_NAMES = {
  skip: "Skip",
  reverse: "Reverse",
  draw1: "Draw One",
  draw2: "Draw Two",
  draw4: "Draw Four",
  draw5: "Draw Five",
  draw6: "Draw Six",
  draw10: "Draw Ten",
  skipall: "Skip Everyone",
  discardall: "Discard All",
  flip: "Flip",
  wild: "Wild",
  wild2: "Wild Draw Two",
  wild4: "Wild Draw Four",
  wild6: "Wild Draw Six",
  wild10: "Wild Draw Ten",
  wildcolor: "Wild Color Roulette",
  wildskip: "Wild Skip",
  wildreverse: "Wild Reverse",
};

// Power scoring for AI strategy (higher = stronger)
export function cardPower(face) {
  const v = face.value;

  if (v === "wild") return 50;
  if (v.startsWith("wild")) return 60;
  if (v.startsWith("draw")) return 40;
  if (v === "reverse") return 20;
  if (v === "skip") return 18;

  const num = Number(v);
  if (!isNaN(num)) return num; // numeric cards

  return 10; // fallback
}

// Build standard UNO deck (108 cards)
export function buildStandardDeck() {
  const deck = [];

  for (const color of COLORS) {
    deck.push({ color, value: "0" });

    for (let n = 1; n <= 9; n++) {
      deck.push({ color, value: String(n) });
      deck.push({ color, value: String(n) });
    }

    for (const v of ["skip", "reverse", "draw2"]) {
      deck.push({ color, value: v });
      deck.push({ color, value: v });
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ color: WILD, value: "wild" });
    deck.push({ color: WILD, value: "wild4" });
  }

  return deck;
}

// Build UNO+ deck (standard + expansions)
export function buildExpansionDeck() {
  const deck = buildStandardDeck();

  // Add expansion wilds
  for (let i = 0; i < 2; i++) {
    for (const v of EXPANSION_VALUES) {
      deck.push({ color: WILD, value: v });
    }
  }

  return deck;
}

// Seeded Fisher-Yates shuffle (optional seed)
export function shuffle(deck, seed = null) {
  let random = Math.random;

  if (seed !== null) {
    let s = seed;
    random = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Human-readable card label with emoji
export function cardLabel(face) {
  const value = VALUE_NAMES[face.value] || face.value;
  const emoji = COLOR_EMOJI[face.color] || "❓";

  if (face.color === WILD) return `${emoji} ${value}`;
  const color = face.color.charAt(0).toUpperCase() + face.color.slice(1);
  return `${emoji} ${color} ${value}`;
}

// Validate card structure
export function isValidCard(card) {
  if (!card || typeof card !== "object") return false;
  if (!card.color || !card.value) return false;

  if (card.color !== WILD && !COLORS.includes(card.color)) return false;

  const allValues = [...STANDARD_VALUES, ...EXPANSION_VALUES];
  if (!allValues.includes(card.value)) return false;

  return true;
}

// Compare two cards (for sorting)
export function compareCards(a, b) {
  if (a.color !== b.color) return a.color.localeCompare(b.color);
  return cardPower(b) - cardPower(a);
}

// Get draw power (for AI)
export function drawPower(card) {
  if (card.value.startsWith("draw")) {
    const num = Number(card.value.replace("draw", ""));
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// Check if card is wild
export function isWild(card) {
  return card.color === WILD;
}

// Check if card is action card
export function isAction(card) {
  return ["skip", "reverse", "draw2", "draw4", "draw5", "draw6", "draw10"].includes(card.value);
}
