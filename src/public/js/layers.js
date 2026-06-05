/* ============================================
   CAMADAS · PREVIEW (lista) + PROPRIEDADES (card próprio).
   - Lista as camadas da cena em montagem (mostrar/ocultar/ordenar/remover) + título da cena.
   - Quando uma cena está carregada, o monitor PREVIEW acende azul.
   - Selecionar uma camada abre o card PROPRIEDADES (painel próprio): posição, tamanho,
     rotação, opacidade, mesclagem, frente/trás, duplicar, travar, remover.
   ============================================ */
(function () {
  const TYPE = { scoreboard: 'Placar', image: 'Imagem / PNG', slideshow: 'Slideshow', ticker: 'Rodapé', template: 'Modelo', text: 'Escrita', video: 'Vídeo (PiP)', composer: 'Kivo Composer' };
  const EYE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYEOFF = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.9 17.9A10 10 0 0 1 12 19C5 19 1 12 1 12a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  // modos de mesclagem (os que o navegador suporta), agrupados/nomeados como no Photoshop
  const BLENDS = [
    ['normal', 'Normal'],
    ['darken', 'Escurecer'], ['multiply', 'Multiplicação'], ['color-burn', 'Superexposição de cores'], ['plus-darker', 'Superexposição linear'],
    ['lighten', 'Clarear'], ['screen', 'Tela'], ['color-dodge', 'Subexposição de cores'], ['plus-lighter', 'Subexp. linear (Adicionar)'],
    ['overlay', 'Sobrepor'], ['soft-light', 'Luz indireta'], ['hard-light', 'Luz direta'],
    ['difference', 'Diferença'], ['exclusion', 'Exclusão'],
    ['hue', 'Matiz'], ['saturation', 'Saturação'], ['color', 'Cor'], ['luminosity', 'Luminosidade']
  ];
  let host, propsHost;
  function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  const G = () => window.Graphics;
  const ic = (n, f) => (window.kicon ? kicon(n) : f);   // ícone SVG de traço (padrão), com fallback p/ glifo
  const layerName = o => (o.type === 'template' && o.data && o.data.name) ? o.data.name : (o.data && o.data.label) || (TYPE[o.type] || 'Camada');
  function sceneName(id) {
    if (!id || /^__prev/.test(id)) return null;          // staging '__prev0__' = sem nome
    try { const s = (window.Scenes && window.Scenes.list) ? window.Scenes.list().find(x => x.id === id) : null; return s ? s.name : null; } catch { return null; }
  }
  function scopeId() { const g = G(); const prev = g.getPreviewScene ? g.getPreviewScene() : null; return (prev != null) ? prev : (g.getActiveScene ? g.getActiveScene() : null); }
  function scopeList() { const g = G(); const sc = scopeId(); return (sc != null && g.listForScene) ? g.listForScene(sc).concat(g.globals ? g.globals() : []) : (g.globals ? g.globals() : (g.list ? g.list() : [])); }

  // ----- card de PROPRIEDADES da camada selecionada -----
  function numField(label, val, step, fn) {
    const r = el('div', 'lp-pf'); r.appendChild(el('label', null, label));
    const i = document.createElement('input'); i.type = 'number'; i.step = step || 1; i.value = (val == null ? '' : Math.round(val * 10) / 10);
    i.onchange = () => fn(parseFloat(i.value) || 0); r.appendChild(i); return r;
  }
  function propsBlock(o) {
    const g = G(); const box = el('div', 'lp-props');
    box.appendChild(el('div', 'lp-ptitle', layerName(o)));
    // camada de número (padManaged) → edita o PREVIEW (staging); não mexe no ar até o TAKE
    const pm = !!(o.data && o.data.padManaged), gd = (pm && o.data.pv) ? o.data.pv : o;
    const sPos = pm ? (x, y) => g.setPrevPos(o.id, x, y) : (x, y) => g.setPos(o.id, x, y);
    const sW = pm ? v => g.setPrevWidth(o.id, v) : v => g.setWidth(o.id, v);
    const sH = pm ? v => g.setPrevHeight(o.id, v) : v => g.setHeight(o.id, v);
    const sScale = pm ? v => g.setPrevScale(o.id, v) : v => g.setScale(o.id, v);
    const sRot = pm ? v => g.setPrevRotation(o.id, v) : v => g.setRotation(o.id, v);
    const boxed = (gd.h != null) && (o.type === 'image' || o.type === 'video');
    const grid = el('div', 'lp-pgrid');
    grid.appendChild(numField('X %', gd.x, 0.5, v => sPos(v, gd.y)));
    grid.appendChild(numField('Y %', gd.y, 0.5, v => sPos(gd.x, v)));
    if (boxed) {
      grid.appendChild(numField('Larg %', gd.w, 0.5, v => sW(Math.max(2, v))));
      grid.appendChild(numField('Alt %', gd.h, 0.5, v => sH(Math.max(2, v))));
      box.appendChild(grid);
      const r2 = el('div', 'lp-pgrid'); r2.appendChild(numField('Rotação°', gd.rotation || 0, 1, v => sRot(v))); box.appendChild(r2);
    } else {
      grid.appendChild(numField('Escala', gd.scale || 1, 0.05, v => sScale(v)));
      grid.appendChild(numField('Rotação°', gd.rotation || 0, 1, v => sRot(v)));
      box.appendChild(grid);
    }
    const op = el('div', 'lp-prow'); op.appendChild(el('span', 'lp-plab', 'Opacidade'));
    const sl = document.createElement('input'); sl.type = 'range'; sl.min = 0; sl.max = 100; sl.value = Math.round((o.opacity == null ? 1 : o.opacity) * 100);
    const ov = el('span', 'lp-pval', sl.value + '%'); sl.oninput = () => { ov.textContent = sl.value + '%'; g.setOpacity(o.id, sl.value / 100); };
    op.append(sl, ov); box.appendChild(op);
    const bl = el('div', 'lp-prow'); bl.appendChild(el('span', 'lp-plab', 'Mesclagem'));
    const sel = document.createElement('select');
    BLENDS.forEach(([v, t]) => { const opt = document.createElement('option'); opt.value = v; opt.textContent = t; sel.appendChild(opt); });
    sel.value = (o.data && o.data.blend) ? o.data.blend : 'normal';
    sel.onchange = () => g.setBlend(o.id, sel.value);
    bl.appendChild(sel); box.appendChild(bl);
    if ((o.type === 'image' || o.type === 'video') && g.setFit) {   // como a mídia preenche a caixa (resolve "esticada")
      const ft = el('div', 'lp-prow'); ft.appendChild(el('span', 'lp-plab', 'Ajuste'));
      const fs = document.createElement('select');
      [['contain', 'Caber (sem esticar)'], ['cover', 'Preencher (corta)'], ['fill', 'Esticar']].forEach(([v, t]) => { const op = document.createElement('option'); op.value = v; op.textContent = t; fs.appendChild(op); });
      fs.value = (o.data && o.data.fit) || 'contain';
      fs.onchange = () => g.setFit(o.id, fs.value);
      ft.appendChild(fs); box.appendChild(ft);
    }
    if ((o.type === 'image' || o.type === 'video')) {
      // ENDIREITAR (giro fino): pra imagem/vídeo que vem torto — sem abrir editor externo
      const str = el('div', 'lp-prow'); str.appendChild(el('span', 'lp-plab', 'Endireitar'));
      const ss = document.createElement('input'); ss.type = 'range'; ss.min = -45; ss.max = 45; ss.step = 0.2; ss.value = Math.max(-45, Math.min(45, gd.rotation || 0));
      const sv = el('span', 'lp-pval', (Math.round((gd.rotation || 0) * 10) / 10) + '°');
      ss.oninput = () => { sv.textContent = (Math.round(ss.value * 10) / 10) + '°'; sRot(parseFloat(ss.value)); };
      str.append(ss, sv); box.appendChild(str);
      // CORREÇÃO de cor/brilho (CSS filter) — corrige sem Photoshop/Premiere
      if (g.setFilter) {
        const f = g.getFilter ? g.getFilter(o.id) : { brightness: 100, contrast: 100, saturate: 100 };
        const frow = (label, key, val) => {
          const r = el('div', 'lp-prow'); r.appendChild(el('span', 'lp-plab', label));
          const i = document.createElement('input'); i.type = 'range'; i.min = 0; i.max = 200; i.value = (val == null ? 100 : val);
          const vv = el('span', 'lp-pval', i.value + '%');
          i.oninput = () => { vv.textContent = i.value + '%'; const p = {}; p[key] = +i.value; g.setFilter(o.id, p); };
          r.append(i, vv); box.appendChild(r);
        };
        frow('Brilho', 'brightness', f.brightness);
        frow('Contraste', 'contrast', f.contrast);
        frow('Saturação', 'saturate', f.saturate);
        const rb = el('div', 'lp-prow'); const rbtn = el('button', 'lp-pbtn', 'Resetar cor'); rbtn.onclick = () => { g.clearFilter(o.id); render(); }; rb.appendChild(rbtn); box.appendChild(rb);
      }
    }
    // (camada NÃO é classificada por número — só vai pra PREVIEW ou AO VIVO. Número = só pra itens da Biblioteca.)
    const acts = el('div', 'lp-pacts');
    const mk = (t, title, fn, cls) => { const b = el('button', 'lp-pbtn' + (cls ? ' ' + cls : ''), t); b.title = title; b.onclick = fn; acts.appendChild(b); };
    mk(ic('front', '▲'), 'Trazer p/ frente', () => g.raise(o.id));
    mk(ic('back', '▼'), 'Mandar p/ trás', () => g.lower(o.id));
    mk(ic('duplicate', '⧉'), 'Duplicar', () => { const c = g.duplicate && g.duplicate(o.id, o.scene); if (c && g.select) g.select(c.id); });
    if ((o.type === 'image' || o.type === 'video') && g.setFlip) {   // ESPELHAR (câmera frontal chega espelhada → 1 clique)
      const fl = g.getFlip ? g.getFlip(o.id) : { h: false, v: false };
      mk(ic('flip-h', '↔'), 'Espelhar horizontal', () => { g.setFlip(o.id, 'h'); render(); }, fl.h ? 'on' : '');
      mk(ic('flip-v', '↕'), 'Espelhar vertical', () => { g.setFlip(o.id, 'v'); render(); }, fl.v ? 'on' : '');
    }
    if ((o.type === 'image' || o.type === 'video') && window.Biblioteca && window.Biblioteca.crop) mk(ic('crop', '✂'), 'Cortar (tecla C)', () => window.Biblioteca.crop(o.id));
    if (o.type === 'video' && window.Biblioteca && window.Biblioteca.trim) mk(ic('trim', '⏱'), 'Aparar vídeo (in/out)', () => window.Biblioteca.trim(o.id));
    if (o.type === 'video' && g.setPrevPlay) { const pl = g.getPrevPlay && g.getPrevPlay(o.id); mk(ic(pl ? 'pause' : 'play', pl ? '⏸' : '▶'), pl ? 'Pausar no preview' : 'Tocar no preview (no ar toca sozinho)', () => { g.setPrevPlay(o.id, !(g.getPrevPlay && g.getPrevPlay(o.id))); render(); }, pl ? 'on' : ''); }
    mk(ic(o.locked ? 'lock' : 'unlock', o.locked ? '🔒' : '🔓'), o.locked ? 'Destravar' : 'Travar', () => g.setLocked(o.id, !o.locked));
    mk(ic('trash', '×'), 'Remover', () => g.remove(o.id), 'danger');
    box.appendChild(acts);
    return box;
  }

  // ----- lista de camadas + título da cena + glow no preview -----
  function renderList() {
    if (!host) return; const g = G(); if (!g) return;
    const sc = scopeId(); const nm = sceneName(sc);
    const list = scopeList();
    const sel = g.selected ? g.selected() : null;
    const mon = document.getElementById('previewMon'); if (mon) mon.classList.toggle('scene-on', !!nm);   // cena carregada → preview acende
    const banner = document.getElementById('prevSceneBanner');   // banner "CENA ATIVADA" no topo do PREVIEW
    if (banner) { if (nm) { banner.hidden = false; banner.innerHTML = '<span class="psb-dot"></span> CENA ATIVADA · <b>' + nm + '</b> — tudo que montar entra aqui'; } else { banner.hidden = true; } }
    host.innerHTML = '';
    host.appendChild(el('div', 'lp-scenetitle', nm ? ('<span class="lp-dot"></span> ' + nm) : '<span style="color:var(--muted)">Preview (montagem)</span>'));
    const tg = el('label', 'lp-airtg'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = localStorage.getItem('sl-take-clear') === '1';
    cb.onchange = () => localStorage.setItem('sl-take-clear', cb.checked ? '1' : '0');
    tg.append(cb, document.createTextNode(' limpar preview')); host.appendChild(tg);
    if (!list.length) { host.appendChild(el('div', 'lp-empty', 'Vazio. Clique/arraste um item da Biblioteca pro PREVIEW — vira camada aqui.')); return; }
    [...list].reverse().forEach(o => {
      const row = el('div', 'lp-row' + (o.id === sel ? ' sel' : '') + (o.visible === false ? ' off' : ''));
      // cada camada tem SÓ 2 botões: PREVIEW e AO VIVO (toggle). Número fica pros itens da Biblioteca.
      const pm = !!(o.data && o.data.padManaged);
      const prev = el('button', 'lp-bus lp-bus-prev' + ((pm ? o.data.onPrev : true) ? ' on' : '')); prev.textContent = 'PREVIEW'; prev.title = 'Mostrar/ocultar no PREVIEW';
      prev.onclick = e => { e.stopPropagation(); if (pm) g.setBus(o.id, { onPrev: !o.data.onPrev }); else g.setVisible(o.id, o.visible === false); };
      const live = el('button', 'lp-bus lp-bus-air' + ((pm ? o.data.onPgm : o.visible !== false) ? ' on' : '')); live.textContent = 'AO VIVO'; live.title = 'Pôr/tirar do AR (vai do jeito que você editou no preview)';
      live.onclick = e => { e.stopPropagation(); if (pm) g.setBus(o.id, { onPgm: !o.data.onPgm }); else g.setVisible(o.id, o.visible === false); };
      const nms = el('span', 'lp-nm', layerName(o));
      const x = el('button', 'lp-x', ic('close', '×')); x.title = 'Remover'; x.onclick = e => { e.stopPropagation(); g.remove(o.id); };
      row.append(prev, live, nms, x);
      row.onclick = () => g.select(o.id);
      host.appendChild(row);
    });
  }

  // ----- card de PROPRIEDADES (painel próprio) -----
  function renderProps() {
    if (!propsHost) return; const g = G(); if (!g) return;
    const sel = g.selected ? g.selected() : null;
    const o = (sel != null) ? scopeList().find(x => x.id === sel) : null;
    propsHost.innerHTML = '';
    if (!o) { propsHost.appendChild(el('div', 'lp-empty', 'Clique numa camada (no PREVIEW ou na lista) pra editar — posição, tamanho, rotação, opacidade, mesclagem.')); return; }
    propsHost.appendChild(propsBlock(o));
  }

  function render() { renderList(); renderProps(); }

  function init() {
    host = document.getElementById('layersPanel');
    propsHost = document.getElementById('propsPanel');
    if (!host) return;
    if (!window.Graphics) { setTimeout(init, 250); return; }
    window.Graphics.onChange(render); render();
    document.getElementById('lpHideAll')?.addEventListener('click', () => window.Graphics.hideAll && window.Graphics.hideAll());
    document.getElementById('lpShowAll')?.addEventListener('click', () => window.Graphics.showAll && window.Graphics.showAll());
    document.getElementById('lpClear')?.addEventListener('click', () => { if (confirm('Remover TODAS as camadas que estão no ar?')) window.Graphics.clearAll && window.Graphics.clearAll(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
