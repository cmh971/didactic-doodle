// Floating music player — a self-injecting widget. Streams commercial-free,
// listener-supported SomaFM stations (publicly streamable). No build step:
// just <script src="/music.js" defer></script> on any page.
(function () {
  if (window.__sentinelMusic) return;
  window.__sentinelMusic = true;

  const STATIONS = [
    { name: '🥗 Groove Salad (chill)', url: 'https://ice1.somafm.com/groovesalad-128-mp3' },
    { name: '🌌 Drone Zone (ambient)', url: 'https://ice1.somafm.com/dronezone-128-mp3' },
    { name: '🌸 Lush (vocal chill)', url: 'https://ice1.somafm.com/lush-128-mp3' },
    { name: '🚀 Space Station (electronica)', url: 'https://ice1.somafm.com/spacestation-128-mp3' },
    { name: '🎚️ Beat Blender (deep house)', url: 'https://ice1.somafm.com/beatblender-128-mp3' },
    { name: '☕ Coffeehouse (acoustic)', url: 'https://ice1.somafm.com/cliqhop-128-mp3' },
  ];

  const css = `
  #smx-btn{position:fixed;right:18px;bottom:18px;z-index:99998;width:52px;height:52px;border:none;border-radius:50%;
    background:linear-gradient(135deg,#5865f2,#37d0a0);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.4)}
  #smx-btn.playing{animation:smxpulse 1.4s infinite}
  @keyframes smxpulse{50%{box-shadow:0 6px 26px rgba(55,208,160,.8)}}
  #smx-panel{position:fixed;right:18px;bottom:80px;z-index:99998;width:270px;background:#0e1c2c;color:#e8f0ff;
    border:1px solid #1e3a55;border-radius:14px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.5);display:none;font-family:'Segoe UI',system-ui,sans-serif}
  #smx-panel.open{display:block}
  #smx-panel h4{margin:0 0 10px;font-size:14px;display:flex;align-items:center;gap:8px}
  #smx-panel select{width:100%;padding:8px;border-radius:8px;background:#16283d;color:#e8f0ff;border:1px solid #1e3a55;font-size:13px}
  #smx-row{display:flex;align-items:center;gap:10px;margin-top:10px}
  #smx-play{flex:0 0 auto;width:44px;height:44px;border:none;border-radius:10px;background:#22c55e;color:#04121f;font-size:18px;cursor:pointer;font-weight:800}
  #smx-play.on{background:#ef4444;color:#fff}
  #smx-loop{flex:0 0 auto;width:40px;height:44px;border:none;border-radius:10px;background:#16283d;color:#6d90b3;font-size:16px;cursor:pointer}
  #smx-loop.on{background:#5865f2;color:#fff}
  #smx-vol{flex:1}
  #smx-now{margin-top:8px;font-size:12px;color:#6d90b3;min-height:16px}
  #smx-panel a{color:#37d0a0;font-size:11px;text-decoration:none}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = parseFloat(localStorage.getItem('smx-vol') || '0.5');

  const btn = document.createElement('button');
  btn.id = 'smx-btn';
  btn.title = 'Music';
  btn.textContent = '🎵';
  btn.setAttribute('aria-label', 'Toggle music player');

  const panel = document.createElement('div');
  panel.id = 'smx-panel';
  panel.innerHTML =
    '<h4>🎵 Sentinel Radio</h4>' +
    '<select id="smx-sel"></select>' +
    '<div id="smx-row"><button id="smx-play" aria-label="Play or pause">▶</button>' +
    '<button id="smx-loop" aria-label="Toggle loop" title="Loop — keep playing / auto-reconnect">🔁</button>' +
    '<input id="smx-vol" type="range" min="0" max="1" step="0.05" aria-label="Volume"></div>' +
    '<div id="smx-now">Paused</div>' +
    '<a href="https://somafm.com" target="_blank" rel="noopener">Streams by SomaFM — commercial-free radio</a>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const sel = panel.querySelector('#smx-sel');
  const play = panel.querySelector('#smx-play');
  const vol = panel.querySelector('#smx-vol');
  const now = panel.querySelector('#smx-now');
  const loop = panel.querySelector('#smx-loop');
  let wantPlaying = false;
  let looping = localStorage.getItem('smx-loop') === '1';
  if (looping) loop.classList.add('on');
  STATIONS.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = s.name;
    sel.appendChild(o);
  });
  sel.value = localStorage.getItem('smx-station') || '0';
  vol.value = audio.volume;

  function label() { return STATIONS[+sel.value]?.name || ''; }
  function start() {
    wantPlaying = true;
    audio.src = STATIONS[+sel.value].url;
    audio.play().then(() => {
      play.textContent = '⏸'; play.classList.add('on'); btn.classList.add('playing');
      now.textContent = '▶ ' + label() + (looping ? '  🔁' : '');
    }).catch(() => {
      now.textContent = looping ? '🔁 Reconnecting…' : '⚠️ Could not start stream.';
      if (looping && wantPlaying) setTimeout(() => { if (looping && wantPlaying) start(); }, 3000);
    });
  }
  function stop() {
    wantPlaying = false;
    audio.pause(); play.textContent = '▶'; play.classList.remove('on'); btn.classList.remove('playing');
    now.textContent = 'Paused';
  }

  btn.onclick = () => panel.classList.toggle('open');
  play.onclick = () => (audio.paused ? start() : stop());
  sel.onchange = () => { localStorage.setItem('smx-station', sel.value); if (!audio.paused) start(); };
  vol.oninput = () => { audio.volume = +vol.value; localStorage.setItem('smx-vol', vol.value); };
  loop.onclick = () => {
    looping = !looping;
    loop.classList.toggle('on', looping);
    localStorage.setItem('smx-loop', looping ? '1' : '0');
    if (!audio.paused) now.textContent = '▶ ' + label() + (looping ? '  🔁' : '');
    else now.textContent = looping ? '🔁 Loop on — auto-reconnects' : 'Paused';
  };
  // When loop is on, a dropped / stalled / ended stream silently restarts itself.
  audio.onerror = () => {
    if (looping && wantPlaying) { now.textContent = '🔁 Reconnecting…'; setTimeout(() => { if (looping && wantPlaying) start(); }, 2000); }
    else now.textContent = '⚠️ Stream error — try another station.';
  };
  audio.onended = () => { if (looping && wantPlaying) start(); };
})();
