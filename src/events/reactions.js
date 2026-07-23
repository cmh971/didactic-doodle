// Reaction events → reaction roles + starboard.
import { handleReactionRole } from '../features/reactionRoles.js';
import { handleStar, handleStarRemove } from '../features/starboard.js';

export async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});
  await handleReactionRole(reaction, user, true).catch(() => {});
  await handleStar(reaction).catch(() => {});
}

export async function handleReactionRemove(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});
  await handleReactionRole(reaction, user, false).catch(() => {});
  await handleStarRemove(reaction).catch(() => {});
}
