// Custom interactive components for composed messages (the Announcement Composer).
// Supports: link buttons, role-toggle buttons, curated role select-menus, and
// buttons that pop a form (modal) whose answers post to a channel.
//
// Interactive components are persisted (custom_components table) and referenced by
// a short id in their customId (`cc:<id>` for buttons/menus, `ccform:<id>` for the
// modal a form button opens), so clicks keep working across restarts.
import { randomBytes } from 'node:crypto';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, MessageFlags, PermissionFlagsBits,
} from 'discord.js';
import { getDb } from '../db/index.js';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS custom_components (
  id         TEXT PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  type       TEXT NOT NULL,          -- role | rolemenu | form
  config     TEXT NOT NULL,          -- JSON
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`);
const insertStmt = db.prepare('INSERT INTO custom_components(id, guild_id, type, config) VALUES (?, ?, ?, ?)');
const getStmt = db.prepare('SELECT * FROM custom_components WHERE id = ?');

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
const STYLE = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger };
const newId = () => randomBytes(8).toString('hex');

function store(guildId, type, config) {
  const id = newId();
  insertStmt.run(id, guildId, type, JSON.stringify(config));
  return id;
}
function setEmoji(builder, emoji) { if (emoji) { try { builder.setEmoji(emoji); } catch { /* invalid emoji */ } } }

// Turn the composer's component spec into discord.js rows (persisting interactive
// ones). Buttons pack ≤5 per row; each menu takes its own row; ≤5 rows total.
export function buildMessageComponents(guildId, spec) {
  if (!Array.isArray(spec) || !spec.length) return [];
  const rows = [];
  let btnRow = null;
  const pushButton = (b) => {
    if (!btnRow || btnRow.components.length >= 5) { btnRow = new ActionRowBuilder(); rows.push(btnRow); }
    btnRow.addComponents(b);
  };

  for (const c of spec.slice(0, 25)) {
    if (rows.length >= 5) break;
    const kind = c?.kind;

    if (kind === 'link') {
      if (!/^https?:\/\//i.test(c.url || '')) continue;
      const b = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(String(c.label || 'Link').slice(0, 80)).setURL(c.url);
      setEmoji(b, c.emoji); pushButton(b);
    } else if (kind === 'role') {
      if (!c.roleId) continue;
      const id = store(guildId, 'role', { roleId: String(c.roleId) });
      const b = new ButtonBuilder().setStyle(STYLE[c.style] || ButtonStyle.Secondary).setLabel(String(c.label || 'Role').slice(0, 80)).setCustomId(`cc:${id}`);
      setEmoji(b, c.emoji); pushButton(b);
    } else if (kind === 'form') {
      const questions = (c.questions || []).filter((q) => q && q.label).slice(0, 20)
        .map((q, i) => ({ id: `q${i}`, label: String(q.label).slice(0, 45), paragraph: !!q.paragraph, required: q.required !== false }));
      if (!questions.length) continue;
      const id = store(guildId, 'form', { title: String(c.title || c.label || 'Form').slice(0, 45), channelId: c.channelId || null, resultsChannelId: c.results || null, questions });
      const b = new ButtonBuilder().setStyle(STYLE[c.style] || ButtonStyle.Primary).setLabel(String(c.label || 'Open Form').slice(0, 80)).setCustomId(`cc:${id}`);
      setEmoji(b, c.emoji); pushButton(b);
    } else if (kind === 'rolemenu') {
      const roles = (c.roles || []).filter((r) => r && r.roleId).slice(0, 25);
      if (!roles.length) continue;
      const min = Math.max(0, Number(c.min) || 0);
      const max = Math.min(roles.length, Math.max(1, Number(c.max) || 1));
      const id = store(guildId, 'rolemenu', { roles: roles.map((r) => ({ roleId: String(r.roleId), label: String(r.label || 'Role').slice(0, 100) })) });
      const menu = new StringSelectMenuBuilder().setCustomId(`cc:${id}`).setPlaceholder(String(c.placeholder || 'Select roles…').slice(0, 150))
        .setMinValues(min).setMaxValues(max)
        .addOptions(roles.map((r) => { const o = { label: String(r.label || 'Role').slice(0, 100), value: String(r.roleId) }; if (r.emoji) o.emoji = r.emoji; return o; }));
      rows.push(new ActionRowBuilder().addComponents(menu));
      btnRow = null; // a menu occupies its own row
    }
  }
  return rows.slice(0, 5);
}

// ---- multi-page (paginated) embed panels ----
function pageEmbed(p) {
  const e = new EmbedBuilder();
  if (p.title) e.setTitle(String(p.title).slice(0, 256));
  if (p.description) e.setDescription(String(p.description).slice(0, 4096));
  if (p.footer) e.setFooter({ text: String(p.footer).slice(0, 2048) });
  const hex = /^#?[0-9a-fA-F]{6}$/.test(String(p.color || '')) ? parseInt(String(p.color).replace('#', ''), 16) : 0x5865f2;
  e.setColor(hex);
  if (/^https?:\/\/\S+/i.test(String(p.image || ''))) e.setImage(p.image);
  return e;
}
function pageRow(id, idx, total) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ccpage:${id}:${idx - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(idx <= 0),
    new ButtonBuilder().setCustomId('ccpage:noop:0').setLabel(`Page ${idx + 1}/${total}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId(`ccpage:${id}:${idx + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(idx >= total - 1),
  );
}

// Build a paginated message from ≥2 pages. Returns { embeds, components } or null.
export function buildPagesMessage(guildId, pages) {
  const clean = (pages || []).filter((p) => p && (p.title || p.description || p.image)).slice(0, 20);
  if (clean.length < 2) return null;
  const id = store(guildId, 'pages', { pages: clean });
  return { embeds: [pageEmbed(clean[0])], components: [pageRow(id, 0, clean.length)] };
}

// ---- paginated application forms (Discord modals cap at 5 inputs, so >5
// questions are collected 5-at-a-time across multiple modal "pages") ----
const FORM_PAGE = 5;
const pendingForms = new Map(); // `${userId}:${formId}` -> { answers, at }

function formModal(id, cfg, page) {
  const total = cfg.questions.length;
  const pages = Math.ceil(total / FORM_PAGE);
  const slice = cfg.questions.slice(page * FORM_PAGE, page * FORM_PAGE + FORM_PAGE);
  const title = (pages > 1 ? `${cfg.title} (${page + 1}/${pages})` : cfg.title).slice(0, 45);
  const modal = new ModalBuilder().setCustomId(`ccform:${id}:${page}`).setTitle(title);
  for (const q of slice) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(q.id).setLabel(q.label.slice(0, 45)).setStyle(q.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(q.required !== false).setMaxLength(1000),
    ));
  }
  return modal;
}

// Apply an approve/deny decision: mark the review embed, announce to the results
// channel, and DM the applicant. Shared by the instant Approve and the Deny-reason flow.
async function finalizeDecision({ reviewMsg, approved, reviewerId, reviewerTag, applicantId, title, cfg, guild, client, reason }) {
  if (reviewMsg?.embeds?.[0]) {
    try {
      const e = EmbedBuilder.from(reviewMsg.embeds[0]);
      e.setColor(approved ? 0x2ecc71 : 0xe74c3c);
      e.addFields({ name: approved ? '✅ Approved' : '⛔ Denied', value: `by <@${reviewerId}> • <t:${Math.floor(Date.now() / 1000)}:R>${reason ? `\n**Reason:** ${reason.slice(0, 900)}` : ''}` });
      await reviewMsg.edit({ embeds: [e], components: [] });
    } catch { /* message gone */ }
  }
  const decision = new EmbedBuilder()
    .setColor(approved ? 0x2ecc71 : 0xe74c3c)
    .setTitle(approved ? '✅ Application Accepted' : '⛔ Application Denied')
    .setDescription(`<@${applicantId}>, your **${title}** application was **${approved ? 'ACCEPTED' : 'DENIED'}**.${reason ? `\n\n**Reason:** ${reason.slice(0, 1500)}` : ''}`)
    .setFooter({ text: `Reviewed by ${reviewerTag}` }).setTimestamp();
  const resCh = cfg.resultsChannelId && guild?.channels.cache.get(cfg.resultsChannelId);
  if (resCh?.isTextBased?.()) await resCh.send({ content: `<@${applicantId}>`, embeds: [decision], allowedMentions: { users: [applicantId] } }).catch(() => {});
  try { const u = await client.users.fetch(applicantId); await u.send({ embeds: [decision] }); } catch { /* DMs closed */ }
}

// Route an interaction on a custom component. Returns true if handled.
export async function handleCustomComponent(interaction) {
  const cid = interaction.customId;
  if (!cid) return false;

  // "Continue →" between form pages: open the next modal page.
  if (cid.startsWith('cccont:')) {
    const [, id, pageStr] = cid.split(':');
    const row = getStmt.get(id);
    if (!row) { await interaction.reply(eph('This form is no longer available.')).catch(() => {}); return true; }
    await interaction.showModal(formModal(id, JSON.parse(row.config), Number(pageStr) || 0)).catch(() => {});
    return true;
  }

  // Page navigation for a paginated panel: ccpage:<id>:<targetIndex>
  if (cid.startsWith('ccpage:')) {
    const [, id, idxStr] = cid.split(':');
    if (id === 'noop') { await interaction.deferUpdate().catch(() => {}); return true; }
    const row = getStmt.get(id);
    if (!row) { await interaction.reply(eph('This panel is no longer available.')).catch(() => {}); return true; }
    const cfg = JSON.parse(row.config);
    const idx = Math.max(0, Math.min(cfg.pages.length - 1, Number(idxStr) || 0));
    await interaction.update({ embeds: [pageEmbed(cfg.pages[idx])], components: [pageRow(id, idx, cfg.pages.length)] }).catch(() => {});
    return true;
  }

  // Form modal submit (one page of up to 5 answers) → collect, then continue or post.
  if (cid.startsWith('ccform:') && interaction.isModalSubmit()) {
    const parts = cid.slice(7).split(':');
    const id = parts[0];
    const page = Number(parts[1]) || 0;
    const row = getStmt.get(id);
    if (!row) { await interaction.reply(eph('This form is no longer available.')).catch(() => {}); return true; }
    const cfg = JSON.parse(row.config);

    // Merge this page's answers into the user's in-progress bucket.
    const key = `${interaction.user.id}:${id}`;
    const bucket = pendingForms.get(key) || { answers: {}, at: Date.now() };
    for (const q of cfg.questions.slice(page * FORM_PAGE, page * FORM_PAGE + FORM_PAGE)) bucket.answers[q.id] = field(interaction, q.id);
    bucket.at = Date.now();

    // More questions left → offer a Continue button to open the next page.
    if ((page + 1) * FORM_PAGE < cfg.questions.length) {
      pendingForms.set(key, bucket);
      // prune abandoned in-progress forms (>20 min old)
      for (const [k, v] of pendingForms) if (Date.now() - v.at > 20 * 60_000) pendingForms.delete(k);
      const left = cfg.questions.length - (page + 1) * FORM_PAGE;
      const cont = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cccont:${id}:${page + 1}`).setLabel(`Continue → (${left} more)`).setEmoji('➡️').setStyle(ButtonStyle.Primary));
      await interaction.reply({ ...eph(`✅ Saved part ${page + 1}. **${left}** question(s) to go — tap Continue.`), components: [cont] }).catch(() => {});
      return true;
    }

    // Final page → compile every answer and post. Keep the embed under Discord's
    // 6000-char cap by sizing each field to the number of questions.
    pendingForms.delete(key);
    const perField = Math.min(1024, Math.max(120, Math.floor(5500 / cfg.questions.length)));
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`📝 ${cfg.title}`.slice(0, 256))
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL?.() })
      .addFields(cfg.questions.map((q) => ({ name: q.label.slice(0, 256), value: (bucket.answers[q.id] || '—').slice(0, perField) || '—' })))
      .setFooter({ text: `From ${interaction.user.id}` }).setTimestamp();
    // Staff review buttons — Approve / Deny / Note (applicant id rides in the customId).
    const reviewRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`appdec:${id}:${interaction.user.id}:approve`).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`appdec:${id}:${interaction.user.id}:deny`).setLabel('Deny').setEmoji('⛔').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`appdec:${id}:${interaction.user.id}:note`).setLabel('Note').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    );
    let posted = false;
    const ch = cfg.channelId && interaction.guild?.channels.cache.get(cfg.channelId);
    if (ch?.isTextBased?.()) { await ch.send({ embeds: [embed], components: [reviewRow] }).catch(() => {}); posted = true; }
    await interaction.reply(eph(posted ? '✅ Application submitted — thank you!' : '✅ Submitted! (No destination channel was set, so staff may not see it — tell an admin.)')).catch(() => {});
    return true;
  }

  // ---- application decisions: Approve / Deny / Note ----
  if (cid.startsWith('appdec:')) {
    const [, id, applicantId, action] = cid.split(':');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply(eph('🔒 Only staff (Manage Server) can review applications.')).catch(() => {});
      return true;
    }
    const row = getStmt.get(id);
    const cfg = row ? JSON.parse(row.config) : {};
    const title = cfg.title || 'Application';

    // Note button → modal (carry the review message id so we can edit it on submit).
    if (action === 'note') {
      const modal = new ModalBuilder().setCustomId(`appdec:${id}:${applicantId}:notemodal:${interaction.message.id}`).setTitle('Add a staff note');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('note').setLabel('Note (added to the application)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));
      await interaction.showModal(modal).catch(() => {});
      return true;
    }
    if (action === 'notemodal' && interaction.isModalSubmit()) {
      const note = field(interaction, 'note');
      const msgId = cid.split(':')[4];
      try {
        const msg = await interaction.channel.messages.fetch(msgId);
        const e = EmbedBuilder.from(msg.embeds[0]);
        e.addFields({ name: `📝 Note by ${interaction.user.tag}`, value: note.slice(0, 1024) });
        await msg.edit({ embeds: [e] });
      } catch { /* message gone */ }
      await interaction.reply(eph('📝 Note added.')).catch(() => {});
      return true;
    }

    // Deny → ask for an optional reason first (shown to the applicant).
    if (action === 'deny') {
      const modal = new ModalBuilder().setCustomId(`appdec:${id}:${applicantId}:denyreason:${interaction.message.id}`).setTitle('Deny — reason (optional)');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Reason (shown to the applicant)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)));
      await interaction.showModal(modal).catch(() => {});
      return true;
    }
    if (action === 'denyreason' && interaction.isModalSubmit()) {
      const reason = field(interaction, 'reason');
      let reviewMsg = null;
      try { reviewMsg = await interaction.channel.messages.fetch(cid.split(':')[4]); } catch { /* gone */ }
      await finalizeDecision({ reviewMsg, approved: false, reviewerId: interaction.user.id, reviewerTag: interaction.user.tag, applicantId, title, cfg, guild: interaction.guild, client: interaction.client, reason });
      await interaction.reply(eph('⛔ Application denied.')).catch(() => {});
      return true;
    }
    // Approve → instant.
    if (action === 'approve') {
      await interaction.deferUpdate().catch(() => {});
      await finalizeDecision({ reviewMsg: interaction.message, approved: true, reviewerId: interaction.user.id, reviewerTag: interaction.user.tag, applicantId, title, cfg, guild: interaction.guild, client: interaction.client });
      return true;
    }
    return true;
  }

  if (!cid.startsWith('cc:')) return false;
  const row = getStmt.get(cid.slice(3));
  if (!row) { await interaction.reply(eph('This button is no longer available.')).catch(() => {}); return true; }
  const cfg = JSON.parse(row.config);

  // Role-toggle button.
  if (row.type === 'role' && interaction.isButton()) {
    const role = interaction.guild?.roles.cache.get(cfg.roleId);
    if (!role) { await interaction.reply(eph('That role no longer exists.')).catch(() => {}); return true; }
    try {
      if (interaction.member.roles.cache.has(role.id)) { await interaction.member.roles.remove(role.id); await interaction.reply(eph(`➖ Removed **${role.name}**.`)); }
      else { await interaction.member.roles.add(role.id); await interaction.reply(eph(`➕ You now have **${role.name}**!`)); }
    } catch { await interaction.reply(eph('❌ I couldn’t change that role — check my **Manage Roles** permission and that my role is **above** it.')).catch(() => {}); }
    return true;
  }

  // Curated role select-menu.
  if (row.type === 'rolemenu' && interaction.isStringSelectMenu()) {
    const chosen = new Set(interaction.values);
    let added = 0; let removed = 0;
    for (const r of cfg.roles) {
      const has = interaction.member.roles.cache.has(r.roleId);
      try {
        if (chosen.has(r.roleId) && !has) { await interaction.member.roles.add(r.roleId); added++; }
        else if (!chosen.has(r.roleId) && has) { await interaction.member.roles.remove(r.roleId); removed++; }
      } catch { /* hierarchy/perms — skip */ }
    }
    await interaction.reply(eph(added || removed ? `✅ Roles updated${added ? ` · +${added}` : ''}${removed ? ` · −${removed}` : ''}.` : 'No changes.')).catch(() => {});
    return true;
  }

  // Form button → open the first modal page (pagination handles >5 questions).
  if (row.type === 'form' && interaction.isButton()) {
    await interaction.showModal(formModal(row.id, cfg, 0));
    return true;
  }

  return true;
}

function field(interaction, id) { try { return interaction.fields.getTextInputValue(id); } catch { return ''; } }
