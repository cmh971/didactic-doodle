// projnav.js — a shared floating navigation dock for the side-project pages.
// Self-injecting: just add <script src="/projnav.js" defer></script> to any page and
// a little pill appears bottom-center to hop between projects. Highlights the page
// you're on. Pure vanilla JS, no dependencies.
(function () {
  if (window.__projnav) return;
  window.__projnav = true;

  const LINKS = [
    { href: '/projects', label: 'Projects', emoji: '🏠' },
    { href: '/weather-panel', label: 'Weather', emoji: '🌤️' },
    { href: '/tornado-panel', label: 'Tornado', emoji: '🌪️' },
    { href: '/radar-panel', label: 'Radar', emoji: '📡' },
  ];

  const here = (location.pathname.replace(/\/+$/, '') || '/projects').toLowerCase();

  const css = `
  #projnav {
    position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
    z-index: 99999; display: flex; gap: 4px; padding: 6px;
    border-radius: 999px; background: rgba(11,16,32,.82);
    border: 1px solid rgba(31,42,68,.9); backdrop-filter: blur(14px);
    box-shadow: 0 12px 34px rgba(0,0,0,.55);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  #projnav a {
    display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px;
    border-radius: 999px; text-decoration: none; color: #93a1c0;
    font-size: 13px; font-weight: 700; white-space: nowrap;
    transition: color .15s ease, background .15s ease, transform .1s ease;
  }
  #projnav a:hover { color: #e8eefc; background: rgba(88,101,242,.16); }
  #projnav a:active { transform: translateY(1px); }
  #projnav a.active { color: #04121f; background: linear-gradient(135deg, #5865f2, #37d0a0); box-shadow: 0 6px 16px rgba(55,208,160,.4); }
  #projnav .pn-emoji { font-size: 15px; }
  @media (max-width: 520px) { #projnav a .pn-label { display: none; } #projnav a { padding: 10px 12px; } }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.id = 'projnav';
  nav.setAttribute('aria-label', 'Side projects');
  nav.innerHTML = LINKS.map((l) => {
    const active = here === l.href.toLowerCase() ? ' class="active"' : '';
    return `<a href="${l.href}"${active}><span class="pn-emoji">${l.emoji}</span><span class="pn-label">${l.label}</span></a>`;
  }).join('');
  document.body.appendChild(nav);
})();
