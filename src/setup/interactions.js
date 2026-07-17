//ure JavaScript (ES Modules) — No TypeScript compilers required.
import {
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { renderPanel } from './ui.js';
import {
  getCfg, setSetting, setNested, setLanguage, toggleModule, 
  addAutorole, removeAutorole, setRoleList, resetGuild,
} from './store.js';
import { setModule } from '../systems/guilds.js';
import { planSetup, SETUP_KEYS } from '../ai/gemini.js';
import { handleTicketAction, handleTicketModalSubmit } from './ticketStudio.js';

// --- CONFIGURATION ENGINE & SCHEMA BOUNDARIES ---
const ALLOWED = new Set(SETUP_KEYS);
const pendingUnknown = new Map(); // `${guild}:${user}` -> [{text, label}]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const progressBar = (done, total) => {
  const pct = Math.round((done / Math.max(total, 1)) * 100);
  const filled = Math.round((done / Math.max(total, 1)) * 12);
  return `\`${'▰'.repeat(filled)}${'▱'.repeat(12 - filled)}\` ${pct}%`;
};

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

// --- EXPANDED DICTIONARY FOR HIGH-TIER SETUPS (50+ PAGES READY) ---
export const METADATA = {
  // Identity Settings
  'identity.name': { label: 'Bot Username', max: 32, style: TextInputStyle.Short, required: true },
  'identity.avatar': { label: 'Avatar Image URL', max: 500, style: TextInputStyle.Short, required: true },
  'identity.nick': { label: 'Server Nickname', max: 32, style: TextInputStyle.Short, required: false },
  
  // Messaging Engine — keys match the customIds emitted by ui.js (settings.<key>).
  'levelUpMessage': { label: 'Level Up Notification ({user}, {level})', max: 200, style: TextInputStyle.Paragraph, required: true },
  'welcomeMessage': { label: 'Welcome Portal Banner Text ({user}, {server})', max: 400, style: TextInputStyle.Paragraph, required: true },
  'goodbyeMessage': { label: 'Goodbye Notification ({user})', max: 200, style: TextInputStyle.Paragraph, required: true },

  // Advanced Economy Matrix — currency name/emoji live at settings.<key> (no dot).
  'currencyName': { label: 'Local Currency Name', max: 30, style: TextInputStyle.Short, required: true },
  'currencyEmoji': { label: 'Local Currency Emoji', max: 30, style: TextInputStyle.Short, required: true },
  'economy.startingBalance': { label: 'Starting Ledger Balance', max: 10, style: TextInputStyle.Short, required: true, numeric: true },
  'economy.dailyAmount': { label: 'Daily Work Reward', max: 10, style: TextInputStyle.Short, required: true, numeric: true },
  'economy.weeklyBonus': { label: 'Weekly Streak Reward', max: 10, style: TextInputStyle.Short, required: true, numeric: true },

  // AI assistant fields
  'ai.personality': { label: 'AI Personality / System Prompt', max: 500, style: TextInputStyle.Paragraph, required: false },
  'ai.maxTokens': { label: 'Max Tokens Per Reply', max: 5, style: TextInputStyle.Short, required: true, numeric: true },

  // Community fields
  'community.rulesMessageId': { label: 'Pinned Rules Message ID', max: 25, style: TextInputStyle.Short, required: false },
  
  // Bulletproof Automod Values
  'automod.maxMentions': { label: 'Mention Spike Ceiling (Count)', max: 3, style: TextInputStyle.Short, required: true, numeric: true },
  'automod.maxLines': { label: 'Max Message Lines (Spam Prevention)', max: 3, style: TextInputStyle.Short, required: true, numeric: true },
  'automod.warnThreshold': { label: 'Warnings Until Structural Kick/Mute', max: 2, style: TextInputStyle.Short, required: true, numeric: true },
  
  // Ticketing System Matrix
  'tickets.maxOpen': { label: 'Max Open Tickets Concurrent Per User', max: 2, style: TextInputStyle.Short, required: true, numeric: true },
  'tickets.welcomeMessage': { label: 'Ticket Initialization Message', max: 500, style: TextInputStyle.Paragraph, required: true }
};

// --- CORE UTILITIES ---
function fetchStateValue(key, cfg, client) {
  if (key.startsWith('identity.')) {
    const guild = client.guilds.cache.get(cfg.guildId);
    if (key === 'identity.name') return client.user.username;
    if (key === 'identity.avatar') return '';
    if (key === 'identity.nick') return guild?.members?.me?.nickname || '';
  }
  
  const segments = key.split('.');
  if (segments.length === 2) {
    return String(cfg.settings[segments[0]]?.[segments[1]] ?? '');
  }
  return String(cfg.settings[key] ?? '');
}

