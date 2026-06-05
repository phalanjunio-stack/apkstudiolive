/* ============================================
   SWITCHER — réplica do mockup (kivo_studio_live_switcher.html), ligado no motor real.
   Modal MOVE os monitores reais (PREVIEW/PROGRAM) → vídeo + camadas de verdade.
   Matriz 1-9 = FONTES por ordem · vermelho corta no ar · verde manda pro preview.
   TAKE/AUTO = Studio.take/fadeTake. "Destacar" = janela espelhada (2ª tela).
   ============================================ */
(function () {
  const ST = () => window.Studio;
  let modal, progRow = [], prevRow = [], legends = [], prevHome = null, pgmHome = null, tick = 0, popup = null;
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const srcList = () => { try { return ST().sourcesInfo().list || []; } catch (e) { return []; } };
  const state = () => { try { return ST().state(); } catch (e) { return {}; } };

  // ícones (inline, sem dependência)
  const I = {
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    sw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="9" height="7" rx="1.5"/><rect x="13" y="4" width="9" height="7" rx="1.5"/><path d="M6.5 15v2.5M17.5 15v2.5M6.5 20h11"/></svg>',
    type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
  };

  function build() {
    modal = el('div'); modal.id = 'switcherModal'; modal.hidden = true;
    modal.innerHTML =
      '<div class="sw-head">' +
        '<div class="l">' +
          '<div class="sw-logo"><i>' + I.layers + '</i> Kivo Studio</div>' +
          '<div class="sw-vsep"></div>' +
          '<span class="sw-chip" id="swProj">Switcher · Mesa de corte</span>' +
        '</div>' +
        '<div class="r">' +
          '<div class="sw-rec"><span class="k">Gravação</span><span class="v" id="swClock">00:00:00</span></div>' +
          '<div class="sw-vsep"></div>' +
          '<button class="sw-hbtn" id="swDetach">⧉ 2ª tela</button>' +
          '<div class="sw-onair off" id="swOnair"><span class="d"></span> NO AR</div>' +
          '<button class="sw-hbtn x" id="swClose" title="Fechar (ESC)">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="sw-body">' +
        '<aside class="sw-tools">' +
          '<button class="sw-tool" title="Monitores">' + I.play + '</button>' +
          '<button class="sw-tool on" title="Switcher">' + I.sw + '</button>' +
          '<button class="sw-tool" title="Textos">' + I.type + '</button>' +
          '<button class="sw-tool" title="Áudio">' + I.music + '</button>' +
        '</aside>' +
        '<main class="sw-main">' +
          '<div class="sw-monitors">' +
            '<div class="sw-slot"><div class="sw-slot-top"><span class="sw-tag preview">PREVIEW</span><span class="sw-srclabel" id="swPrevLabel">—</span></div><div class="sw-mount preview" id="swPrevMount"></div></div>' +
            '<div class="sw-slot"><div class="sw-slot-top"><span class="sw-tag program">PROGRAM · NO AR</span><span class="sw-srclabel" id="swPgmLabel">—</span></div><div class="sw-mount program" id="swPgmMount"></div></div>' +
          '</div>' +
          '<div class="sw-cut">' +
            '<div class="sw-legends"><div class="lg-sp"></div><div class="lg-grid" id="swLegends"></div></div>' +
            '<div class="sw-cut-body">' +
              '<div class="sw-matrix">' +
                '<div class="sw-row"><span class="sw-rowlab program">Program</span><div class="sw-btns" id="swProgRow"></div></div>' +
                '<div class="sw-row"><span class="sw-rowlab preview">Preview</span><div class="sw-btns" id="swPrevRow"></div></div>' +
              '</div>' +
              '<div class="sw-take"><button class="sw-act auto" id="swAuto">AUTO (FADE)</button><button class="sw-act take" id="swTake">TAKE (CUT)</button></div>' +
            '</div>' +
          '</div>' +
        '</main>' +
        '<aside class="sw-insp">' +
          '<div class="sw-insp-h">' + I.sliders + '<span>Inspetor de Preview</span></div>' +
          '<div class="sw-insp-b">' +
            '<div class="sw-insp-card"><span class="k">Selecionado no Preview</span><span class="v" id="swInspTitle">—</span></div>' +
            '<div><span class="sw-insp-sec">Posicionar / Ajustar</span>' +
              '<div class="sw-insp-grid">' +
                '<div class="sw-insp-f"><span class="fk">Escala</span><span class="fv">100%</span></div>' +
                '<div class="sw-insp-f"><span class="fk">Rotação</span><span class="fv">0°</span></div>' +
                '<div class="sw-insp-f"><span class="fk">Posição X</span><span class="fv">0</span></div>' +
                '<div class="sw-insp-f"><span class="fk">Posição Y</span><span class="fv">0</span></div>' +
              '</div>' +
              '<div class="sw-joy"><span class="ch u">' + I.up + '</span><span class="ch d">' + I.down + '</span><span class="ch l">' + I.left + '</span><span class="ch r">' + I.right + '</span><span class="knob"><i></i></span></div>' +
            '</div>' +
            '<div class="sw-insp-div"></div>' +
            '<div class="sw-insp-txt dim" id="swTextEd"><span class="sw-insp-sec">Editar dados</span><input type="text" value="Nome do Jogador"><input type="text" value="Atacante"></div>' +
          '</div>' +
        '</aside>' +
      '</div>';
    document.body.appendChild(modal);
    // Motor de Grelha (Layouts) no topo da área central do Switcher
    if (window.Grid && window.Grid.makeBar) { const m = modal.querySelector('.sw-main'); m.insertBefore(window.Grid.makeBar(), m.firstChild); }
    const pr = modal.querySelector('#swProgRow'), pv = modal.querySelector('#swPrevRow'), lg = modal.querySelector('#swLegends');
    for (let n = 1; n <= 9; n++) {
      const b = el('button', 'sw-btn prog has', '<span class="n">' + n + '</span>'); b.onclick = () => cut('program', n); pr.appendChild(b); progRow[n] = b;
      const g = el('button', 'sw-btn prev has', '<span class="n">' + n + '</span>'); g.onclick = () => cut('preview', n); pv.appendChild(g); prevRow[n] = g;
      const l = el('div', 'lg', 'Fonte ' + n); lg.appendChild(l); legends[n] = l;
    }
    modal.querySelector('#swClose').onclick = close;
    modal.querySelector('#swDetach').onclick = detach;
    modal.querySelector('#swTake').onclick = () => { try { ST().take(); } catch (e) {} refresh(); };
    modal.querySelector('#swAuto').onclick = () => { try { (ST().fadeTake || ST().take)(); } catch (e) {} refresh(); };
  }

  function cut(bus, n) {
    const s = srcList()[n - 1]; if (!s) return;
    try { if (bus === 'program') ST().setProgram(s.id); else ST().setPreview(s.id); } catch (e) {}
    refresh();
  }

  function refresh() {
    if (!modal || modal.hidden) return;
    const list = srcList(), st = state();
    for (let n = 1; n <= 9; n++) {
      const s = list[n - 1], pb = progRow[n], gb = prevRow[n]; if (!pb) continue;
      const has = !!s; pb.classList.toggle('has', has); gb.classList.toggle('has', has);
      legends[n].textContent = has ? (s.label || ('Fonte ' + n)) : 'Fonte ' + n;
      pb.classList.toggle('on', has && st.program === s.id);
      gb.classList.toggle('on', has && st.preview === s.id);
    }
    const pgm = list.find(s => s.id === st.program), prv = list.find(s => s.id === st.preview);
    const set = (id, v) => { const e = modal.querySelector(id); if (e) e.textContent = v; };
    set('#swPgmLabel', pgm ? pgm.label : '—'); set('#swPrevLabel', prv ? prv.label : '—');
    set('#swInspTitle', prv ? prv.label : '—');
    const oa = modal.querySelector('#swOnair'); if (oa) oa.classList.toggle('off', !pgm);
    if (popup && !popup.closed) syncPopup();
  }

  function open() {
    if (!modal) build();
    const prev = document.getElementById('previewMon'), pgm = document.getElementById('programMon');
    if (prev) { prevHome = { p: prev.parentNode, n: prev.nextSibling }; modal.querySelector('#swPrevMount').appendChild(prev); }
    if (pgm) { pgmHome = { p: pgm.parentNode, n: pgm.nextSibling }; modal.querySelector('#swPgmMount').appendChild(pgm); }
    modal.hidden = false;
    document.addEventListener('keydown', onKey);
    refresh(); if (!tick) tick = setInterval(refresh, 500);
  }
  function close() {
    if (!modal) return;
    const prev = document.getElementById('previewMon'), pgm = document.getElementById('programMon');
    if (prev && prevHome) prevHome.p.insertBefore(prev, prevHome.n);
    if (pgm && pgmHome) pgmHome.p.insertBefore(pgm, pgmHome.n);
    modal.hidden = true;
    document.removeEventListener('keydown', onKey);
    if (tick) { clearInterval(tick); tick = 0; }
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function toggle() { (modal && !modal.hidden) ? close() : open(); }

  // ---------- 2ª tela ----------
  function detach() {
    popup = window.open('', 'kivoSwitcher', 'width=1280,height=720');
    if (!popup) { alert('Permita janelas pop-up para usar a 2ª tela.'); return; }
    popup.document.write(POPUP_HTML); popup.document.close();
    const go = () => { try { wirePopup(); syncPopup(); } catch (e) {} };
    popup.addEventListener('load', go); setTimeout(go, 300);
  }
  function wirePopup() {
    if (!popup || popup.closed) return; const d = popup.document;
    for (let n = 1; n <= 9; n++) {
      const pb = d.getElementById('p' + n), gb = d.getElementById('g' + n);
      if (pb) pb.onclick = () => cut('program', n);
      if (gb) gb.onclick = () => cut('preview', n);
    }
    const tk = d.getElementById('take'), au = d.getElementById('auto');
    if (tk) tk.onclick = () => { try { ST().take(); } catch (e) {} refresh(); };
    if (au) au.onclick = () => { try { (ST().fadeTake || ST().take)(); } catch (e) {} refresh(); };
  }
  function syncPopup() {
    if (!popup || popup.closed) return; const d = popup.document;
    const pv = d.getElementById('pv'), pg = d.getElementById('pg');
    const rv = document.getElementById('previewVideo'), rg = document.getElementById('programVideo');
    if (pv && rv && pv.srcObject !== rv.srcObject) { pv.srcObject = rv.srcObject; pv.play && pv.play().catch(() => {}); }
    if (pg && rg && pg.srcObject !== rg.srcObject) { pg.srcObject = rg.srcObject; pg.play && pg.play().catch(() => {}); }
    const list = srcList(), st = state();
    for (let n = 1; n <= 9; n++) {
      const s = list[n - 1], pb = d.getElementById('p' + n), gb = d.getElementById('g' + n); if (!pb) continue;
      const nm = s ? (s.label || ('Fonte ' + n)) : '';
      pb.querySelector('.nm').textContent = nm; gb.querySelector('.nm').textContent = nm;
      pb.classList.toggle('has', !!s); gb.classList.toggle('has', !!s);
      pb.classList.toggle('on', !!s && st.program === s.id); gb.classList.toggle('on', !!s && st.preview === s.id);
    }
  }

  const POPUP_HTML = '<!doctype html><html><head><meta charset="utf-8"><title>Kivo Switcher — 2ª tela</title>' +
    '<style>body{margin:0;background:#020305;color:#E2E8F0;font-family:Inter,Segoe UI,system-ui,sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden;user-select:none}' +
    '.m{flex:1;min-height:0;display:flex;gap:14px;padding:14px}.s{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}' +
    '.t{font-size:11px;font-weight:800;letter-spacing:.14em;align-self:flex-start;padding:3px 9px;border-radius:5px}' +
    '.t.pv{color:#10B981;background:rgba(16,185,129,.1)}.t.pg{color:#fff;background:#EF4444}' +
    'video{flex:1;min-height:0;width:100%;background:#000;border-radius:10px;object-fit:contain}' +
    '.pv-b video{box-shadow:inset 0 0 0 2px #10B981}.pg-b video{box-shadow:inset 0 0 0 2px #EF4444}' +
    '.tk{width:150px;align-self:center;display:flex;flex-direction:column;gap:10px}' +
    '.a{height:58px;border-radius:10px;font-weight:800;font-size:14px;color:#fff;cursor:pointer;border:0;text-transform:uppercase}' +
    '.a.au{background:#121A2A}.a.tk2{background:linear-gradient(180deg,#F59E0B,#D97706)}' +
    '.mx{padding:12px 14px 18px;background:#0A0F18;border-top:1px solid #1E293B;display:flex;flex-direction:column;gap:9px}' +
    '.r{display:flex;align-items:center;gap:12px}.rl{width:70px;text-align:right;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}' +
    '.rl.pg{color:#EF4444}.rl.pv{color:#10B981}.bs{flex:1;display:grid;grid-template-columns:repeat(9,1fr);gap:8px}' +
    '.b{aspect-ratio:1;border-radius:8px;cursor:pointer;background:linear-gradient(180deg,#1A2436,#0F172A);border:1px solid #1E293B;border-bottom-width:3px;color:#94A3B8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}' +
    '.b .n{font-size:18px;font-weight:900}.b .nm{font-size:8px;font-weight:700;text-transform:uppercase;opacity:.7;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.b:not(.has){opacity:.45}.b.pgb.on{background:linear-gradient(180deg,#DC2626,#B91C1C);border-color:#EF4444;color:#fff}.b.pvb.on{background:linear-gradient(180deg,#059669,#047857);border-color:#10B981;color:#fff}' +
    '</style></head><body>' +
    '<div class="m"><div class="s pv-b"><span class="t pv">PREVIEW</span><video id="pv" autoplay playsinline muted></video></div>' +
    '<div class="tk"><button class="a au" id="auto">AUTO</button><button class="a tk2" id="take">TAKE</button></div>' +
    '<div class="s pg-b"><span class="t pg">PROGRAM · NO AR</span><video id="pg" autoplay playsinline muted></video></div></div>' +
    '<div class="mx"><div class="r"><span class="rl pg">Program</span><div class="bs" id="rprog"></div></div>' +
    '<div class="r"><span class="rl pv">Preview</span><div class="bs" id="rprev"></div></div></div>' +
    '<scr' + 'ipt>var rp=document.getElementById("rprog"),rv=document.getElementById("rprev");' +
    'for(var n=1;n<=9;n++){rp.insertAdjacentHTML("beforeend","<button class=\\"b pgb has\\" id=\\"p"+n+"\\"><span class=\\"n\\">"+n+"</span><span class=\\"nm\\"></span></button>");' +
    'rv.insertAdjacentHTML("beforeend","<button class=\\"b pvb has\\" id=\\"g"+n+"\\"><span class=\\"n\\">"+n+"</span><span class=\\"nm\\"></span></button>");}' +
    '</scr' + 'ipt></body></html>';

  function init() {
    const right = document.querySelector('.dtop-right');
    if (right && !document.getElementById('btnSwitcher')) {
      const b = el('button', 'tb-switcher', I.sw + ' Switcher');
      b.id = 'btnSwitcher'; b.title = 'Mesa de corte (Switcher) — modal ou 2ª tela'; b.onclick = toggle;
      right.insertBefore(b, document.getElementById('btnPlaylist') || right.firstChild);
    }
    window.Switcher = { open, close, toggle, detach };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
