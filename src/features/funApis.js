// Shared fetchers for the free public APIs used by the "?" fun/game commands
// (and the dev API). Every call has a timeout + friendly errors so a slow/So down
// third-party never hangs the bot. No API keys required except NASA (which falls
// back to DEMO_KEY — get your own free key at https://api.nasa.gov to lift the
// rate limit). FunTranslations' free tier is ~5 calls/hour, so it 429s easily.

const UA = { 'User-Agent': 'SentinelBot/1.0 (+https://sentinelbothq.com)' };

async function fetchJson(url, { timeout = 10000, headers = {}, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(timeout) })
        .catch((e) => { throw new Error(e.name === 'TimeoutError' ? 'the service took too long to respond' : `network error (${e.message})`); });
      if (!res.ok) {
        if (res.status === 429) throw new Error('rate limited by the API — try again in a bit');
        // 502/503/504 are usually transient — worth one retry before giving up.
        if ([502, 503, 504].includes(res.status) && attempt < retries) { lastErr = new Error(`HTTP ${res.status}`); continue; }
        throw new Error(`the API returned HTTP ${res.status}`);
      }
      return res.json();
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) throw e;
    }
  }
  throw lastErr;
}

// Decode the HTML entities Open Trivia DB returns (&quot; &#039; &eacute; …).
export function decodeEntities(s = '') {
  const named = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ', ldquo: '“', rdquo: '”', rsquo: '’', lsquo: '‘', hellip: '…', shy: '' };
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in named ? named[n.toLowerCase()] : m));
}

// ---- Open Trivia Database -------------------------------------------------
export async function getTrivia({ type = 'multiple' } = {}) {
  const j = await fetchJson(`https://opentdb.com/api.php?amount=1&type=${type === 'boolean' ? 'boolean' : 'multiple'}`);
  const q = j?.results?.[0];
  if (!q) throw new Error('no question came back');
  const correct = decodeEntities(q.correct_answer);
  const incorrect = q.incorrect_answers.map(decodeEntities);
  const options = q.type === 'boolean' ? ['True', 'False'] : shuffle([correct, ...incorrect]);
  return {
    category: decodeEntities(q.category), difficulty: q.difficulty,
    question: decodeEntities(q.question), correct, options,
  };
}
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// ---- NASA APOD + Mars Rover ----------------------------------------------
const NASA_KEY = () => process.env.NASA_API_KEY || 'DEMO_KEY';
export async function getApod(date) {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `&date=${date}` : '';
  return fetchJson(`https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY()}${d}`, { timeout: 15000, retries: 2 });
}
export async function getMars(rover = 'curiosity', sol = 1000) {
  const r = ['curiosity', 'opportunity', 'spirit', 'perseverance'].includes(String(rover).toLowerCase()) ? String(rover).toLowerCase() : 'curiosity';
  const s = Number.isFinite(+sol) ? Math.max(0, Math.floor(+sol)) : 1000;
  const j = await fetchJson(`https://api.nasa.gov/mars-photos/api/v1/rovers/${r}/photos?sol=${s}&api_key=${NASA_KEY()}`, { timeout: 15000, retries: 2 });
  return { rover: r, sol: s, photos: j?.photos || [] };
}

// ---- NASA EPIC (whole-Earth images from the DSCOVR satellite) -------------
export async function getEpic(date) {
  const key = NASA_KEY();
  const base = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `https://api.nasa.gov/EPIC/api/natural/date/${date}`
    : 'https://api.nasa.gov/EPIC/api/natural';
  const j = await fetchJson(`${base}?api_key=${key}`, { timeout: 15000, retries: 2 });
  if (!Array.isArray(j) || !j.length) throw new Error('no whole-Earth image available for that date');
  const item = j[Math.floor(Math.random() * j.length)];
  const [y, m, d] = item.date.split(' ')[0].split('-'); // "2026-08-10 00:31:45" → parts
  return {
    url: `https://api.nasa.gov/EPIC/archive/natural/${y}/${m}/${d}/png/${item.image}.png?api_key=${key}`,
    caption: item.caption || '',
    date: item.date,
    lat: item.centroid_coordinates?.lat,
    lon: item.centroid_coordinates?.lon,
    count: j.length,
  };
}

// All EPIC frames for a day (chronological) — Earth visibly rotates across them.
export async function getEpicDay(date) {
  const key = NASA_KEY();
  const base = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `https://api.nasa.gov/EPIC/api/natural/date/${date}`
    : 'https://api.nasa.gov/EPIC/api/natural';
  const j = await fetchJson(`${base}?api_key=${key}`, { timeout: 15000, retries: 2 });
  if (!Array.isArray(j) || !j.length) throw new Error('no whole-Earth frames for that day');
  const day = j[0].date.split(' ')[0]; const [y, m, d] = day.split('-');
  const frames = j.map((it) => `https://api.nasa.gov/EPIC/archive/natural/${y}/${m}/${d}/png/${it.image}.png?api_key=${key}`);
  return { date: day, frames };
}

