// SFX — a tiny synthesized sound engine (Web Audio, no audio files). Gives the
// dashboard real UI feedback: clicks, blips, confirms, errors, alerts, a bodycam
// power beep-boop, and a dispatch siren. Autoplay policy means audio only starts
// after the first user gesture, so we lazily create the context on demand.
(function () {
  if (window.SFX) return;
  let ctx = null;
  let master = null;
  let muted = localStorage.getItem('sfx-muted') === '1';

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur = 0.12, type = 'sine', gain = 0.12, when = 0) {
    if (muted) return;
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(master);
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function sweep(f1, f2, dur = 0.25, type = 'sawtooth', gain = 0.1, when = 0) {
    if (muted) return;
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.connect(g);
    g.connect(master);
    const t = c.currentTime + when;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  const SFX = {
    ctx: ac,
    isMuted: () => muted,
    toggleMute() { muted = !muted; localStorage.setItem('sfx-muted', muted ? '1' : '0'); if (master) master.gain.value = muted ? 0 : 0.9; return muted; },
    click() { tone(620, 0.045, 'square', 0.05); },
    blip() { tone(900, 0.05, 'sine', 0.06); },
    hover() { tone(1200, 0.03, 'sine', 0.025); },
    confirm() { tone(587, 0.08, 'sine', 0.09); tone(880, 0.1, 'sine', 0.09, 0.07); },
    error() { tone(190, 0.18, 'sawtooth', 0.11); tone(120, 0.22, 'sawtooth', 0.09, 0.05); },
    alert() { tone(988, 0.09, 'square', 0.09); tone(988, 0.09, 'square', 0.09, 0.16); tone(988, 0.09, 'square', 0.09, 0.32); },
    powerOn() { sweep(160, 1200, 0.55, 'sawtooth', 0.09); tone(1320, 0.16, 'sine', 0.07, 0.5); tone(1760, 0.12, 'sine', 0.05, 0.62); },
    powerOff() { sweep(1200, 150, 0.5, 'sawtooth', 0.09); },
    // Real bodycam-style two-tone power beeps.
    bodycamOn() { tone(784, 0.11, 'square', 0.12); tone(1175, 0.16, 'square', 0.12, 0.13); },
    bodycamOff() { tone(1175, 0.1, 'square', 0.1); tone(587, 0.18, 'square', 0.1, 0.12); },
    // Dispatch siren: a short alternating wail.
    siren() {
      for (let i = 0; i < 4; i++) sweep(660, 1050, 0.28, 'sawtooth', 0.08, i * 0.28);
    },
    tone, sweep,
  };
  window.SFX = SFX;

  // Auto-wire generic UI sounds once the DOM is ready. Elements can opt out with
  // [data-nosfx] (used where a page wants a custom sound instead).
  function wire() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button, .hbtn, a.dl');
      if (b && !b.hasAttribute('data-nosfx')) SFX.click();
    }, true);
    document.addEventListener('change', (e) => {
      if (e.target.matches('select, input[type=checkbox]') && !e.target.hasAttribute('data-nosfx')) SFX.blip();
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
