// Multi-engine search aggregator. DuckDuckGo + Wikipedia work with ZERO setup
// (keyless). Google / Bing / Brave / SerpAPI activate only when the owner adds a
// key (via DM), stored with the dual-guarded AES-256-GCM + HMAC secure store.
// All active engines run in parallel; results are merged + de-duplicated.
import { getDb } from '../db/index.js';
import { encryptSecret, decryptSecret, maskSecret } from '../systems/secureStore.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// ---- encrypted key store ----
const db = getDb();
db.exec('CREATE TABLE IF NOT EXISTS search_keys(engine TEXT PRIMARY KEY, enc TEXT)');
const stmt = {
  set: db.prepare('INSERT INTO search_keys(engine, enc) VALUES(?, ?) ON CONFLICT(engine) DO UPDATE SET enc = excluded.enc'),
  get: db.prepare('SELECT enc FROM search_keys WHERE engine = ?'),
  del: db.prepare('DELETE FROM search_keys WHERE engine = ?'),
  all: db.prepare('SELECT engine FROM search_keys'),
};
export function setSearchKey(engine, value) { if (!value) { stmt.del.run(engine); return; } stmt.set.run(engine, encryptSecret(value)); }
export function getSearchKey(engine) { const r = stmt.get.get(engine); return r ? decryptSecret(r.enc) : null; }
export function keyMask(engine) { const k = getSearchKey(engine); return k ? maskSecret(k) : null; }
export function activeEngines() {
  const keyed = new Set(stmt.all.all().map((r) => r.engine).filter((e) => getSearchKey(e)));
  return { keyless: ['DuckDuckGo', 'Wikipedia'], keyed: [...keyed] };
}

// ---- keyless sources ----
function ddgUrl(href) { const m = /[?&]uddg=([^&]+)/.exec(href); return m ? decodeURIComponent(m[1]) : (href.startsWith('//') ? 'https:' + href : href); }
async function ddg(query) {
  const html = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const links = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const snips = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
  return links.slice(0, 12).map((m, i) => ({ title: strip(m[2]), url: ddgUrl(m[1]), snippet: snips[i] ? strip(snips[i][1]) : '', source: 'DuckDuckGo' }));
}
async function wikipedia(query) {
  const [, titles, descs, urls] = await fetch('https://en.wikipedia.org/w/api.php?action=opensearch&limit=4&format=json&search=' + encodeURIComponent(query)).then((r) => r.json());
  return (titles || []).map((title, i) => ({ title, url: urls[i], snippet: descs[i] || '', source: 'Wikipedia' }));
}

// ---- keyed sources (opt-in) ----
const SOURCES = {
  google: async (q, key) => {
    const [apiKey, cx] = key.split('|');
    const j = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}`).then((r) => r.json());
    return (j.items || []).map((it) => ({ title: it.title, url: it.link, snippet: it.snippet, source: 'Google' }));
  },
  bing: async (q, key) => {
    const j = await fetch('https://api.bing.microsoft.com/v7.0/search?q=' + encodeURIComponent(q), { headers: { 'Ocp-Apim-Subscription-Key': key } }).then((r) => r.json());
    return (j.webPages?.value || []).map((v) => ({ title: v.name, url: v.url, snippet: v.snippet, source: 'Bing' }));
  },
  brave: async (q, key) => {
    const j = await fetch('https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(q), { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } }).then((r) => r.json());
    return (j.web?.results || []).map((v) => ({ title: v.title, url: v.url, snippet: strip(v.description), source: 'Brave' }));
  },
  serpapi: async (q, key) => {
    const j = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&api_key=${key}`).then((r) => r.json());
    return (j.organic_results || []).map((v) => ({ title: v.title, url: v.link, snippet: v.snippet, source: 'SerpAPI' }));
  },
};
export const KEYED_ENGINES = Object.keys(SOURCES);

// ---- aggregate ----
export async function searchAll(query) {
  const tasks = [ddg(query).catch(() => []), wikipedia(query).catch(() => [])];
  for (const e of KEYED_ENGINES) { const k = getSearchKey(e); if (k) tasks.push(SOURCES[e](query, k).catch(() => [])); }
  const all = (await Promise.all(tasks)).flat();
  const seen = new Set(); const out = [];
  for (const r of all) {
    if (!r.url || !r.title) continue;
    const u = r.url.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(u)) continue;
    seen.add(u); out.push(r);
  }
  return out.slice(0, 30);
}

// ---- fetch a page's readable text (for reading results in-Discord) ----
export async function fetchReadable(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!(r.headers.get('content-type') || '').includes('text/html')) return '(not a readable HTML page — it may be a PDF/image/app)';
    let html = await r.text();
    html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<nav[\s\S]*?<\/nav>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
    const text = strip(html);
    return text.slice(0, 9000) || '(no readable text found)';
  } catch (e) { return '⚠️ Could not fetch this page: ' + e.message; }
}