// ---- Cataas (cat with caption) -------------------------------------------
export function catMemeUrl(text) {
  const base = text && text.trim() ? `https://cataas.com/cat/says/${encodeURIComponent(text.trim().slice(0, 120))}` : 'https://cataas.com/cat';
  return `${base}?t=${Date.now()}`; // cache-buster so Discord fetches a fresh cat
}

// ---- FunTranslations ------------------------------------------------------
export const DIALECTS = ['yoda', 'pirate', 'shakespeare', 'minion', 'klingon', 'dothraki', 'valyrian', 'sith', 'cockney', 'gungan'];
export async function translateDialect(dialect, text) {
  const d = DIALECTS.includes(String(dialect).toLowerCase()) ? String(dialect).toLowerCase() : null;
  if (!d) throw new Error(`unknown dialect. Try: ${DIALECTS.join(', ')}`);
  if (!text?.trim()) throw new Error('give me some text to translate');
  const j = await fetchJson(`https://api.funtranslations.com/translate/${d}.json?text=${encodeURIComponent(text.trim().slice(0, 300))}`);
  const out = j?.contents?.translated;
  if (!out) throw new Error('translation failed');
  return { dialect: d, translated: out, original: j.contents.text };
}

// ---- Jikan (MyAnimeList) --------------------------------------------------
export async function getAnime(title) {
  if (!title?.trim()) throw new Error('give me an anime title');
  const j = await fetchJson(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title.trim())}&limit=1&sfw`);
  const a = j?.data?.[0];
  if (!a) throw new Error(`no anime found for “${title}”`);
  return a;
}
export async function getCharacter(name) {
  if (!name?.trim()) throw new Error('give me a character name');
  const j = await fetchJson(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name.trim())}&limit=1`);
  const c = j?.data?.[0];
  if (!c) throw new Error(`no character found for “${name}”`);
  return c;
}

