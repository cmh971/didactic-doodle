// Setup config store — a normalized view over the per-guild settings JSON, with
// safe defaults and small mutators. Everything the /setup wizard reads or writes
// goes through here so the shape stays consistent across pages.
import { getGuild, saveGuild, setModule as setGuildModule } from '../systems/guilds.js';
import { TOKEN, TOKEN_NAME } from '../config.js';

const DEFAULT_SETTINGS = () => ({
  logChannel: null,
  welcomeChannel: null,
  welcomeMessage: 'Welcome {user} to {server}! 🎉',
  goodbyeChannel: null,
  goodbyeMessage: '{user} has left. 👋',
  levelUpChannel: null,
  levelUpMessage: '🎉 {user} reached level {level}!',
  autoroles: {}, // { "5": roleId }
  joinRoles: [], // roles given on join
  adminRoles: [],
  modRoles: [],
  currencyName: TOKEN_NAME,
  currencyEmoji: TOKEN,
  automod: { invites: true, spam: true, badwords: false, logChannel: null, maxMentions: 5 },
  economy: { startingBalance: 100000, dailyAmount: 250000 },
  tickets: DEFAULT_TICKETS(),
  verify: { verifiedRoleId: '', unverifiedRoleId: '', nickname: false },
  ranks: [], // promotion/infraction ladder: [{ id, name, roleId }] (built later)
});

// The full ticket "creative studio" config. Everything is flat (one level under
// `tickets`) so the generic setNested(guildId, 'tickets', key, value) works for
// every field the setup UI edits.
export const DEFAULT_TICKETS = () => ({
  enabled: false,
  mode: 'channel', // 'channel' | 'dm' | 'both'

  // ---- Panel appearance (the studio) ----
  title: '🎫 Support Tickets',
  subtitle: '',
  description: 'Need help or have a question? Open a private ticket and our staff team will be right with you.',
  color: '#5865F2',
  image: '',
  thumbnail: '',
  footer: '',
  component: 'button', // 'button' | 'menu'
  buttonLabel: 'Create Ticket',
  buttonEmoji: '🎫',
  buttonStyle: 'Primary', // Primary | Secondary | Success | Danger
  menuPlaceholder: 'Select what you need help with…',
  menuOptions: 'General Support, Report a User, Billing / Payments, Partnership, Other', // comma-separated

  // ---- Channel-ticket behavior ----
  panelChannelId: '',   // where the panel was/will be deployed
  categoryId: '',       // parent category new ticket channels are created under
  staffRoleId: '',      // role that can see + claim tickets
  openMessage: 'Hi {user}, thanks for reaching out! 🎫\nPlease describe your issue in as much detail as you can and a member of {staff} will help you shortly.',
  naming: 'ticket-{num}', // {num}, {user}, {username}
  autoCloseMinutes: 0,    // 0 = off; auto-close after N minutes unless "Keep Open" pressed
  cooldownSeconds: 0,     // per-user cooldown between opening tickets
  maxOpen: 1,             // max simultaneous open tickets per user

  // ---- Buttons on the opened-ticket embed ----
  btnClose: true,
  btnClaim: true,
  btnLock: false,
  btnTranscript: true,

  // ---- Bonus features ----
  pingStaff: true,          // ping the staff role when a ticket opens
  requireReason: false,     // pop a modal for a reason before opening
  transcriptChannelId: '',  // where close transcripts are saved
  logChannelId: '',         // open/close/claim event log
  feedback: false,          // ⭐ rating prompt to the opener on close
  welcomeDM: false,         // DM the opener a copy/notice when their ticket opens
  blacklistRoleId: '',      // members with this role cannot open tickets
  priority: false,          // Low/Med/High priority buttons that recolor the ticket

  // ---- DM tickets (modmail) ----
  dmCommand: '!ticket',
  dmCloseCommand: '!close',
  dmStaffChannelId: '',     // channel where DM-ticket threads are created
  dmAck: '✅',
  dmReply: 'Thanks! Your message was sent to our staff team — they will reply to you right here in your DMs. 📨',

  // ---- Per-category ping roles ----
  // Maps a menu option label -> the role to ping/grant when that type is chosen.
  // e.g. { "General": staffRoleId, "Management": mgmtRoleId, "HR": hrRoleId }.
  // Falls back to staffRoleId when a category has no mapping.
  categoryRoles: {},

  // ---- Internal counter ----
  counter: 0,
});

// Deep-merge defaults so older guild rows gain new keys transparently.
function normalize(settings) {
  const d = DEFAULT_SETTINGS();
  const s = { ...d, ...settings };
  s.automod = { ...d.automod, ...(settings.automod || {}) };
  s.economy = { ...d.economy, ...(settings.economy || {}) };
  s.tickets = { ...d.tickets, ...(settings.tickets || {}) };
  s.verify = { ...d.verify, ...(settings.verify || {}) };
  s.ranks = Array.isArray(settings.ranks) ? settings.ranks : [];
  s.autoroles = { ...(settings.autoroles || {}) };
  s.joinRoles = settings.joinRoles || [];
  s.adminRoles = settings.adminRoles || [];
  s.modRoles = settings.modRoles || [];
  return s;
}

export function getCfg(guildId) {
  const g = getGuild(guildId);
  return { guildId, language: g.language, modules: g.modules, settings: normalize(g.settings) };
}

export function setSetting(guildId, key, value) {
  const g = getGuild(guildId);
  g.settings = normalize(g.settings);
  g.settings[key] = value;
  saveGuild(g);
  return getCfg(guildId);
}

export function setNested(guildId, group, key, value) {
  const g = getGuild(guildId);
  g.settings = normalize(g.settings);
  g.settings[group] = { ...g.settings[group], [key]: value };
  saveGuild(g);
  return getCfg(guildId);
}

export function setLanguage(guildId, language) {
  const g = getGuild(guildId);
  g.language = language;
  saveGuild(g);
  return getCfg(guildId);
}

export function toggleModule(guildId, name) {
  const cur = getGuild(guildId).modules[name] !== false;
  setGuildModule(guildId, name, !cur);
  return getCfg(guildId);
}

export function addAutorole(guildId, level, roleId) {
  const cfg = getCfg(guildId);
  cfg.settings.autoroles[String(level)] = roleId;
  return setSetting(guildId, 'autoroles', cfg.settings.autoroles);
}

export function removeAutorole(guildId, level) {
  const cfg = getCfg(guildId);
  delete cfg.settings.autoroles[String(level)];
  return setSetting(guildId, 'autoroles', cfg.settings.autoroles);
}

export function setRoleList(guildId, key, roleIds) {
  return setSetting(guildId, key, roleIds);
}

export function resetGuild(guildId) {
  const g = getGuild(guildId);
  g.settings = DEFAULT_SETTINGS();
  g.modules = { economy: true, gamification: true, moderation: true, automod: true, leveling: true };
  g.language = 'en';
  saveGuild(g);
  return getCfg(guildId);
}
