// Prefix (!) alias for the /setup wizard.
//   !setup [page]        → configure THIS server (needs Manage Server)
//   !setup <guildId>     → OWNER ONLY: remote-configure any server the bot is in
//                          (great for helping people set up). Clicks then edit
//                          that server until you run `!setup done`.
//   !setup done          → OWNER: exit remote mode
import { PermissionFlagsBits } from 'discord.js';
import { renderPanel } from '../setup/ui.js';
import { remoteTargets } from '../setup/interactions.js';

function isOwner(id) {
  const ids = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.includes(id) : id === '1183222250153984040';
}

export async function handleSetupText(message) {
  const raw = (message.content || '').trim();
  if (!/^!setup\b/i.test(raw)) return false;
  const arg = raw.split(/\s+/)[1] || '';
  const owner = isOwner(message.author.id);

  // ---- OWNER: remote setup of another server by ID ----
  if (owner && /^\d{17,20}$/.test(arg)) {
    const target = message.client.guilds.cache.get(arg);
    if (!target) { await message.reply(`❌ I'm not in a server with ID \`${arg}\`.`).catch(() => {}); return true; }
    remoteTargets.set(message.author.id, arg);
    try {
      await message.reply({
        content: `🛠️ **Remote setup:** you're now configuring **${target.name}** (\`${arg}\`). Your setup clicks edit *that* server. Run \`!setup done\` to switch back.`,
        ...renderPanel(message.client, arg, 0),
      });
    } catch (err) { await message.reply('⚠️ Could not open: ' + err.message).catch(() => {}); }
    return true;
  }

  // ---- OWNER: exit remote mode ----
  if (owner && /^(done|exit|stop|local)$/i.test(arg)) {
    remoteTargets.delete(message.author.id);
    await message.reply('✅ Exited remote setup — your setup now edits the current server again.').catch(() => {});
    return true;
  }

  // ---- normal local setup ----
  if (!message.guild) { await message.reply('❌ Use `!setup` inside a server (owners can do `!setup <guildId>` to remote-configure one).').catch(() => {}); return true; }
  if (!owner && !message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply('❌ You need the **Manage Server** permission to open `/setup`.').catch(() => {});
    return true;
  }
  if (owner) remoteTargets.delete(message.author.id); // running local setup exits any remote target
  const page = Math.max(0, (parseInt(arg, 10) || 1) - 1);
  try { await message.reply(renderPanel(message.client, message.guild.id, page)); }
  catch (err) { await message.reply('⚠️ Could not open setup: ' + err.message).catch(() => {}); }
  return true;
}
