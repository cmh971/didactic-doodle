// Weighted rarity roller for loot drops.
// Drop rates: Common 70%, Uncommon 20%, Rare 8%, Epic 1.5%, Legendary 0.5%.
export const RARITY_WEIGHTS = [
  { rarity: 'common', weight: 70, color: 0x95a5a6, emoji: '⚪' },
  { rarity: 'uncommon', weight: 20, color: 0x2ecc71, emoji: '🟢' },
  { rarity: 'rare', weight: 8, color: 0x3498db, emoji: '🔵' },
  { rarity: 'epic', weight: 1.5, color: 0x9b59b6, emoji: '🟣' },
  { rarity: 'legendary', weight: 0.5, color: 0xf1c40f, emoji: '🟡' },
];

const TOTAL = RARITY_WEIGHTS.reduce((s, r) => s + r.weight, 0);

export function rollRarity() {
  let roll = Math.random() * TOTAL;
  for (const r of RARITY_WEIGHTS) {
    if (roll < r.weight) return r;
    roll -= r.weight;
  }
  return RARITY_WEIGHTS[0];
}

export function rarityMeta(name) {
  return RARITY_WEIGHTS.find((r) => r.rarity === name) || RARITY_WEIGHTS[0];
}