// ---- Useless facts + Advice slip -----------------------------------------
export async function getFact() {
  const j = await fetchJson('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
  return j?.text || 'No fact right now.';
}
export async function getAdvice() {
  // adviceslip caches per-URL; add a nonce so we get a fresh slip each time
  const j = await fetchJson(`https://api.adviceslip.com/advice?t=${Date.now()}`);
  return j?.slip?.advice || 'No advice right now.';
}

// ---- TheDogAPI (photo + breed info) --------------------------------------
// Works keyless (limited), but a free key (x-api-key header) lifts the limits
// and enables breed metadata reliably. Set DOG_API_KEY in .env.
let _dogBreeds = null; // cached breed list (with metadata + reference image)
export async function getDog() {
  const key = process.env.DOG_API_KEY;
  const headers = key ? { 'x-api-key': key } : {};
  // The /breeds endpoint carries the metadata; each breed has a reference_image_id
  // we turn into a photo — guarantees the picture and the info match.
  if (!_dogBreeds) {
    _dogBreeds = (await fetchJson('https://api.thedogapi.com/v1/breeds', { headers, timeout: 12000, retries: 1 })).filter((b) => b.reference_image_id);
  }
  if (!_dogBreeds.length) { // keyless / no breeds available → plain photo fallback
    const j = await fetchJson('https://api.thedogapi.com/v1/images/search?limit=1', { headers });
    return { url: j?.[0]?.url, breeds: [] };
  }
  const b = _dogBreeds[Math.floor(Math.random() * _dogBreeds.length)];
  return { url: `https://cdn2.thedogapi.com/images/${b.reference_image_id}.jpg`, breeds: [b] };
}

// ---- Any animal by name (Wikipedia — covers literally every species) ------
export async function getAnimal(query) {
  if (!query?.trim()) throw new Error('give me an animal name');
  const t = encodeURIComponent(query.trim().replace(/\s+/g, '_'));
  const j = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`, { retries: 1, timeout: 9000 });
  if (j.type === 'disambiguation' || !j.extract) throw new Error(`couldn't pin down “${query}” — try a more specific name`);
  return {
    title: j.title,
    extract: j.extract,
    image: j.thumbnail?.source || j.originalimage?.source || null,
    url: j.content_urls?.desktop?.page,
  };
}

// ---- Fox / Duck / Bird (all keyless) -------------------------------------
export async function getFox() {
  const j = await fetchJson('https://randomfox.ca/floof/', { retries: 1 });
  if (!j?.image) throw new Error('no fox came back');
  return j.image;
}
export async function getDuck() {
  const j = await fetchJson('https://random-d.uk/api/v2/random', { retries: 1 });
  if (!j?.url) throw new Error('no duck came back');
  return j.url;
}
export async function getBird() {
  // Primary: shibe.online. Fallback: alexflipnote's birb (both keyless).
  try {
    const j = await fetchJson('https://shibe.online/api/birds?count=1&urls=true&httpsUrls=true', { retries: 0, timeout: 7000 });
    if (Array.isArray(j) && j[0]) return j[0];
  } catch { /* fall through to backup */ }
  const j2 = await fetchJson('https://api.alexflipnote.dev/birb', { retries: 1, timeout: 8000 });
  if (!j2?.file) throw new Error('no bird came back');
  return j2.file;
}

// ---- NOAA severe weather: hurricanes (NHC) + tornado warnings (NWS) -------
export async function getHurricanes() {
  const j = await fetchJson('https://www.nhc.noaa.gov/CurrentStorms.json', { timeout: 12000, retries: 1 });
  return (j.activeStorms || []).map((s) => ({
    name: s.name, classification: s.classification, basin: s.binName || s.basin || '',
    wind: s.intensity, pressure: s.pressure,
    lat: s.latitudeNumeric ?? s.latitude, lon: s.longitudeNumeric ?? s.longitude,
    movement: s.movementDir != null ? `${s.movementDir}° at ${s.movementSpeed} kt` : '—',
    lastUpdate: s.lastUpdate,
  }));
}
export async function getTornadoWarnings() {
  const j = await fetchJson('https://api.weather.gov/alerts/active?event=Tornado%20Warning', { timeout: 12000, retries: 1 });
  return (j.features || []).map((f) => ({
    area: f.properties?.areaDesc || 'Unknown area',
    severity: f.properties?.severity, urgency: f.properties?.urgency,
    expires: f.properties?.expires, headline: f.properties?.headline,
    sender: f.properties?.senderName,
  }));
}

// ---- USGS Earthquake Hazards (keyless, real-time) ------------------------
const QUAKE_FEEDS = {
  '': '4.5_day', day: '4.5_day', week: '4.5_week', month: '4.5_month',
  big: 'significant_week', significant: 'significant_week', major: 'significant_month',
  all: 'all_hour', recent: '2.5_day', small: '2.5_day',
};
export async function getQuakes(arg = '') {
  // A number (e.g. "5" or "min_magnitude: 5.0") → FDSN query with a magnitude floor.
  const mag = parseFloat(String(arg).replace(/[^0-9.]/g, ''));
  if (!Number.isNaN(mag) && mag > 0) {
    const start = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const j = await fetchJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${mag}&orderby=time&limit=12&starttime=${start}`, { timeout: 12000, retries: 1 });
    return { feed: `M${mag}+ · past 30 days`, quakes: j?.features || [] };
  }
  // Otherwise a keyword feed (day/week/big/all…).
  const feed = QUAKE_FEEDS[String(arg).toLowerCase().trim()] || '4.5_day';
  const j = await fetchJson(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`, { timeout: 10000, retries: 1 });
  return { feed: feed.replace('_', ' · past '), quakes: j?.features || [] };
}

// ---- NASA Near Earth Object Web Service (NeoWs) --------------------------
export async function getNeo(date) {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const j = await fetchJson(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${d}&end_date=${d}&api_key=${NASA_KEY()}`, { timeout: 15000, retries: 2 });
  const objects = (j?.near_earth_objects?.[d] || []).map((o) => {
    const dia = o.estimated_diameter?.meters || {};
    const ca = o.close_approach_data?.[0] || {};
    return {
      name: o.name?.replace(/[()]/g, '') || 'Unknown',
      hazardous: !!o.is_potentially_hazardous_asteroid,
      diaMin: Math.round(dia.estimated_diameter_min || 0),
      diaMax: Math.round(dia.estimated_diameter_max || 0),
      velocityKmh: Math.round(+(ca.relative_velocity?.kilometers_per_hour || 0)),
      missKm: Math.round(+(ca.miss_distance?.kilometers || 0)),
      missLunar: +(ca.miss_distance?.lunar || 0),
      time: ca.close_approach_date_full || d,
      url: o.nasa_jpl_url,
    };
  });
  return { date: d, count: j?.element_count ?? objects.length, objects };
}

// ---- Agify + Genderize ----------------------------------------------------
export async function predictName(name) {
  if (!name?.trim()) throw new Error('give me a name');
  const n = encodeURIComponent(name.trim().split(/\s+/)[0].slice(0, 40));
  const [age, gender] = await Promise.all([
    fetchJson(`https://api.agify.io?name=${n}`).catch(() => ({})),
    fetchJson(`https://api.genderize.io?name=${n}`).catch(() => ({})),
  ]);
  return {
    name: age.name || gender.name || name.trim(),
    age: age.age ?? null,
    gender: gender.gender ?? null,
    genderProb: gender.probability ?? null,
    sampleAge: age.count ?? null,
  };
}
