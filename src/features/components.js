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
  ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, MessageFlags,
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
      const questions = (c.questions || []).filter((q) => q && q.label).slice(0, 5)
        .map((q, i) => ({ id: `q${i}`, label: String(q.label).slice(0, 45), paragraph: !!q.paragraph, required: q.required !== false }));
      if (!questions.length) continue;
      const id = store(guildId, 'form', { title: String(c.title || c.label || 'Form').slice(0, 45), channelId: c.channelId || null, questions });
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

// Route an interaction on a custom component. Returns true if handled.
export async function handleCustomComponent(interaction) {
  const cid = interaction.customId;
  if (!cid) return false;

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

  // Form modal submit → post the answers to the configured channel.
  if (cid.startsWith('ccform:') && interaction.isModalSubmit()) {
    const row = getStmt.get(cid.slice(7));
    if (!row) { await interaction.reply(eph('This form is no longer available.')).catch(() => {}); return true; }
    const cfg = JSON.parse(row.config);
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`📝 ${cfg.title}`)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL?.() })
      .addFields(cfg.questions.map((q) => ({ name: q.label.slice(0, 256), value: (field(interaction, q.id) || '—').slice(0, 1024) })))
      .setFooter({ text: `From ${interaction.user.id}` }).setTimestamp();
    let posted = false;
    const ch = cfg.channelId && interaction.guild?.channels.cache.get(cfg.channelId);
    if (ch?.isTextBased?.()) { await ch.send({ embeds: [embed] }).catch(() => {}); posted = true; }
    await interaction.reply(eph(posted ? '✅ Submitted — thank you!' : '✅ Submitted! (No destination channel was set, so staff may not see it — tell an admin.)')).catch(() => {});
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

  // Form button → open the modal.
  if (row.type === 'form' && interaction.isButton()) {
    const modal = new ModalBuilder().setCustomId(`ccform:${row.id}`).setTitle(cfg.title.slice(0, 45));
    for (const q of cfg.questions) {
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(q.id).setLabel(q.label.slice(0, 45)).setStyle(q.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(q.required !== false).setMaxLength(1000),
      ));
    }
    await interaction.showModal(modal);
    return true;
  }

  return true;
}

function field(interaction, id) { try { return interaction.fields.getTextInputValue(id); } catch { return ''; } }
