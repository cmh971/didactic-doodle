// Awards/deducts UNO tokens when a game finishes. Idempotent (uses game.settled).
import { addWallet, recordWin, recordLoss } from './store.js';
import { WIN_REWARD, LOSS_PENALTY, TOKEN } from '../config.js';

export function settleGame(game) {
  if (!game || game.settled || !game.winnerId) return null;
  game.settled = true;

  addWallet(game.winnerId, WIN_REWARD);
  recordWin(game.winnerId);

  for (const p of game.players) {
    if (p.id === game.winnerId) continue;
    addWallet(p.id, -LOSS_PENALTY);
    recordLoss(p.id);
  }

  const winner = game.players.find((p) => p.id === game.winnerId);
  const winnerName = winner?.username || 'The winner';
  return (
    `\n💰 **${winnerName}** won **${TOKEN} ${WIN_REWARD.toLocaleString()}**! ` +
    `Everyone else lost **${TOKEN} ${LOSS_PENALTY.toLocaleString()}**.`
  );
}