async function runAiPlan(interaction) {
  const request = interaction.fields.getTextInputValue('value');
  await interaction.deferUpdate();
  const guildId = interaction.guildId;

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🤖 AI Automated Construction Engine')
        .setDescription(`Analysing parameters and compiling structural requests...\n${progressBar(0, 1)}`)
    ],
    components: [],
  });

  const plan = await planSetup(request);
  const actions = (plan.actions || []).filter((a) => ALLOWED.has(a.key));
  const total = Math.max(actions.length, 1);
  const applied = [];

  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    const chunks = act.key.split('.');
    
    try {
      if (act.key.startsWith('module.')) {
        setModule(guildId, chunks[1], Boolean(act.value));
      } else if (act.key === 'language') {
        setLanguage(guildId, String(act.value));
      } else if (chunks.length === 2) {
        const isBool = typeof act.value === 'boolean' || act.value === 'true' || act.value === 'false';
        const parsedVal = isBool ? Boolean(act.value) : (String(act.value).replace(/[^0-9]/g, '') ? parseInt(String(act.value).replace(/[^0-9]/g, ''), 10) : String(act.value));
        setNested(guildId, chunks[0], chunks[1], parsedVal);
      } else {
        setSetting(guildId, act.key, String(act.value));
      }
      applied.push(act.label || act.key);
    } catch (err) {
      console.error(`Failed AI modification step for key ${act.key}:`, err);
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🤖 AI Deployment Matrix')
          .setDescription(`${progressBar(i + 1, total)}\n\n✅ ${applied.map(x => `\`${x}\``).join('\n✅ ') || 'Parsing modifications...'}`)
      ],
      components: [],
    });
    await sleep(250);
  }

  const unknown = plan.unknown || [];
  const reportEmbed = new EmbedBuilder()
    .setColor(applied.length ? 0x2ecc71 : 0xe67e22)
    .setTitle('🤖 Deployment Sequence Concluded')
    .setDescription(
      `${progressBar(1, 1)}\n\n**Successfully Handled Variables (${applied.length}):**\n${applied.length ? '✅ ' + applied.map(x => `\`${x}\``).join('\n✅ ') : '*No matching attributes could be mapped.*'}` +
      (unknown.length ? `\n\n**Unmapped Variables / Custom Requests (${unknown.length}):**\n• ${unknown.map((u) => `\`${u.label || u.text}\``).join('\n• ')}` : '')
    );

  const actionRows = [];
  if (unknown.length) {
    pendingUnknown.set(`${guildId}:${interaction.user.id}`, unknown);
    reportEmbed.setFooter({ text: 'Some fields require specialized setups. Opt to skip or save as pipeline tasks.' });
    actionRows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:aiignore').setLabel('Discard Extraneous').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setup:aicustom').setLabel('Store to Custom Feature Pipeline').setEmoji('🛠️').setStyle(ButtonStyle.Primary),
      )
    );
  }
  
  actionRows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:home').setLabel('Return to Terminal Hub').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
    )
  );

  await interaction.editReply({ embeds: [reportEmbed], components: actionRows });
}

// --- MODAL ENGINE CONSTRUCTORS ---
function buildDynamicModal(key, page, cfg, client) {
  const meta = METADATA[key];
  if (!meta) throw new Error(`Schema mismatch inside setup dynamic mapping configuration for: ${key}`);

  const textInput = new TextInputBuilder()
    .setCustomId('value')
    .setLabel(meta.label.slice(0, 45))
    .setStyle(meta.style)
    .setMaxLength(meta.max)
    .setRequired(meta.required);

  const rawValue = fetchStateValue(key, cfg, client);
  if (rawValue) textInput.setValue(rawValue.slice(0, meta.max));

  return new ModalBuilder()
    .setCustomId(`setup:msub:${key}:${page}`)
    .setTitle(meta.label.slice(0, 45))
    .addComponents(new ActionRowBuilder().addComponents(textInput));
}

// --- MAIN DISPATCH HANDLER ROUTER ---
export async function handleSetup(interaction) {
  const customId = interaction.customId;
  if (!customId || !customId.startsWith('setup:')) return false;

  // Global Access Control Validation
  if (!interaction.inGuild()) {
    await interaction.reply(eph('❌ Interface execution rejected. Panels must be built inside a Server Environment.')).catch(() => {});
    return true;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply(eph('❌ Access Denied. Execution requires: `MANAGE_GUILD` permission.')).catch(() => {});
    return true;
  }

  const guildId = interaction.guildId;
  const client = interaction.client;
  const guild = interaction.guild;

  // ---- Process Form & Modal Responses ----
  if (interaction.isModalSubmit()) {
    const [, , targetKey, fallbackPageStr] = customId.split(':');
    const targetPage = Number(fallbackPageStr) || 0;

    if (targetKey === '__aiplan') {
      await runAiPlan(interaction);
      return true;
    }

    if (targetKey.startsWith('tk_')) {
      await handleTicketModalSubmit(interaction, targetKey, targetPage);
      return true;
    }

    if (targetKey === '__autorole') {
      const level = parseInt(interaction.fields.getTextInputValue('level'), 10);
      const roleId = interaction.fields.getTextInputValue('role').replace(/[^0-9]/g, '');
      if (isNaN(level) || !roleId) {
        await interaction.reply(eph('❌ Auto-tier processing requires an integer level and valid role ID.'));
        return true;
      }
      addAutorole(guildId, level, roleId);
      await interaction.update(renderPanel(client, guildId, targetPage));
      return true;
    }

    if (targetKey === '__reset') {
      const verificationString = interaction.fields.getTextInputValue('confirm');
      if (verificationString.trim().toUpperCase() !== 'RESET') {
        await interaction.reply(eph('⚠️ Global State Reset sequence aborted. Word mismatch.'));
        return true;
      }
      resetGuild(guildId);
      await interaction.update(renderPanel(client, guildId, 0));
      return true;
    }

    // Single Key Structural Saving Routine
    const userValue = interaction.fields.getTextInputValue('value');

    // Identity edits (username/avatar/nick) hit Discord's API and are slow &
    // rate-limited — they can easily blow the 3-second interaction deadline. So
    // acknowledge the interaction FIRST (deferUpdate keeps the token alive ~15m),
    // then do the slow work, then editReply. Local saves stay on the fast path.
    const isSlow = targetKey === 'identity.name' || targetKey === 'identity.avatar' || targetKey === 'identity.nick';
    if (isSlow) await interaction.deferUpdate().catch(() => {});

    try {
      const meta = METADATA[targetKey];
      let cleanedValue = userValue;

      if (meta?.numeric) {
        cleanedValue = Math.max(0, parseInt(userValue.replace(/[^0-9]/g, ''), 10) || 0);
      }

      if (targetKey === 'identity.name') await client.user.setUsername(cleanedValue);
      else if (targetKey === 'identity.avatar') await client.user.setAvatar(cleanedValue);
      else if (targetKey === 'identity.nick') await guild.members.me.setNickname(cleanedValue || null);
      else if (targetKey.includes('.')) {
        const [root, branch] = targetKey.split('.');
        setNested(guildId, root, branch, cleanedValue);
      } else {
        setSetting(guildId, targetKey, cleanedValue);
      }
    } catch (err) {
      const msg = eph(`⚠️ System Modification Failure: Could not write block. Reason: ${err.message}`);
      if (isSlow) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
      return true;
    }

    // Re-render the panel: editReply if we deferred, else a fast update. Both are
    // .catch-guarded so a stale interaction can never crash the handler.
    const panel = renderPanel(client, guildId, targetPage);
    if (isSlow) await interaction.editReply(panel).catch(() => {});
    else await interaction.update(panel).catch(() => {});
    return true;
  }

  // ---- Handle Interactive Menu Components (Buttons & Dropdowns) ----
  const segments = customId.split(':');
  const contextAction = segments[1];

  // Ticket "creative studio" actions live in ticketStudio.js.
  if (contextAction === 'tk') {
    await handleTicketAction(interaction, segments);
    return true;
  }

  switch (contextAction) {
    case 'nav':
    case 'go':
    case 'jump': {
      const routingPage = interaction.isStringSelectMenu() 
        ? Number(interaction.values[0]) 
        : Number(segments[2]);
      await interaction.update(renderPanel(client, guildId, routingPage));
      return true;
    }
    case 'home':
    case 'refresh': {
      await interaction.update(renderPanel(client, guildId, 0));
      return true;
    }
    case 'toggle': {
      toggleModule(guildId, segments[2]);
      await interaction.update(renderPanel(client, guildId, Number(segments[3])));
      return true;
    }
    case 'amtog': {
      const currentAutomodConfig = getCfg(guildId).settings.automod || {};
      setNested(guildId, 'automod', segments[2], !currentAutomodConfig[segments[2]]);
      await interaction.update(renderPanel(client, guildId, Number(segments[3])));
      return true;
    }
    case 'safety': {
      const current = getCfg(guildId).settings.safety || {};
      setNested(guildId, 'safety', segments[2], !current[segments[2]]);
      await interaction.update(renderPanel(client, guildId, Number(segments[3])));
      return true;
    }
    case 'community': {
      const current = getCfg(guildId).settings.community || {};
      setNested(guildId, 'community', segments[2], !current[segments[2]]);
      await interaction.update(renderPanel(client, guildId, Number(segments[3])));
      return true;
    }
    case 'identity': {
      // Currently only the "Clear Nickname" action lives here.
      if (segments[2] === 'resetnick') {
        await guild.members.me.setNickname(null).catch(() => {});
      }
      await interaction.update(renderPanel(client, guildId, Number(segments[3])));
      return true;
    }
    case 'lang': {
      setLanguage(guildId, interaction.values[0]);
      await interaction.update(renderPanel(client, guildId, Number(segments[2])));
      return true;
    }
    case 'chan': {
      const keyPath = segments[2];
      const selectedChannel = interaction.values[0] || null;
      if (keyPath.includes('.')) {
        const [root, branch] = keyPath.split('.');
        setNested(guildId, root, branch, selectedChannel);
      } else {
        setSetting(guildId, keyPath, selectedChannel);
      }
      await interaction.update(renderPanel(client, guildId, Number(segments[3])));
      return true;
    }
    case 'role': {
      setRoleList(guildId, segments[2], interaction.values || []);
      await interaction.update(renderPanel(client, guildId, Number(segments[3])));
      return true;
    }
    case 'ardel': {
      removeAutorole(guildId, interaction.values[0]);
      await interaction.update(renderPanel(client, guildId, Number(segments[2])));
      return true;
    }
    case 'ai': {
      // AI-page toggle button: setup:ai:<key>:<page>. Bare "setup:ai" (from the
      // overview) has no extra segments and opens the auto-config modal instead.
      if (segments.length >= 4) {
        const current = getCfg(guildId).settings.ai || {};
        setNested(guildId, 'ai', segments[2], !current[segments[2]]);
        await interaction.update(renderPanel(client, guildId, Number(segments[3])));
        return true;
      }
      const aiPromptModal = new ModalBuilder()
        .setCustomId('setup:msub:__aiplan:0')
        .setTitle('AI Environment Architect')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('value')
              .setLabel('Describe server rules and operations')
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(400)
              .setRequired(true)
              .setPlaceholder('e.g., Turn on verification logs, lock down invites, map base currency to Credits.')
          )
        );
      await interaction.showModal(aiPromptModal);
      return true;
    }
    case 'aicustom': {
      const mapHash = `${guildId}:${interaction.user.id}`;
      const queuedItems = pendingUnknown.get(mapHash) || [];
      const currentConfig = getCfg(guildId);
      const pipeline = currentConfig.settings.customRequests || [];

      for (const item of queuedItems) {
        pipeline.push({ text: item.text || item.label, at: Date.now(), by: interaction.user.id });
      }

      setSetting(guildId, 'customRequests', pipeline);
      pendingUnknown.delete(mapHash);

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🛠️ Pipeline Matrix Appended')
            .setDescription(`Saved **${queuedItems.length}** feature requests to your workspace backlog.`)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup:home').setLabel('Return to Core Menu').setEmoji('🏠').setStyle(ButtonStyle.Secondary)
          )
        ]
      });
      return true;
    }
    case 'aiignore': {
      pendingUnknown.delete(`${guildId}:${interaction.user.id}`);
      await interaction.update(renderPanel(client, guildId, 0));
      return true;
    }
    case 'modal': {
      const targetFieldKey = segments[2];
      const returnPageId = Number(segments[3]);
      const activeConfig = getCfg(guildId);

      let structuralModal;
      if (targetFieldKey === '__autorole') {
        structuralModal = new ModalBuilder()
          .setCustomId(`setup:msub:__autorole:${returnPageId}`)
          .setTitle('Add Tier Progression Milestone')
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('level').setLabel('Required Level').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role').setLabel('Target Role Snowflake ID').setStyle(TextInputStyle.Short).setRequired(true))
          );
      } else if (targetFieldKey === '__reset') {
        structuralModal = new ModalBuilder()
          .setCustomId(`setup:msub:__reset:${returnPageId}`)
          .setTitle('Purge Configuration Cache?')
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm').setLabel('Type RESET to flush configurations').setStyle(TextInputStyle.Short).setRequired(true))
          );
      } else if (METADATA[targetFieldKey]) {
        structuralModal = buildDynamicModal(targetFieldKey, returnPageId, activeConfig, client);
      } else {
        return true;
      }

      await interaction.showModal(structuralModal);
      return true;
    }
    default: {
      await interaction.update(renderPanel(client, guildId, 0));
      return true;
    }
  }
}