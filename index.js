// Entry point: loads env + all commands, registers them, wires events, logs in.
import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, GatewayIntentBits, Partials, Collection, REST, Routes, Events, ActivityType } from 'discord.js';
import { handleComponent } from './src/interactions.js';
import { handleDM } from './src/dmHandler.js';
import { handleGuildMessage } from './src/events/messageCreate.js';
import { handleSetup } from './src/setup/interactions.js';
import { handleInfraction, handleAppeal } from './src/systems/infractions.js';
import { handleCustomComponent } from './src/features/components.js';
import { openRigPanel, handleRigButton, isOwner as isRigOwner } from './src/uno/rig.js';
import { handleFightButton, openFightRig, handleFightRigButton } from './src/features/fight.js';
import { startUnoSpy } from './src/uno/spy.js';
import { handleHelp } from './src/help/ui.js';
import { handleMemberAdd, handleMemberRemove } from './src/events/guildMember.js';
import { handleReactionAdd, handleReactionRemove } from './src/events/reactions.js';
import { handleTicketButton, handleTicketModal, handleDMTicket, relayStaffThreadMessage } from './src/features/tickets.js';
import { handleModButton } from './src/features/aimod.js';
import { handleBadwordBanButton } from './src/systems/badwords.js';
import { enter as giveawayEnter, restoreGiveaways } from './src/features/giveaways.js';
import { handleMessageDelete } from './src/features/snipe.js';
import { prepare, resolve } from './src/handlers/registry.js';
import { moduleEnabled } from './src/systems/guilds.js';
import { track as trackCommand } from './src/systems/usage.js';

// Category -> module name. Commands in these categories are blocked when the
// matching module is toggled OFF in /setup. (core & utility are always on.)
const GATED_CATEGORIES = { economy: 'economy', gamification: 'gamification', moderation: 'moderation' };
import { startWeb } from './src/web/server.js';
import { hookConsole } from './src/web/logbus.js';

hookConsole(); // mirror console output into the dashboard's live log stream

const __dirname = dirname(fileURLToPath(import.meta.url));
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

// Secure configuration whitelist
const OWNER_ID = '1183222250153984040';

if (!DISCORD_TOKEN || DISCORD_TOKEN === 'your-bot-token-here') {
  console.error('❌ DISCORD_TOKEN is missing. Fill it in your .env file.');
  process.exit(1);
}
if (!CLIENT_ID || CLIENT_ID === 'your-application-id-here') {
  console.error('❌ CLIENT_ID is missing. Fill it in your .env file.');
  process.exit(1);
}

// ---- Dynamically load every command in src/commands (recurses category dirs) ----
const commands = new Collection();
const commandsPath = join(__dirname, 'src', 'commands');

function walkJs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJs(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const byCategory = {};
for (const file of walkJs(commandsPath)) {
  const mod = await import(pathToFileURL(file).href);
  if (mod?.data?.name && typeof mod.execute === 'function') {
    const category = basename(dirname(file));
    commands.set(mod.data.name, { ...mod, category });
    (byCategory[category] ??= []).push(mod.data.name);
  } else {
    console.warn(`⚠️ Skipping ${file}: missing "data" or "execute" export.`);
  }
}
console.log(`📦 Loaded ${commands.size} command(s) across ${Object.keys(byCategory).length} categories:`);
for (const [cat, names] of Object.entries(byCategory)) console.log(`   • ${cat} (${names.length})`);

// ---- Register slash commands with Discord ----
const { body, hubCount, topLevel } = prepare(commands);
console.log(`🧩 Registration plan: ${topLevel} top-level commands (${hubCount} hub command(s) holding the extras as subcommands).`);

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  const where = GUILD_ID ? `guild ${GUILD_ID}` : 'globally (can take ~1h)';

  try {
    await rest.put(route, { body });
    console.log(`✅ Registered ${body.length} command(s) ${where}.`);
  } catch (err) {
    console.error('❌ Bulk command registration FAILED:', err?.rawError?.message || err.message);
    if (err?.rawError?.errors) console.error('   details:', JSON.stringify(err.rawError.errors).slice(0, 2000));
    console.log('↪️ Falling back to per-command registration to skip the bad one(s)…');
    await rest.put(route, { body: [] }).catch(() => {}); // clear first
    let ok = 0;
    const failed = [];
    for (const cmd of body) {
      try {
        await rest.post(route, { body: cmd });
        ok++;
      } catch (e) {
        failed.push(cmd.name);
        console.error(`   ⚠️ Skipped /${cmd.name}: ${e?.rawError?.message || e.message}`);
      }
    }
    console.log(`✅ Registered ${ok}/${body.length} ${where}. ${failed.length ? 'Failed: ' + failed.join(', ') : ''}`);
  }
}

// ---- Create client ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

client.commands = commands; // exposed for /help

// Initial baseline status assignment on startup
client.once(Events.ClientReady, (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
  c.user.setActivity('the servers', { type: ActivityType.Watching });
  console.log('📊 Initial baseline status configured to "Watching the servers"!');
  startUnoSpy(c); // live UNO snapshot + bot-say outbox (data/uno-live.json / uno-outbox.json)
});

