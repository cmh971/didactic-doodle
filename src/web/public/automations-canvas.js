/* Blockly visual canvas for Automations (Phase 2).
   Drag a ▶ trigger, snap actions under it → we walk the blocks and produce the
   exact same { trigger, actions } JSON the automations engine already runs.
   Safe by design: blocks map to prebuilt actions only — no raw code, ever.
   Relies on globals from app.js (api, state, toast, confetti, renderAuList). */
(function () {
  'use strict';
  let workspace = null;
  let chans = [];
  let roles = [];

  const chanOptions = () => (chans.length ? chans.map((c) => ['#' + c.name, String(c.id)]) : [['(no channels)', '']]);
  const roleOptions = () => (roles.length ? roles.map((r) => [r.name, String(r.id)]) : [['(no roles)', '']]);

  function defineBlocks() {
    if (window.__auBlocksDefined) return;
    window.__auBlocksDefined = true;
    Blockly.defineBlocksWithJsonArray([
      { type: 'when_message', message0: '▶ When message %1 %2', args0: [
        { type: 'field_dropdown', name: 'MATCH', options: [['contains', 'contains'], ['is exactly', 'exact'], ['starts with', 'startsWith']] },
        { type: 'field_input', name: 'TEXT', text: 'hi' }], nextStatement: null, colour: 210, tooltip: 'Fires when someone sends a matching message' },
      { type: 'when_join', message0: '▶ When a member joins', nextStatement: null, colour: 210 },
      { type: 'when_leave', message0: '▶ When a member leaves', nextStatement: null, colour: 210 },
      { type: 'act_reply', message0: '↩ reply %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'hi back {user}!' }], previousStatement: null, nextStatement: null, colour: 160 },
      { type: 'act_send', message0: '📨 send %1 to %2', args0: [{ type: 'field_input', name: 'TEXT', text: 'hello' }, { type: 'field_dropdown', name: 'CH', options: chanOptions }], previousStatement: null, nextStatement: null, colour: 160 },
      { type: 'act_embed', message0: '🖼 embed title %1 text %2', args0: [{ type: 'field_input', name: 'TITLE', text: 'Title' }, { type: 'field_input', name: 'TEXT', text: 'Description {user}' }], previousStatement: null, nextStatement: null, colour: 160 },
      { type: 'act_dm', message0: '✉ DM the user %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'hi {user}' }], previousStatement: null, nextStatement: null, colour: 160 },
      { type: 'act_react', message0: '😀 react %1', args0: [{ type: 'field_input', name: 'EMOJI', text: '👍' }], previousStatement: null, nextStatement: null, colour: 160 },
      { type: 'act_addrole', message0: '➕ add role %1', args0: [{ type: 'field_dropdown', name: 'ROLE', options: roleOptions }], previousStatement: null, nextStatement: null, colour: 40 },
      { type: 'act_removerole', message0: '➖ remove role %1', args0: [{ type: 'field_dropdown', name: 'ROLE', options: roleOptions }], previousStatement: null, nextStatement: null, colour: 40 },
      { type: 'act_nick', message0: '🏷 set nickname %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'New Nick' }], previousStatement: null, nextStatement: null, colour: 40 },
      { type: 'act_timeout', message0: '🔇 timeout user %1 s', args0: [{ type: 'field_number', name: 'SEC', value: 60, min: 1, max: 600 }], previousStatement: null, nextStatement: null, colour: 0 },
      { type: 'act_delete', message0: '🗑 delete the message', previousStatement: null, nextStatement: null, colour: 0 },
      { type: 'act_pin', message0: '📌 pin the message', previousStatement: null, nextStatement: null, colour: 0 },
      { type: 'act_random', message0: '🎲 reply random of %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'yes|no|maybe' }], previousStatement: null, nextStatement: null, colour: 290 },
      { type: 'act_dice', message0: '🎲 roll a %1-sided die', args0: [{ type: 'field_number', name: 'SIDES', value: 6, min: 2, max: 100 }], previousStatement: null, nextStatement: null, colour: 290 },
      { type: 'act_ai', message0: '🤖 AI reply to %1', args0: [{ type: 'field_input', name: 'PROMPT', text: '{content}' }], previousStatement: null, nextStatement: null, colour: 230 },
      { type: 'act_weather', message0: '🌤 weather for %1', args0: [{ type: 'field_input', name: 'LOC', text: '{args}' }], previousStatement: null, nextStatement: null, colour: 190 },
      { type: 'act_translate', message0: '🌍 translate to %1', args0: [{ type: 'field_input', name: 'TO', text: 'Spanish' }], previousStatement: null, nextStatement: null, colour: 190 },
      { type: 'act_wait', message0: '⏳ wait %1 seconds', args0: [{ type: 'field_number', name: 'SEC', value: 3, min: 1, max: 30 }], previousStatement: null, nextStatement: null, colour: 20 },
    ]);
  }

  // Each category is a "library" (a pack of blocks), like Scratch extensions.
  const TOOLBOX = {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: '📚 Triggers', colour: 210, contents: [{ kind: 'block', type: 'when_message' }, { kind: 'block', type: 'when_join' }, { kind: 'block', type: 'when_leave' }] },
      { kind: 'category', name: '📚 Messages', colour: 160, contents: [{ kind: 'block', type: 'act_reply' }, { kind: 'block', type: 'act_send' }, { kind: 'block', type: 'act_embed' }, { kind: 'block', type: 'act_dm' }, { kind: 'block', type: 'act_react' }] },
      { kind: 'category', name: '📚 Roles', colour: 40, contents: [{ kind: 'block', type: 'act_addrole' }, { kind: 'block', type: 'act_removerole' }, { kind: 'block', type: 'act_nick' }] },
      { kind: 'category', name: '📚 Moderation', colour: 0, contents: [{ kind: 'block', type: 'act_timeout' }, { kind: 'block', type: 'act_delete' }, { kind: 'block', type: 'act_pin' }] },
      { kind: 'category', name: '📚 Fun', colour: 290, contents: [{ kind: 'block', type: 'act_random' }, { kind: 'block', type: 'act_dice' }] },
      { kind: 'category', name: '📚 AI', colour: 230, contents: [{ kind: 'block', type: 'act_ai' }] },
      { kind: 'category', name: '📚 Integrations', colour: 190, contents: [{ kind: 'block', type: 'act_weather' }, { kind: 'block', type: 'act_translate' }] },
      { kind: 'category', name: '📚 Timing', colour: 20, contents: [{ kind: 'block', type: 'act_wait' }] },
    ],
  };

  // Walk the workspace → { trigger, actions } (or { error }).
  function generate() {
    const TRIG = { when_message: 1, when_join: 1, when_leave: 1 };
    const tops = workspace.getTopBlocks(true).filter((b) => TRIG[b.type]);
    if (!tops.length) return { error: 'Add a ▶ When… trigger block to start.' };
    const top = tops[0];
    let trigger;
    if (top.type === 'when_message') trigger = { type: 'message_contains', matchType: top.getFieldValue('MATCH'), text: top.getFieldValue('TEXT'), channelId: null };
    else if (top.type === 'when_leave') trigger = { type: 'member_leave' };
    else trigger = { type: 'member_join' };
    if (trigger.type === 'message_contains' && !String(trigger.text || '').trim()) return { error: 'Give the message trigger some text to match.' };

    const actions = [];
    let b = top.getNextBlock();
    while (b && actions.length < 10) {
      const t = b.type;
      if (t === 'act_reply') actions.push({ type: 'reply', text: b.getFieldValue('TEXT') });
      else if (t === 'act_send') actions.push({ type: 'send', text: b.getFieldValue('TEXT'), channelId: b.getFieldValue('CH') });
      else if (t === 'act_embed') actions.push({ type: 'send_embed', title: b.getFieldValue('TITLE'), description: b.getFieldValue('TEXT'), channelId: null, color: '#5865f2' });
      else if (t === 'act_dm') actions.push({ type: 'dm', text: b.getFieldValue('TEXT') });
      else if (t === 'act_react') actions.push({ type: 'react', emoji: b.getFieldValue('EMOJI') });
      else if (t === 'act_addrole') actions.push({ type: 'add_role', roleId: b.getFieldValue('ROLE') });
      else if (t === 'act_removerole') actions.push({ type: 'remove_role', roleId: b.getFieldValue('ROLE') });
      else if (t === 'act_nick') actions.push({ type: 'set_nickname', text: b.getFieldValue('TEXT') });
      else if (t === 'act_timeout') actions.push({ type: 'timeout', seconds: Number(b.getFieldValue('SEC')) });
      else if (t === 'act_delete') actions.push({ type: 'delete_message' });
      else if (t === 'act_pin') actions.push({ type: 'pin_message' });
      else if (t === 'act_random') actions.push({ type: 'random_reply', text: b.getFieldValue('TEXT') });
      else if (t === 'act_dice') actions.push({ type: 'dice', sides: Number(b.getFieldValue('SIDES')) });
      else if (t === 'act_ai') actions.push({ type: 'ai_reply', prompt: b.getFieldValue('PROMPT') });
      else if (t === 'act_weather') actions.push({ type: 'weather', location: b.getFieldValue('LOC') });
      else if (t === 'act_translate') actions.push({ type: 'translate', to: b.getFieldValue('TO') });
      else if (t === 'act_wait') actions.push({ type: 'wait', seconds: Number(b.getFieldValue('SEC')) });
      b = b.getNextBlock();
    }
    if (!actions.length) return { error: 'Snap at least one action under the trigger.' };
    return { trigger, actions };
  }

  // Build a single action block from a preset action spec.
  function actionToBlock(a) {
    const w = workspace;
    const mk = (type, fields) => { const b = w.newBlock(type); if (fields) Object.entries(fields).forEach(([k, v]) => { try { b.setFieldValue(v, k); } catch (e) { /* ignore */ } }); return b; };
    switch (a.type) {
      case 'reply': return mk('act_reply', { TEXT: String(a.text || '') });
      case 'react': return mk('act_react', { EMOJI: String(a.emoji || '👍') });
      case 'send_embed': return mk('act_embed', { TITLE: String(a.title || ''), TEXT: String(a.description || '') });
      case 'dm': return mk('act_dm', { TEXT: String(a.text || '') });
      case 'random_reply': return mk('act_random', { TEXT: String(a.text || '') });
      case 'dice': return mk('act_dice', { SIDES: Number(a.sides) || 6 });
      case 'ai_reply': return mk('act_ai', { PROMPT: String(a.prompt || '{content}') });
      case 'weather': return mk('act_weather', { LOC: String(a.location || '{args}') });
      case 'translate': return mk('act_translate', { TO: String(a.to || 'Spanish') });
      case 'set_nickname': return mk('act_nick', { TEXT: String(a.text || '') });
      case 'timeout': return mk('act_timeout', { SEC: Number(a.seconds) || 60 });
      case 'wait': return mk('act_wait', { SEC: Number(a.seconds) || 3 });
      case 'delete_message': return mk('act_delete');
      case 'pin_message': return mk('act_pin');
      default: return null;
    }
  }

  window.AutomationCanvas = {
    // Drop a Library preset onto the canvas as real blocks.
    loadPreset(spec) {
      if (!workspace || !spec) return;
      workspace.clear();
      const trig = spec.trigger || { type: 'member_join' };
      let tb;
      if (trig.type === 'message_contains') { tb = workspace.newBlock('when_message'); try { tb.setFieldValue(trig.matchType || 'contains', 'MATCH'); } catch (e) { /* */ } try { tb.setFieldValue(String(trig.text || ''), 'TEXT'); } catch (e) { /* */ } }
      else if (trig.type === 'member_leave') tb = workspace.newBlock('when_leave');
      else tb = workspace.newBlock('when_join');
      tb.initSvg(); tb.render(); tb.moveBy(30, 30);
      let prev = tb;
      for (const a of (spec.actions || [])) {
        const b = actionToBlock(a);
        if (!b) continue;
        b.initSvg(); b.render();
        try { prev.nextConnection.connect(b.previousConnection); } catch (e) { /* */ }
        prev = b;
      }
      const nameEl = document.getElementById('au-canvas-name');
      if (nameEl) nameEl.value = spec.name || '';
    },
    init(channels, guildRoles) {
      chans = channels || []; roles = guildRoles || [];
      const host = document.getElementById('au-canvas');
      if (!host) return;
      let tries = 0;
      const attempt = () => {
        // The Blockly script may still be downloading — wait up to ~6s for it.
        if (typeof Blockly === 'undefined') {
          if (tries++ < 60) return setTimeout(attempt, 100);
          host.innerHTML = '<p class="muted" style="padding:12px">The visual canvas library couldn’t load (connection or ad-blocker). The 📚 Libraries panel and the simple builder below still work perfectly.</p>';
          return;
        }
        try {
          defineBlocks();
          if (workspace) { try { workspace.dispose(); } catch (e) { /* ignore */ } }
          host.innerHTML = '';
          const theme = (Blockly.Themes && Blockly.Themes.Dark) ? Blockly.Themes.Dark : undefined;
          workspace = Blockly.inject(host, { toolbox: TOOLBOX, trashcan: true, theme, grid: { spacing: 22, length: 3, colour: '#2a2f3a', snap: true }, zoom: { controls: true, wheel: true } });
          // Force-resize a few times — the container was hidden until the view opened.
          const resize = () => { try { Blockly.svgResize(workspace); } catch (e) { /* ignore */ } };
          requestAnimationFrame(resize);
          [80, 250, 600].forEach((ms) => setTimeout(resize, ms));
          if (!window.__auResizeHook) { window.__auResizeHook = true; window.addEventListener('resize', () => { if (workspace) resize(); }); }
        } catch (e) {
          host.innerHTML = '<p class="muted" style="padding:12px">Canvas failed to start: ' + (e && e.message || e) + '. Use the simple builder below.</p>';
        }
      };
      attempt();
    },
    async save(name) {
      if (!workspace) return (typeof toast === 'function') && toast('Canvas not ready', 'error');
      const r = generate();
      if (r.error) return toast(r.error, 'error');
      try {
        await api('/api/guild/' + state.guild + '/automations', { method: 'POST', body: JSON.stringify({ name: name || 'Canvas automation', trigger: r.trigger, actions: r.actions }) });
        toast('Automation saved from canvas ✅', 'success');
        if (typeof confetti === 'function') confetti(40);
        if (typeof renderAuList === 'function') renderAuList();
      } catch (e) { toast(e.message || 'Could not save', 'error'); }
    },
  };
})();
