// Shared OpenWeather fetcher — used by both the /weather command and the
// dashboard's weather widget. Uses OPENWEATHER_API_KEY from the environment.
const API = 'https://api.openweathermap.org/data/2.5/weather';

// Map an OpenWeather icon code (or condition name) to an emoji.
export function weatherEmoji(icon = '') {
  const c = String(icon);
  if (c.startsWith('01')) return '☀️';
  if (c.startsWith('02')) return '🌤️';
  if (c.startsWith('03') || c.startsWith('04')) return '☁️';
  if (c.startsWith('09') || c.startsWith('10')) return '🌧️';
  if (c.startsWith('11')) return '⛈️';
  if (c.startsWith('13')) return '❄️';
  if (c.startsWith('50')) return '🌫️';
  const m = c.toLowerCase();
  if (m.includes('clear')) return '☀️';
  if (m.includes('cloud')) return '☁️';
  if (m.includes('rain') || m.includes('drizzle')) return '🌧️';
  if (m.includes('thunder')) return '⛈️';
  if (m.includes('snow')) return '❄️';
  if (m.includes('mist') || m.includes('fog') || m.includes('haze')) return '🌫️';
  return '🌡️';
}

// Returns { ok: true, data } or { ok: false, error }. Never throws.
export async function getWeather(location, units = 'metric') {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return { ok: false, error: 'Weather isn\'t configured yet — set OPENWEATHER_API_KEY in the .env.' };
  if (!location || !String(location).trim()) return { ok: false, error: 'Please provide a location.' };
  const u = units === 'imperial' ? 'imperial' : 'metric';
  try {
    const url = `${API}?q=${encodeURIComponent(location)}&units=${u}&appid=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (String(data.cod) !== '200') {
      return { ok: false, error: data.message ? data.message.charAt(0).toUpperCase() + data.message.slice(1) : 'Location not found.' };
    }
    return {
      ok: true,
      data: {
        name: data.name,
        country: data.sys?.country || '',
        temp: Math.round(data.main.temp),
        feels: Math.round(data.main.feels_like),
        min: Math.round(data.main.temp_min),
        max: Math.round(data.main.temp_max),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        wind: data.wind?.speed ?? 0,
        clouds: data.clouds?.all ?? 0,
        desc: data.weather?.[0]?.description || 'unknown',
        icon: data.weather?.[0]?.icon || '',
        main: data.weather?.[0]?.main || '',
        units: u,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Could not reach the weather service.' };
  }
}
