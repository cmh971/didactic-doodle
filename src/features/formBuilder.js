// Form Builder — build a form once, use it two ways:
//   1) NATIVE: users fill a Discord modal; responses logged to a channel.
//   2) GOOGLE: export an Apps Script that creates a Google Form YOU own, then a
//      "Fill" button hands each user a link through a bridge page that PRE-FILLS
//      their Discord ID into the form (…/viewform?entry.123=DiscordID:5353544).
//
// The bridge "detects where they came from" via a signed token in the link (HMAC),
// because browsers strip referrers from Discord — a token is the only reliable way.
import crypto from 'node:crypto';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { getDb } from '../db/index.js';

const SECRET = process.env.SESSION_SECRET || process.env.APP_SECRET || 'form-secret-change-me';
const PUBLIC = () => process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL, name TEXT NOT NULL, fields TEXT NOT NULL DEFAULT '[]',
  google_url TEXT, discord_entry TEXT, log_channel TEXT
)`);
const q = {
  add: db.prepare('INSERT INTO forms(guild_id,name) VALUES (?,?)'),
  get: db.prepare('SELECT * FROM forms WHERE id=? AND guild_id=?'),
  getAny: db.prepare('SELECT * FROM forms WHERE id=?'),
  list: db.prepare('SELECT id,name,fields,google_url FROM forms WHERE guild_id=? ORDER BY id'),
  setFields: db.prepare('UPDATE forms SET fields=? WHERE id=?'),
  setGoogle: db.prepare('UPDATE forms SET google_url=?, discord_entry=? WHERE id=?'),
  setLog: db.prepare('UPDATE forms SET log_channel=? WHERE id=?'),
  del: db.prepare('DELETE FROM forms WHERE id=? AND guild_id=?'),
};
const load = (id, gid) => { const r = q.get.get(Number(id), gid); if (r) r.fields = JSON.parse(r.fields || '[]'); return r; };

// ---- signed token (proves the clicker's Discord identity to the bridge) ----
const sign = (obj) => { const b = Buffer.from(JSON.stringify(obj)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url'); };
const verifyTok = (tok) => { try { const [b, h] = String(tok).split('.'); if (h !== crypto.createHmac('sha256', SECRET).update(b).digest('base64url')) return null; const o = JSON.parse(Buffer.from(b, 'base64url').toString()); return (o.exp && Date.now() > o.exp) ? null : o; } catch { return null; } };

// ---- prefilled Google Form URL ----
function prefillUrl(form, discordId) {
  const base = String(form.google_url).replace(/\/(edit|viewform)(\?.*)?$/i, '/viewform');
  return `${base}?usp=pp_url&entry.${form.discord_entry}=${encodeURIComponent('DiscordID:' + discordId)}`;
}

// ---- Apps Script generator (creates the form in the user's OWN Google account) ----
function appsScript(form) {
  const items = form.fields.map((f) => (f.type === 'long'
    ? `  form.addParagraphTextItem().setTitle(${JSON.stringify(f.label)});`
    : `  form.addTextItem().setTitle(${JSON.stringify(f.label)});`)).join('\n');
  return `/*  Paste into https://script.google.com → New project → run createForm() → Authorize.
    It builds this form in YOUR Google Drive (you own it), then logs the live URL and a
    PREFILL template. Find the field you want auto-filled with the Discord ID, copy its
    entry.NUMBER, and run in Discord:  !form link ${form.id} <liveUrl> <thatNumber>  */
