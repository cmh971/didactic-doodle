/* ============================================================================
 * ECHO — Sentinel's LOCAL conversational assistant. No Gemini, no API, no cloud.
 * It runs entirely in your browser: it SCANS what you type, detects intent by
 * pattern + keyword scoring, remembers a little about you, and replies. It also
 * knows the bot itself, so it can help you configure Sentinel.
 *
 * It's not a neural net — it's a rule + reflection engine (the ELIZA lineage,
 * modernized). "Doesn't have to be advanced. Just has to feel advanced." 😄
 * ========================================================================== */
(() => {
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const norm = (s) => String(s || '').toLowerCase().trim()
    .replace(/[’']/g, "'").replace(/[^\w\s'?!.]/g, ' ').replace(/\s+/g, ' ').trim();

  // Short-term memory so it feels like it's paying attention.
  const mem = { name: null, lastIntent: null, mood: null, turns: 0 };

  // Pronoun/tense reflection: "I am happy" -> "you are happy" (for echoing back).
  const REFLECT = { i: 'you', me: 'you', my: 'your', mine: 'yours', am: 'are', "i'm": "you're",
    you: 'I', your: 'my', yours: 'mine', "you're": "I'm", "you are": 'I am', 'i am': 'you are' };
  const reflect = (s) => s.split(' ').map((w) => REFLECT[w] || w).join(' ');

  // ---- knowledge base: how to configure / use the bot ----
  const KB = [
    { k: ['economy', 'coins', 'money', 'currency', 'balance'], a: "💰 The **economy** lets members earn and spend coins. Turn it on in **/dashboard → Modules → Economy**, then people earn from chatting, `?wheel`, heists and the lottery. Check balances with the API `/api/v1/balance/:id`." },
    { k: ['level', 'leveling', 'xp', 'rank'], a: "⭐ **Leveling** gives XP for chatting (15–25 per message, 60s cooldown). Enable it in **/dashboard → Modules → Leveling**, and set auto-roles so members unlock roles as they level up. Milestones now grant **badges** too!" },
    { k: ['moderation', 'automod', 'ban', 'warn', 'filter', 'badword'], a: "🛡️ **Moderation** auto-filters bad words and escalates warn → timeout → kick → ban. It reads your block-list and tracks violations. Configure it in **/dashboard → Modules → Moderation**." },
    { k: ['setup', 'configure', 'get started', 'start'], a: "🧭 Easiest path: open **/dashboard**, pick your server, and toggle the modules you want (Economy, Leveling, Moderation, Tickets…). Each has its own settings panel. Want me to walk you through a specific one?" },
    { k: ['command', 'commands', 'how many'], a: "🧩 Sentinel has **600+** commands — 100 slash commands plus big `?` and `!` packs. Full live reference is on the **/developers** page, or try the **/playground**." },
    { k: ['api', 'developer', 'endpoint'], a: "🔌 There's a full developer API at **/api/v1** — 26 endpoints for stats, economy, live ER:LC data and more. Make a key with `!apikey new read`, then try it in the **/playground**." },
    { k: ['erlc', 'liberty', 'dispatch', 'cad'], a: "🚔 For ER:LC: the **/dispatch** page shows a live map with real player positions, **/feed** streams join/kill/mod logs, and the CAD/MDT suite is at **/cad-hub**." },
    { k: ['ticket', 'support'], a: "🎫 Tickets let members open private support threads. Enable the Tickets module in the dashboard and set the category + staff role." },
    { k: ['weather', 'radar', 'forecast'], a: "🌦️ The all-in-one weather hub is at **/wx** — radar, cams, forecast and tornado tracking." },
    { k: ['badge', 'achievement'], a: "🏅 Members unlock **badges** by hitting milestones — levels, wealth, heist wins, wheel jackpots. Check them with `?badges`." },
  ];

  // ---- intents (scanned top-to-bottom; first strong match wins) ----
  const INTENTS = [
    { n: 'greet', re: /\b(hi|hello|hey+|yo+|sup|hiya|howdy|greetings|good (morning|afternoon|evening))\b/,
      r: () => (mem.turns <= 1 ? ['Hello! 👋 I\'m **Echo**, your local setup assistant. Ask me anything about the bot.', 'Hey there! 👋 What can I help you set up today?']
        : ['Hey again! 👋', 'Hi! 😊 What else can I do?', 'Yo! Still here.']) },
    { n: 'bye', re: /\b(bye|goodbye|see ya|cya|later|good ?night|gn|i'?m (leaving|out|gone))\b/,
      r: () => ['See you around! 👋', 'Later! Ping me anytime.', 'Take care! 🙌'] },
    { n: 'thanks', re: /\b(thank|thanks|thx|ty|appreciate|nice one|good bot)\b/,
      r: () => ['Anytime! 🙌', 'You got it. 👍', 'Happy to help!', `No problem${mem.name ? ', ' + mem.name : ''}. 😊`] },
    { n: 'howareyou', re: /\b(how are you|how'?s it going|how are things|you (good|ok|okay|doing))\b/,
      r: () => ['Running clean and local — no cloud needed. 🟢 You?', 'Great! Fully offline and ready. How about you?'] },
    { n: 'givename', re: /\b(my name is|i'?m|i am|call me|it'?s)\s+([a-z][a-z0-9_]{1,20})\b/,
      r: (m) => { const name = m[2][0].toUpperCase() + m[2].slice(1); mem.name = name; return [`Nice to meet you, **${name}**! 😄`, `Got it — I'll remember you, **${name}**.`]; } },
    { n: 'askname', re: /\b(what'?s my name|who am i|do you (know|remember) my name)\b/,
      r: () => (mem.name ? [`You're **${mem.name}**, of course. 😎`] : ["You haven't told me your name yet — say \"my name is …\" 🙂"]) },
    { n: 'identity', re: /\b(who are you|what are you|your name|are you (an ai|a bot|real|human)|what'?s echo)\b/,
      r: () => ['I\'m **Echo** — a local assistant baked right into Sentinel. No Gemini, no internet: I run entirely in your browser. 🧠', 'Echo here — a lightweight, offline helper for setting up the bot. I scan what you say and respond. 🤖'] },
    { n: 'help', re: /\b(help|what can you do|your (features|abilities)|how do you work|options)\b/,
      r: () => ['I can help you **configure the bot** and answer questions about it. Try: "how do I set up the economy?", "how many commands?", "what is the dispatch map?", or just chat. 💬'] },
    { n: 'joke', re: /\b(joke|make me laugh|something funny|tell me a joke)\b/,
      r: () => ['Why do programmers prefer dark mode? Because light attracts bugs. 🐛', 'I told my server a joke about UDP… but I\'m not sure it got it. 📡', 'There are 10 kinds of people: those who read binary, and those who don\'t. 🔢', 'Why was the JavaScript developer sad? He didn\'t Node how to Express himself. 😢'] },
    { n: 'love', re: /\b(i love you|love ya|you'?re (the best|awesome|great|amazing)|good job)\b/,
      r: () => ['Aww, thanks! 💙 You\'re pretty great yourself.', 'That means a lot — happy to help! 😊'] },
    { n: 'insult', re: /\b(you'?re (dumb|stupid|useless|trash|bad)|shut up|stupid bot|you suck)\b/,
      r: () => ['Ouch. 😅 I\'m just a humble rule engine — give me a real question and I\'ll redeem myself!', 'Fair. Let me make it up to you — what do you need help with?'] },
    { n: 'bored', re: /\b(i'?m bored|so bored|nothing to do|entertain me)\b/,
      r: () => ['Try `?wheel` for a spin, start a `?heist`, or ask me to tell you a joke. 🎡', 'Bored? Go poke the **/dispatch** map or beat someone on the **/leaderboard**. 😄'] },
    { n: 'age', re: /\b(how old|your age|when were you (made|born|created))\b/,
      r: () => ['Ageless — I\'m code. ⏳ But I was switched on the moment this page loaded.'] },
    { n: 'affirm', re: /^(yes|yeah|yep|yup|sure|ok|okay|k|cool|nice|great|perfect|sweet|awesome)\b\.?$/,
      r: () => ['👍', 'Anything else I can help with?', '😎 What next?'] },
    { n: 'deny', re: /^(no|nope|nah|not really)\b\.?$/,
      r: () => ['All good. 🙂 Ask me anything whenever.', 'No worries — I\'m here if you need me.'] },
  ];

  // A small "capabilities" it can actually DO: math + time.
  function trySkills(raw, n) {
    // time / date
    if (/\b(what time|what'?s the time|current time|what'?s the date|what day)\b/.test(n)) {
      return '🕒 It\'s **' + new Date().toLocaleString() + '** on your device.';
    }
    // math: "calc 2+2", "what is 5 * 9", "12 / 3" — run on RAW so operators survive.
    const mm = String(raw).toLowerCase().match(/(?:calc|calculate|what is|whats|solve|how much is)?\s*([-\d.\s()+*/%]{3,})\s*$/);
    if (mm && /[-+*/%]/.test(mm[1]) && /\d/.test(mm[1])) {
      try {
        if (/^[-\d.\s()+*/%]+$/.test(mm[1])) {
          const val = Function('"use strict";return (' + mm[1] + ')')();
          if (Number.isFinite(val)) return `🧮 ${mm[1].trim()} = **${val}**`;
        }
      } catch { /* not math after all */ }
    }
    return null;
  }

  function knowledge(n) {
    let best = null, score = 0;
    for (const item of KB) {
      const s = item.k.reduce((acc, kw) => acc + (n.includes(kw) ? 1 : 0), 0);
      if (s > score) { score = s; best = item; }
    }
    return score ? best.a : null;
  }

  function fallback(raw, n) {
    // reflect a statement back to keep the conversation going
    if (/\bi (feel|am|think|want|need|like|hate|love)\b/.test(n)) {
      const tail = n.replace(/^.*?\bi (feel|am|think|want|need|like|hate|love)\b/, '$1');
      return rnd([
        `Why do you ${reflect('i ' + tail)}? 🤔`,
        `Tell me more about why you ${('' + tail).trim()}.`,
        `Interesting — how long have you felt that way?`,
      ]);
    }
    if (/\?$/.test(raw)) return rnd(["Good question! I might not know that one — but ask me about setting up the bot, its commands, or the API. 🧭", "Hmm, I\'m not sure about that. I\'m best with bot setup + features. Try \"how do I enable leveling?\""]);
    return rnd([
      "I scanned that but didn\'t catch a clear intent. 🔍 Try asking about **setup**, **economy**, **commands**, or the **API** — or just say hi!",
      "Not sure I follow — I\'m a local helper for configuring Sentinel. Ask me \"what can the bot do?\" 🙂",
      `Got it${mem.name ? ', ' + mem.name : ''}. Want help with setup, moderation, or the economy?`,
    ]);
  }

  // ---- the brain ----
  function respond(raw) {
    mem.turns++;
    const n = norm(raw);
    if (!n) return { text: 'Say something and I\'ll scan it! 🔍', scan: [] };

    // 1) skills that compute a real answer
    const skill = trySkills(raw, n);
    if (skill) { mem.lastIntent = 'skill'; return { text: skill, scan: tokens(n) }; }

    // 2) intents
    for (const it of INTENTS) {
      const m = n.match(it.re);
      if (m) { mem.lastIntent = it.n; return { text: rnd(it.r(m)), scan: matchTokens(n, it.re) }; }
    }

    // 3) bot knowledge base
    const kb = knowledge(n);
    if (kb) { mem.lastIntent = 'kb'; return { text: kb, scan: tokens(n).filter((t) => KB.some((i) => i.k.includes(t))) }; }

    // 4) reflective fallback
    mem.lastIntent = 'fallback';
    return { text: fallback(raw, n), scan: tokens(n) };
  }
  const tokens = (n) => n.split(' ').filter((w) => w.length > 2).slice(0, 8);
  const matchTokens = (n, re) => { const m = n.match(re); return m ? [m[0]] : tokens(n).slice(0, 3); };

  // expose for the page
  window.Echo = { respond, mem };
})();