// Member join / leave handlers
client.on(Events.GuildMemberAdd, (member) => handleMemberAdd(member).catch((e) => console.error('memberAdd:', e.message)));
client.on(Events.GuildMemberRemove, (member) => handleMemberRemove(member).catch((e) => console.error('memberRemove:', e.message)));

// Reaction handling hooks
client.on(Events.MessageReactionAdd, (r, u) => handleReactionAdd(r, u).catch((e) => console.error('reactionAdd:', e.message)));
client.on(Events.MessageReactionRemove, (r, u) => handleReactionRemove(r, u).catch((e) => console.error('reactionRemove:', e.message)));

// Cache deleted messages for /snipe
client.on(Events.MessageDelete, (message) => { try { handleMessageDelete(message); } catch {} });

// Interactive components routes
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = resolve(interaction, commands);
      if (!command) return;
      const mod = GATED_CATEGORIES[command.category];
      if (mod && interaction.inGuild() && !moduleEnabled(interaction.guildId, mod)) {
        await interaction.reply({ content: `🚫 The **${mod}** module is disabled on this server (an admin can re-enable it in \`/setup\`).`, flags: 64 });
        return;
      }
      trackCommand(command.data?.name, { guildId: interaction.guildId, userId: interaction.user.id, source: 'discord' });
      await command.execute(interaction);
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('setup:')) await handleSetup(interaction);
      else if (interaction.customId.startsWith('infraction:')) await handleInfraction(interaction);
      else if (interaction.customId.startsWith('appeal:')) await handleAppeal(interaction);
      else if (interaction.customId.startsWith('ccform:')) await handleCustomComponent(interaction);
      else if (interaction.customId.startsWith('ticket:')) await handleTicketModal(interaction);
    } else if (interaction.isMessageComponent()) {
      const cid = interaction.customId;
      if (cid.startsWith('setup:')) await handleSetup(interaction);
      else if (cid.startsWith('infraction:')) await handleInfraction(interaction);
      else if (cid.startsWith('appeal:')) await handleAppeal(interaction);
      else if (cid.startsWith('rig:')) await handleRigButton(interaction);
      else if (cid.startsWith('fight:')) await handleFightButton(interaction);
      else if (cid.startsWith('frig:')) await handleFightRigButton(interaction);
      else if (cid.startsWith('cc:') || cid.startsWith('ccpage:')) await handleCustomComponent(interaction);
      else if (cid.startsWith('help:')) await handleHelp(interaction);
      else if (cid.startsWith('ticket:')) await handleTicketButton(interaction);
      else if (cid.startsWith('mod:')) await handleModButton(interaction);
      else if (cid.startsWith('bwban:')) await handleBadwordBanButton(interaction);
      else if (cid.startsWith('gw:enter:')) {
        const count = giveawayEnter(Number(cid.split(':')[2]), interaction.user.id);
        await interaction.reply({ content: `🎉 You're entered! (${count} total)`, flags: 64 });
      } else await handleComponent(interaction);
    }
  } catch (err) {
    console.error('Interaction error:', err);
    const msg = { content: '⚠️ Something went wrong handling that action.', flags: 64 };
    if (interaction.deferred || interaction.replied) {
      interaction.followUp(msg).catch(() => {});
    } else {
      interaction.reply(msg).catch(() => {});
    }
  }
});

// Messages and secure owner DM status parser
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.guild) {
      // Relay staff replies typed in a DM-ticket thread back to the member's DMs.
      if (await relayStaffThreadMessage(message)) return;
      await handleGuildMessage(message);
    } else {
      // Check if message is a DM, sent by you, and starts with "!status "
      if (message.author.id === OWNER_ID && message.content.toLowerCase().startsWith('!status ')) {
        const newStatus = message.content.slice(8).trim();
        
        if (!newStatus) {
          await message.reply('❌ Please provide a clear text status string. Example: `!status coding away`');
          return;
        }

        client.user.setActivity(newStatus, { type: ActivityType.Watching });
        await message.reply(`✅ System status updated dynamically to: **Watching ${newStatus}**`);
        console.log(`🔧 Owner updated bot presence status to: "Watching ${newStatus}"`);
        return; 
      }

      // Owner-only rig panels via DM: "rig" (UNO) and "!rigf" (fight).
      if (isRigOwner(message.author.id)) {
        const t = message.content.toLowerCase().trim();
        if (t === 'rig' && await openRigPanel(message)) return;
        if (t === '!rigf' && await openFightRig(message)) return;
      }

      // DM tickets (modmail): open/relay/close. If it handled the DM, stop here
      // so the message isn't also forwarded to the Gemini chat.
      if (await handleDMTicket(message)) return;

      // Default pass-through to Gemini AI coach for regular DMs
      await handleDM(message);
    }
  } catch (err) {
    console.error('Message event processor error:', err);
  }
});

await registerCommands();
await client.login(DISCORD_TOKEN);

// Reschedule any giveaways that were running before a restart.
restoreGiveaways(client);

// Start the web dashboard (unless disabled). Runs in-process, shares the DB.
if (process.env.WEB_ENABLED !== 'false') {
  startWeb(client).catch((err) => console.error('Failed to start dashboard:', err.message));
}