function createForm() {
  const form = FormApp.create(${JSON.stringify(form.name)});
  // A hidden field to receive the Discord ID (so prefill has a target):
  form.addTextItem().setTitle('Discord ID');
${items}
  Logger.log('LIVE URL: ' + form.getPublishedUrl());
  var fr = form.createResponse();
  form.getItems().forEach(function (it, i) { try { fr = fr.withItemResponse(it.asTextItem().createResponse('SAMPLE_' + i)); } catch (e) {} });
  Logger.log('PREFILL TEMPLATE (read the entry.NUMBER next to each field): ' + fr.toPrefilledUrl());
}`;
}

// ============================ command: !form ============================
export async function handleFormCommand(message) {
  const m = /^!form\b\s*([\s\S]*)$/i.exec((message.content || '').trim());
  if (!m || !message.guild) return false;
  if (!message.member?.permissions?.has('ManageGuild')) { await message.reply('🔒 Needs **Manage Server**.').catch(() => {}); return true; }
  const parts = (m[1] || '').trim().split(/\s+/);
  const sub = (parts.shift() || '').toLowerCase();
  const gid = message.guild.id;

  if (sub === 'new') {
    const name = parts.join(' ') || 'Untitled form';
    const info = q.add.run(gid, name.slice(0, 80));
    return message.reply(`📝 Created form **#${info.lastInsertRowid}** — “${name}”. Add fields: \`!form field ${info.lastInsertRowid} short Your name\``).catch(() => {});
  }
  if (sub === 'list') {
    const rows = q.list.all(gid);
    if (!rows.length) return message.reply('No forms yet. `!form new <name>`').catch(() => {});
    return message.reply('📋 **Forms:**\n' + rows.map((r) => `• #${r.id} — ${r.name} — ${JSON.parse(r.fields).length} field(s)${r.google_url ? ' · 🔗 Google linked' : ''}`).join('\n')).catch(() => {});
  }

  const id = parts.shift();
  const form = load(id, gid);
  if (!form) return message.reply('❓ Form not found. `!form list`').catch(() => {});

  if (sub === 'field') {
    const type = /^(short|long)$/i.test(parts[0]) ? parts.shift().toLowerCase() : 'short';
    const label = parts.join(' ');
    if (!label) return message.reply('Usage: `!form field <id> <short|long> <label>`').catch(() => {});
    form.fields.push({ label: label.slice(0, 45), type });
    q.setFields.run(JSON.stringify(form.fields.slice(0, 5)), form.id);
    return message.reply(`✅ Added ${type} field “${label}”. (${form.fields.length}/5)`).catch(() => {});
  }
  if (sub === 'fields') {
    return message.reply(form.fields.length ? `**${form.name}** fields:\n` + form.fields.map((f, i) => `${i + 1}. ${f.label} (${f.type})`).join('\n') : 'No fields yet. `!form field ' + form.id + ' short Label`').catch(() => {});
  }
  if (sub === 'logchannel') {
    const ch = message.mentions.channels.first() || message.channel;
    q.setLog.run(ch.id, form.id);
    return message.reply(`✅ Native responses for #${form.id} will log to <#${ch.id}>.`).catch(() => {});
  }
  if (sub === 'link') {
    const url = parts[0]; const entry = (parts[1] || '').replace(/\D/g, '');
    if (!url || !entry) return message.reply('Usage: `!form link <id> <googleFormUrl> <entryNumber>` (get the number from the Apps Script’s PREFILL TEMPLATE or Google’s “Get pre-filled link”).').catch(() => {});
    q.setGoogle.run(url, entry, form.id);
    return message.reply(`🔗 Linked Google Form to #${form.id}. The Discord ID will prefill \`entry.${entry}\`. Post it with \`!form send ${form.id}\`.`).catch(() => {});
  }
  if (sub === 'export') {
    const dm = await message.author.createDM().catch(() => null);
    const ok = dm && await dm.send(`🧩 **Apps Script for “${form.name}”** — paste into script.google.com and run \`createForm()\`:\n\`\`\`javascript\n${appsScript(form).slice(0, 1850)}\n\`\`\``).then(() => true).catch(() => false);
    return message.reply(ok ? '📬 Sent the Apps Script to your DMs.' : '⚠️ Open your DMs so I can send the script.').catch(() => {});
  }
  if (sub === 'send') {
    if (!form.fields.length && !form.google_url) return message.reply('Add fields (`!form field`) or link a Google Form (`!form link`) first.').catch(() => {});
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('📝 ' + form.name).setDescription(form.google_url ? 'Click to open the form — your Discord ID is filled in automatically.' : 'Click to fill out this form.');
    const btn = new ButtonBuilder().setCustomId(`form:fill:${form.id}`).setLabel('Fill out form').setEmoji('📝').setStyle(ButtonStyle.Success);
    return message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] }).then(() => message.reply('✅ Posted.').catch(() => {})).catch(() => {});
  }
  if (sub === 'delete') { q.del.run(form.id, gid); return message.reply(`🗑️ Deleted form #${form.id}.`).catch(() => {}); }

  return message.reply('**Form builder:** `!form new <name>` · `field <id> <short|long> <label>` · `fields <id>` · `send <id>` · `link <id> <url> <entry>` · `export <id>` · `logchannel <id> #ch` · `list` · `delete <id>`').catch(() => {});
}

