// icons.js — a crisp SVG icon set (30+). Better than PNG: scalable, sharp on any
// screen, themeable via currentColor, zero image files. Use anywhere with:
//   <span data-ic="shield"></span>   → auto-replaced with the SVG on load.
(function () {
  const S = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="1em" height="1em" style="vertical-align:-.14em">${inner}</svg>`;
  const ICONS = {
    dashboard: S('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    shield: S('<path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/>'),
    coin: S('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M14 10a2 2 0 00-2-2h-.5a1.5 1.5 0 000 3h1a1.5 1.5 0 010 3H12a2 2 0 01-2-2"/>'),
    ticket: S('<path d="M4 8a2 2 0 012-2h12a2 2 0 012 2 2 2 0 000 4 2 2 0 010 4H6a2 2 0 01-2-2 2 2 0 000-4z"/><path d="M14 6v12"/>'),
    chart: S('<path d="M3 21h18"/><rect x="5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="16" y="9" width="3" height="9" rx="1"/>'),
    ai: S('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/><circle cx="12" cy="12" r="1.5"/>'),
    bolt: S('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>'),
    gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'),
    search: S('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>'),
    bell: S('<path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/>'),
    siren: S('<path d="M5 20h14M7 20v-6a5 5 0 0110 0v6M12 3v2M4 8l1.5 1M20 8l-1.5 1"/>'),
    map: S('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    car: S('<path d="M5 13l1.5-4.5A2 2 0 018.4 7h7.2a2 2 0 011.9 1.5L19 13M4 13h16v4H4z"/><circle cx="7.5" cy="17.5" r="1.2"/><circle cx="16.5" cy="17.5" r="1.2"/>'),
    badge: S('<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-2 5 2-1.5-7.5"/>'),
    book: S('<path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2z"/><path d="M4 19a2 2 0 012-2h12"/>'),
    code: S('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14"/>'),
    robot: S('<rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M4 12H3M21 12h-1"/>'),
    cloud: S('<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1A3.5 3.5 0 0117 18z"/>'),
    radar: S('<circle cx="12" cy="12" r="9"/><path d="M12 12l6-3M12 12V4"/><circle cx="12" cy="12" r="1"/>'),
    tornado: S('<path d="M3 5h18M5 9h14M8 13h8M10 17h4M12 21h1"/>'),
    camera: S('<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M8 7l1.5-2h5L16 7"/>'),
    lock: S('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 118 0v3"/>'),
    rocket: S('<path d="M5 15c-1 1-1 4-1 4s3 0 4-1M9 15l-3-3a10 10 0 0110-8 10 10 0 01-2 12z"/><circle cx="14" cy="9" r="1.4"/>'),
    star: S('<path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.8l1-6L3.3 9.4l6-.9z"/>'),
    heart: S('<path d="M12 20s-7-4.5-9.5-9A4.5 4.5 0 0112 5a4.5 4.5 0 019.5 6C19 15.5 12 20 12 20z"/>'),
    check: S('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
    warning: S('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>'),
    keyboard: S('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/>'),
    gamepad: S('<rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 12h3M8.5 10.5v3M15.5 11h.01M18 13h.01"/>'),
    discord: S('<path d="M6 8a13 13 0 0112 0c1.6 2.6 2 6.4 1.5 9.5a11 11 0 01-3 1.5l-1-1.6M6 8c-1.6 2.6-2 6.4-1.5 9.5a11 11 0 003 1.5l1-1.6"/><path d="M9.5 13h.01M14.5 13h.01"/>'),
    google: S('<path d="M20.5 12.2A8 8 0 1017 18"/><path d="M20.5 12.2H12"/>'),
    users: S('<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0112 0M16 5.5a3.5 3.5 0 010 6M15 14.5a6 6 0 016 5.5"/>'),
    palette: S('<path d="M12 3a9 9 0 000 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5.5-1.5 2-1.5H18a3 3 0 003-3 8 8 0 00-9-6z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>'),
    globe: S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>'),
  };
  window.ICONS = ICONS;
  window.injectIcons = function (root = document) {
    root.querySelectorAll('[data-ic]').forEach((el) => {
      const svg = ICONS[el.getAttribute('data-ic')];
      if (svg && !el.dataset.icDone) { el.innerHTML = svg; el.dataset.icDone = '1'; }
    });
  };
  if (document.readyState !== 'loading') window.injectIcons(); else addEventListener('DOMContentLoaded', () => window.injectIcons());
})();
