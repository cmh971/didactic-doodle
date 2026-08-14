// Real Spotify Web API client — search, tracks, artists, albums, recommendations.
// App-only Client Credentials flow (no user login needed for search/metadata/
// previews), with an in-memory token cache. Dormant until SPOTIFY_CLIENT_ID /
// SPOTIFY_CLIENT_SECRET are set in .env. iTunes (spotify.js) stays as the no-key
// fallback for the !media song lookup.
//
// 🎁 Spotify access gifted by a friend of Chris 💚

export const GIFT_CREDIT = '🎁 Spotify access gifted by a friend of Chris 💚';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

let cached = { token: null, expiresAt: 0 };

export function spotifyConfigured() {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getToken() {
  if (!spotifyConfigured()) throw new Error('Spotify isn’t set up yet — add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.');
  if (cached.token && Date.now() < cached.expiresAt - 15000) return cached.token;
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`Spotify auth failed (${res.status}) — double-check your Client ID/Secret.`);
  cached = { token: j.access_token, expiresAt: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

async function api(path, params = {}) {
  const token = await getToken();
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
  const res = await fetch(`${API}${path}${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (res.status === 429) throw new Error('Spotify rate-limited us for a sec — try again shortly.');
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error?.message || `Spotify API error (${res.status}).`);
  return j;
}

const ms2min = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

function normTrack(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    artists: (t.artists || []).map((a) => a.name),
    artistIds: (t.artists || []).map((a) => a.id),
    album: t.album?.name,
    art: t.album?.images?.[0]?.url || null,
    artSmall: t.album?.images?.[t.album.images.length - 1]?.url || null,
    preview: t.preview_url || null,
    url: t.external_urls?.spotify || null,
    durationMs: t.duration_ms || 0,
    duration: ms2min(t.duration_ms || 0),
    popularity: t.popularity ?? null,
    explicit: !!t.explicit,
    release: t.album?.release_date || null,
  };
}

export async function searchTracks(query, limit = 5) {
  const j = await api('/search', { q: query, type: 'track', limit });
  return (j.tracks?.items || []).map(normTrack).filter(Boolean);
}
export async function getTrack(id) { return normTrack(await api(`/tracks/${id}`)); }
export async function recommendations(seedTrackId, limit = 5) {
  const j = await api('/recommendations', { seed_tracks: seedTrackId, limit });
  return (j.tracks || []).map(normTrack).filter(Boolean);
}
export async function searchArtist(query) {
  const j = await api('/search', { q: query, type: 'artist', limit: 1 });
  const a = j.artists?.items?.[0];
  if (!a) return null;
  return { id: a.id, name: a.name, genres: a.genres || [], followers: a.followers?.total ?? 0, img: a.images?.[0]?.url || null, url: a.external_urls?.spotify || null, popularity: a.popularity ?? null };
}
export async function artistTopTracks(artistId, market = 'US') {
  const j = await api(`/artists/${artistId}/top-tracks`, { market });
  return (j.tracks || []).map(normTrack).filter(Boolean);
}
export async function searchAlbum(query) {
  const j = await api('/search', { q: query, type: 'album', limit: 1 });
  const a = j.albums?.items?.[0];
  if (!a) return null;
  return { id: a.id, name: a.name, artists: (a.artists || []).map((x) => x.name), art: a.images?.[0]?.url || null, url: a.external_urls?.spotify || null, release: a.release_date, tracks: a.total_tracks };
}