// ============================ button + modal ============================
export async function handleFormButton(interaction) {
  if (!interaction.customId?.startsWith('form:fill:')) return false;
  const form = q.getAny.get(Number(interaction.customId.split(':')[2]));
  if (!form) { await interaction.reply({ content: '⚠️ This form no longer exists.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  form.fields = JSON.parse(form.fields || '[]');

  // Google-linked → hand them a bridge link that prefills their Discord ID.
  if (form.google_url && form.discord_entry) {
    const token = sign({ u: interaction.user.id, f: form.id, exp: Date.now() + 10 * 60 * 1000 });
    const link = `${PUBLIC()}/form/go?t=${token}`;
    await interaction.reply({ content: `📝 **${form.name}** — open your personalized form (Discord ID auto-filled):\n${link}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }
  // Native → show a modal from the fields.
  if (!form.fields.length) { await interaction.reply({ content: '⚠️ This form has no fields yet.', flags: MessageFlags.Ephemeral }).catch(() => {}); return true; }
  const modal = new ModalBuilder().setCustomId(`form:submit:${form.id}`).setTitle(form.name.slice(0, 45));
  form.fields.slice(0, 5).forEach((f, i) => modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('f' + i).setLabel(f.label.slice(0, 45)).setStyle(f.type === 'long' ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(false),
  )));
  await interaction.showModal(modal).catch(() => {});
  return true;
}

export async function handleFormModal(interaction) {
  if (!interaction.customId?.startsWith('form:submit:')) return false;
  const form = q.getAny.get(Number(interaction.customId.split(':')[2]));
  if (!form) return true;
  form.fields = JSON.parse(form.fields || '[]');
  const answers = form.fields.map((f, i) => `**${f.label}:** ${interaction.fields.getTextInputValue('f' + i) || '_(blank)_'}`).join('\n');
  const embed = new EmbedBuilder().setColor(0x22c55e).setTitle('📝 ' + form.name + ' — response')
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setDescription(answers).setTimestamp();
  const ch = form.log_channel && interaction.guild?.channels?.cache.get(form.log_channel);
  if (ch?.isTextBased?.()) await ch.send({ embeds: [embed] }).catch(() => {});
  await interaction.reply({ content: '✅ Thanks! Your response was submitted.', flags: MessageFlags.Ephemeral }).catch(() => {});
  return true;
}

// ============================ bridge route ============================
// GET /form/go?t=<token> — the "blank white page" that detects who came from
// Discord (via the signed token) and redirects to the prefilled Google Form.
export function registerFormRoutes(app) {
  app.get('/form/go', (req, res) => {
    const tok = verifyTok(req.query.t);
    if (!tok) return res.status(403).send('<!doctype html><meta charset=utf-8><body style="font-family:sans-serif;padding:40px">⛔ This form link is invalid or expired. Click the button in Discord again.</body>');
    const form = q.getAny.get(Number(tok.f));
    if (!form?.google_url || !form.discord_entry) return res.status(404).send('<!doctype html><body>Form not linked.</body>');
    const url = prefillUrl(form, tok.u);
    // Blank white page → instant redirect to the prefilled form.
    res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${url.replace(/"/g, '&quot;')}"></head><body style="background:#fff"><script>location.replace(${JSON.stringify(url)});</script></body></html>`);
  });
  console.log('📝 Form bridge mounted at /form/go');
}
