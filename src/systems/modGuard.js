import { PermissionFlagsBits } from 'discord.js';

// Shared target-protection for destructive moderation commands (ban/kick/etc).
//
// WHY THIS EXISTS: the bot performs the punishment, and the bot's own role sits
// above members, so Discord's role hierarchy does NOT stop a moderator from
// punishing someone above them — including the server owner. We enforce the
// hierarchy ourselves here. This is the fix for the bug that let a mod with Ban
// permission ban the server owner.
//
// Returns a user-facing error string if the action must be blocked, or null if
// it's allowed.

// ---- Shared role-assignment guard (promote / /role / staff ranks) ----------
// Stops privilege escalation: nobody can grant/remove a role at or above their
// OWN highest role, or manage someone who already outranks them. Owner + admins
// bypass. Also blocks @everyone/managed roles and roles above the bot.
export function guardRoleAssign({ guild, invokerMember, targetMember, role }) {
  if (!role) return null;
  if (role.id === guild.id) return '⚠️ That’s the @everyone role — it can’t be assigned.';
  if (role.managed) return '⚠️ That role is managed by an integration and can’t be assigned by hand.';
  const me = guild.members.me;
  if (me && role.position >= me.roles.highest.position) return '⚠️ That role is above my highest role — move my role up first.';

  const isOwner = invokerMember?.id === guild.ownerId;
  const isAdmin = invokerMember?.permissions?.has(PermissionFlagsBits.Administrator);
  if (isOwner || isAdmin) return null;

  if (role.position >= invokerMember.roles.highest.position) return `🛡️ You can’t assign **${role.name}** — it’s at or above your own highest role.`;
  if (targetMember && targetMember.id !== invokerMember.id && targetMember.roles.highest.position >= invokerMember.roles.highest.position) {
    return '🛡️ You can’t manage roles for someone ranked equal to or above you.';
  }
  return null;
}

export async function guardTarget(interaction, targetId) {
  const guild = interaction.guild;
  if (!guild) return 'This command only works in a server.';

  if (targetId === guild.ownerId) return '🛡️ You can’t moderate the **server owner**.';
  if (targetId === interaction.user.id) return '🙃 You can’t moderate yourself.';
  if (targetId === interaction.client.user.id) return '🤖 You can’t moderate me.';

  // The server owner can always act on anyone below them (which is everyone).
  const invokerIsOwner = interaction.user.id === guild.ownerId;
  if (invokerIsOwner) return null;

  const invoker = interaction.member
    ?? await guild.members.fetch(interaction.user.id).catch(() => null);
  const target = await guild.members.fetch(targetId).catch(() => null);

  // Target not in the guild (e.g. banning by ID someone who already left) — no
  // role to compare, so allow it. Owner/self/bot were already handled above.
  if (!target) return null;
  if (!invoker) return '❌ Could not verify your roles — action blocked.';

  if (target.roles.highest.position >= invoker.roles.highest.position) {
    return '🛡️ You can’t moderate someone with an equal or higher role than you.';
  }

  // Also respect the bot's own hierarchy so we fail loud instead of Discord 403ing.
  const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  if (me && target.roles.highest.position >= me.roles.highest.position) {
    return '⚠️ I can’t moderate that member — their role is above mine.';
  }

  return null;
}
