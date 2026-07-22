// Command registry / router.
//
// Discord caps an app at 100 TOP-LEVEL slash commands. We have 200 commands, so
// we register the 79 "primary" commands as their own top-level commands and pack
// the ~121 generated extras into a few category "hub" commands as SUBCOMMANDS
// (e.g. /tool uppercase, /fun dadjoke, /eco fish). Everything stays reachable and
// well under the 100-command ceiling.

// The primary commands that keep their own top-level slash command.
const PRIMARY = new Set([
  // core
  'ping', 'botinfo', 'say', 'embed', 'avatar', 'banner', 'servericon', 'userinfo', 'serverinfo', 'membercount', 'roleinfo', 'channelinfo', 'timestamp',
  // economy
  // (networth, iteminfo, deposit, withdraw demoted to the /eco hub to free top-level slots)
  'balance', 'leaderboard', 'daily', 'weekly', 'work', 'beg', 'crime', 'rob', 'pay', 'shop', 'buy', 'sell', 'use', 'inventory', 'additem', 'gamble', 'slots', 'coinflip', 'dice', 'blackjack', 'roulette', 'lottery', 'guess',
  // (ship demoted to the /eco hub to make room for /verify)
  // moderation (classics stay top-level; power tools go to the /mod hub).
  // NOTE: commands that define their OWN subcommands (reactionrole, giveaway, uno)
  // MUST stay top-level — Discord can't nest subcommands under a hub subcommand.
  // NOTE: /warnings was demoted to the `mod` hub (/mod warnings) to free a slot
  // for /infraction — we're at Discord's 100 top-level cap. /infraction view
  // supersedes it anyway.
  'ban', 'kick', 'timeout', 'unban', 'purge', 'slowmode', 'role', 'nickname', 'warn', 'reactionrole', 'infraction',
  // utility
  'poll', 'calc', 'base64', 'hash', 'password', 'colorpick', 'roll', 'random', 'remindme', 'choose', 'reverse', 'mock', 'owoify', 'clap', 'weather',
  // gamification
  'uno', 'giveaway', '8ball', 'rps', 'joke', 'fact', 'quote', 'meme', 'rate', 'wouldyourather', 'truthordare', 'compliment', 'roast', 'level',
  // roblox / management (these define subcommands -> must be top-level)
  'link', 'punishments', 'bolo', 'modstats', 'erlc', 'automations',
  // verification (its own top-level command)
  'verify',
]);

// Always keep this whole category top-level even if not in PRIMARY.
const ALWAYS_TOP = new Set(['core']);

// Category -> hub base name used for the extras' subcommands.
const HUB_BASE = { economy: 'eco', gamification: 'fun', utility: 'tool', core: 'core', moderation: 'mod', roblox: 'rbx', extra: 'extra' };

const MAX_SUBCOMMANDS = 25;

// Built once at startup.
let routes = new Map(); // parentName -> Map(subName -> module)

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Build the REST registration body + the runtime routing table.
export function prepare(commands) {
  routes = new Map();
  const body = [];
  const extrasByCat = {};

  for (const cmd of commands.values()) {
    const isPrimary = PRIMARY.has(cmd.data.name) || ALWAYS_TOP.has(cmd.category);
    if (isPrimary) {
      body.push(cmd.data.toJSON());
    } else {
      (extrasByCat[cmd.category] ??= []).push(cmd);
    }
  }

  // Pack extras into hub commands (≤25 subcommands each).
  for (const [cat, cmds] of Object.entries(extrasByCat)) {
    const base = HUB_BASE[cat] || cat;
    const groups = chunk(cmds, MAX_SUBCOMMANDS);
    groups.forEach((group, gi) => {
      const parentName = gi === 0 ? base : `${base}${gi + 1}`;
      const subMap = new Map();
      const subcommands = group.map((cmd) => {
        const j = cmd.data.toJSON();
        subMap.set(j.name, cmd);
        const opts = j.options || [];
        const description = (j.description || 'No description').slice(0, 100);

        // A command that defines its OWN subcommands can't be nested as a plain
        // subcommand (that would be hub → sub → sub, which Discord rejects with
        // UNION_TYPE_CHOICES). Nest it as a subcommand GROUP instead, so its
        // subcommands land at the legal middle level: hub → group → sub → options.
        if (opts.some((o) => o.type === 1)) {
          // Groups may only contain subcommands. If the command itself uses
          // subcommand groups it'd need a 4th level — that can't be packed at all.
          if (opts.some((o) => o.type === 2)) {
            throw new Error(`Cannot pack "${j.name}" into hub "${parentName}": it uses subcommand groups. Add it to PRIMARY so it stays top-level.`);
          }
          return { type: 2, name: j.name, description, options: opts }; // SUB_COMMAND_GROUP
        }

        return { type: 1, name: j.name, description, options: opts }; // SUB_COMMAND
      });
      body.push({
        name: parentName,
        description: `Extra ${cat} commands (${group.length}) — pick a subcommand`.slice(0, 100),
        options: subcommands,
      });
      routes.set(parentName, subMap);
    });
  }

  return { body, hubCount: routes.size, topLevel: body.length };
}

// Resolve an incoming chat-input interaction to the module that handles it.
export function resolve(interaction, commands) {
  const direct = commands.get(interaction.commandName);
  if (direct) return direct;
  const hub = routes.get(interaction.commandName);
  if (hub) {
    // A packed command is nested either as a subcommand (hub → sub) or, if it has
    // its own subcommands, as a subcommand group (hub → group → sub). Match the
    // group name first so the group wins over any like-named leaf subcommand.
    const grp = interaction.options.getSubcommandGroup(false);
    if (grp && hub.has(grp)) return hub.get(grp);
    const sub = interaction.options.getSubcommand(false);
    if (sub && hub.has(sub)) return hub.get(sub);
  }
  return null;
}
