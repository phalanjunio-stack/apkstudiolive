/* ============================================
   MODO AO VIVO — console de operação numa tela só.
   PROGRAM/PREVIEW grandes + CENAS + FONTES + gatilhos
   (gol/cartão/placar) + CUT/FADE/FTB/GO LIVE.
   Reusa os monitores reais (com os gráficos por cima).
   ============================================ */
(function () {
  let bar = null, tick = null;
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const isOn = () => document.body.classList.contains('live-mode');

  function enter() {
    document.body.classList.add('live-mode');
    if (!bar) build();
    updateBar();
    document.getElementById('liveToggle')?.classList.add('on');
    if (!tick) tick = setInterval(() => { if (isOn()) updateBar(); }, 1200);
  }
  function exit() { document.body.classList.remove('live-mode'); document.getElementById('liveToggle')?.classList.remove('on'); }
  const toggle = () => isOn() ? exit() : enter();

  function build() {
    const main = document.querySelector('.main'); if (!main) return;
    bar = el('div', 'livebar'); bar.id = 'liveBar';
    bar.innerHTML =
      '<div class="lb-col"><div class="lb-h">CENAS</div><div class="lb-chips" id="lbScenes"></div></div>' +
      '<div class="lb-col"><div class="lb-h">FONTES <small>clique = preview · 2 cliques = no ar</small></div><div class="lb-chips" id="lbSources"></div></div>' +
      '<div class="lb-col lb-narrow"><div class="lb-h">GRÁFICOS</div><div class="lb-chips" id="lbFb"></div></div>' +
      '<div class="lb-col lb-narrow"><div class="lb-h">CONTROLE</div><div class="lb-ctrls" id="lbCtrl"></div></div>';
    main.appendChild(bar);

    const c = bar.querySelector('#lbCtrl');
    const mk = (lab, cls, fn) => { const b = el('button', 'lb-btn ' + (cls || ''), lab); b.onclick = fn; c.appendChild(b); return b; };
    mk('CUT', 'prim', () => window.Studio && window.Studio.take && window.Studio.take());
    mk('FADE', '', () => window.Studio && window.Studio.fadeTake && window.Studio.fadeTake());
    mk('FTB', '', () => window.Studio && window.Studio.ftb && window.Studio.ftb());
    const live = mk('● GO LIVE', 'live', () => window.KivoStream && window.KivoStream.toggle && window.KivoStream.toggle());
    if (window.KivoStream && window.KivoStream.onState) window.KivoStream.onState(o => { live.classList.toggle('on-air', o); live.innerHTML = o ? '■ PARAR' : '● GO LIVE'; });

    const fb = bar.querySelector('#lbFb');
    const fbtn = (lab, cls, fn) => { const b = el('button', 'lb-btn ' + (cls || ''), lab); b.onclick = fn; fb.appendChild(b); return b; };
    if (window.Futebol) {
      fbtn('GOL CASA', 'goal', () => window.Futebol.goal('h', ''));
      fbtn('GOL VIS.', 'goal', () => window.Futebol.goal('a', ''));
      const cb = fbtn('CARTÃO', 'yellow', null); cb.onclick = (e) => cardMenu(cb);
    }
    fbtn('PLACAR', '', toggleScoreboard);

    const exitB = el('button', 'lb-exit', 'Sair do modo Estúdio'); exitB.onclick = exit; bar.appendChild(exitB);
  }

  function updateBar() {
    if (!bar) return;
    const sc = bar.querySelector('#lbScenes');
    if (sc && window.Scenes) {
      const list = window.Scenes.list(), act = window.Scenes.active();
      sc.innerHTML = ''; if (!list.length) sc.appendChild(el('span', 'lb-empty', 'sem cenas — crie em CENAS'));
      list.forEach(s => { const b = el('button', 'lb-chip' + (s.id === act ? ' active' : ''), s.name); b.onclick = () => window.Scenes.apply(s.id); sc.appendChild(b); });
    }
    const sr = bar.querySelector('#lbSources');
    if (sr && window.Studio && window.Studio.sourcesInfo) {
      const info = window.Studio.sourcesInfo();
      sr.innerHTML = ''; if (!info.list.length) sr.appendChild(el('span', 'lb-empty', 'sem fontes'));
      info.list.forEach(s => {
        const cls = s.id === info.program ? 'program' : s.id === info.preview ? 'preview' : '';
        const b = el('button', 'lb-chip ' + cls, s.label);
        b.onclick = () => window.Studio.setPreview(s.id);
        b.ondblclick = () => window.Studio.setProgram(s.id);
        sr.appendChild(b);
      });
    }
  }
  function toggleScoreboard() { const g = window.Graphics; if (!g) return; const sb = g.list().find(o => o.type === 'scoreboard'); if (sb) g.setVisible(sb.id, sb.visible === false); }
  function cardMenu(anchor) {
    document.getElementById('lbCardMenu')?.remove();
    const m = el('div', 'add-menu'); m.id = 'lbCardMenu';
    [['Amarelo — Casa', 'h', 'yellow'], ['Amarelo — Vis.', 'a', 'yellow'], ['Vermelho — Casa', 'h', 'red'], ['Vermelho — Vis.', 'a', 'red']]
      .forEach(([lab, side, kind]) => { const b = el('button', '', lab); b.onclick = () => { m.remove(); window.Futebol.card(side, kind, ''); }; m.appendChild(b); });
    document.body.appendChild(m);
    if (window.placeMenu) window.placeMenu(m, anchor);
    setTimeout(() => document.addEventListener('click', function h(e) { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('click', h); } }), 0);
  }

  function mountToggle() {
    const right = document.querySelector('.dtop-right'); if (!right || document.getElementById('liveToggle')) return;
    const b = el('button', 'live-toggle', '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>Estúdio'); b.id = 'liveToggle'; b.title = 'Modo Estúdio — operação numa tela só'; b.onclick = toggle;
    right.insertBefore(b, right.firstChild);
    // ESC sai do modo ao vivo
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOn()) exit(); });
  }
  window.LiveMode = { enter, exit, toggle };
  // botão "Estúdio" (modo tela-única) REMOVIDO da topbar — quem manda agora é o "MODO FUTEBOL".
  // pra reativar é só chamar mountToggle() de novo aqui.
  function init() { /* mountToggle(); */ }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
