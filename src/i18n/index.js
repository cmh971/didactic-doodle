// Localization. Defaults to English. The dashboard exposes all languages in a
// dropdown; untranslated languages fall back to English so nothing ever breaks.
// RTL languages are flagged so the UI can switch direction (accessibility).

export const DEFAULT_LOCALE = 'en';

// 21 languages. rtl flag drives <html dir="rtl"> in the dashboard.
export const LANG_LIST = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'ru', name: 'Русский' },
  { code: 'pl', name: 'Polski' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'uk', name: 'Українська' },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'he', name: 'עברית', rtl: true },
  { code: 'fa', name: 'فارسی', rtl: true },
  { code: 'ur', name: 'اردو', rtl: true },
];

// Base (English) string table — keys referenced by the dashboard frontend.
const EN = {
  title: 'Bot Dashboard',
  subtitle: 'Manage your server, economy & modules',
  login: 'Login with Discord',
  logout: 'Logout',
  language: 'Language',
  stats_guilds: 'Servers',
  stats_users: 'Users',
  stats_ping: 'Ping',
  stats_uptime: 'Uptime',
  select_server: 'Select a server',
  modules: 'Modules',
  leaderboard: 'Richest Players',
  xp_leaderboard: 'XP Leaderboard',
  economy_editor: 'Economy Editor',
  user_id: 'User ID',
  wallet: 'Wallet',
  load: 'Load',
  save: 'Save',
  live_logs: 'Live Logs',
  owner_only: 'Owner only',
  not_logged_in: 'Log in to manage your servers.',
  bot_not_in_guild: 'Bot is not in this server',
  saved: 'Saved!',
};

// Small sample translations (the rest of the 21 fall back to English).
const TRANSLATIONS = {
  es: { title: 'Panel del Bot', login: 'Iniciar sesión con Discord', logout: 'Cerrar sesión', language: 'Idioma', modules: 'Módulos', leaderboard: 'Jugadores más ricos', save: 'Guardar', load: 'Cargar', saved: '¡Guardado!' },
  fr: { title: 'Tableau de bord', login: 'Se connecter avec Discord', logout: 'Déconnexion', language: 'Langue', modules: 'Modules', leaderboard: 'Joueurs les plus riches', save: 'Enregistrer', load: 'Charger', saved: 'Enregistré !' },
  de: { title: 'Bot-Dashboard', login: 'Mit Discord anmelden', logout: 'Abmelden', language: 'Sprache', modules: 'Module', leaderboard: 'Reichste Spieler', save: 'Speichern', load: 'Laden', saved: 'Gespeichert!' },
  ar: { title: 'لوحة تحكم البوت', login: 'تسجيل الدخول عبر ديسكورد', logout: 'تسجيل الخروج', language: 'اللغة', modules: 'الوحدات', leaderboard: 'أغنى اللاعبين', save: 'حفظ', load: 'تحميل', saved: 'تم الحفظ!' },
  ja: { title: 'ボットダッシュボード', login: 'Discordでログイン', logout: 'ログアウト', language: '言語', modules: 'モジュール', leaderboard: '富豪ランキング', save: '保存', load: '読み込み', saved: '保存しました！' },
};

// Build the resolved table: every language maps to a full string set (EN fallback).
export const LOCALES = Object.fromEntries(
  LANG_LIST.map((l) => [l.code, { ...EN, ...(TRANSLATIONS[l.code] || {}) }]),
);

export function t(lang, key) {
  return (LOCALES[lang] || LOCALES[DEFAULT_LOCALE])[key] ?? EN[key] ?? key;
}
