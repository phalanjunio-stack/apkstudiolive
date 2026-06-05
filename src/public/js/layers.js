/* ============================================
   CAMADAS · PREVIEW (lista) + PROPRIEDADES (card próprio).
   - Lista as camadas da cena em montagem (mostrar/ocultar/ordenar/remover) + título da cena.
   - Quando uma cena está carregada, o monitor PREVIEW acende azul.
   - Selecionar uma camada abre o card PROPRIEDADES (painel próprio): posição, tamanho,
     rotação, opacidade, mesclagem, frente/trás, duplicar, travar, remover.
   ============================================ */
(function () {
  const TYPE = { scoreboard: 'Placar', image: 'Imagem / PNG', slideshow: 'Slideshow', ticker: 'Rodapé', template: 'Modelo', text: 'Escrita', video: 'Vídeo (PiP)' };
  const EYE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYEOFF = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.9 17.9A10 10 0 0 1 12 19C5 19 1 12 1 12a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const BLENDS = [['normal', 'Normal'], ['multiply', 'Multiplicar'], ['screen', 'Tela'], ['overlay', 'Sobrepor'], ['lighten', 'Clarear'], ['darken', 'Escurecer'], ['soft-light', 'Luz suave'], ['hard-light', 'Luz forte'], ['color-dodge', 'Subexpor'], ['difference', 'Diferença'], ['exclusion', 'Exclusão'], ['luminosity', 'Luminosidade']];
  let host, propsHost;
  function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  const G = () => window.Graphics;
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
    const boxed = (o.h != null) && (o.type === 'image' || o.type === 'video');
    const grid = el('div', 'lp-pgrid');
    grid.appendChild(numField('X %', o.x, 0.5, v => g.setPos(o.id, v, o.y)));
    grid.appendChild(numField('Y %', o.y, 0.5, v => g.setPos(o.id, o.x, v)));
    if (boxed) {
      grid.appendChild(numField('Larg %', o.w, 0.5, v => g.setWidth(o.id, Math.max(2, v))));
      grid.appendChild(numField('Alt %', o.h, 0.5, v => g.setHeight(o.id, Math.max(2, v))));
      box.appendChild(grid);
      const r2 = el('div', 'lp-pgrid'); r2.appendChild(numField('Rotação°', o.rotation || 0, 1, v => g.setRotation(o.id, v))); box.appendChild(r2);
    } else {
      grid.appendChild(numField('Escala', o.scale || 1, 0.05, v => g.setScale(o.id, v)));
      grid.appendChild(numField('Rotação°', o.rotation || 0, 1, v => g.setRotation(o.id, v)));
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
    // atalho número (estilo vMix): a tecla 1-9 liga/desliga essa camada no ar, no lugar definido
    const hk = el('div', 'lp-prow'); hk.appendChild(el('span', 'lp-plab', 'Atalho nº'));
    const hs = document.createElement('select');
    for (let i = 0; i <= 9; i++) { const op = document.createElement('option'); op.value = i; op.textContent = i === 0 ? '— nenhum' : ('tecla ' + i); hs.appendChild(op); }
    hs.value = (o.data && o.data.hotkey) || 0;
    hs.onchange = () => { g.update(o.id, { hotkey: +hs.value }); if (+hs.value > 0 && g.setOverlayScene) g.setOverlayScene(o.id, null); render(); };  // com atalho = overlay global (aparece sobre qualquer cena, igual vMix)
    hk.appendChild(hs); box.appendChild(hk);
    const acts = el('div', 'lp-pacts');
    const mk = (t, title, fn, cls) => { const b = el('button', 'lp-pbtn' + (cls ? ' ' + cls : ''), t); b.title = title; b.onclick = fn; acts.appendChild(b); };
    mk('▲', 'Trazer p/ frente', () => g.raise(o.id));
    mk('▼', 'Mandar p/ trás', () => g.lower(o.id));
    mk('⧉', 'Duplicar', () => { const c = g.duplicate && g.duplicate(o.id, o.scene); if (c && g.select) g.select(c.id); });
    mk(o.locked ? '🔒' : '🔓', o.locked ? 'Destravar' : 'Travar', () => g.setLocked(o.id, !o.locked));
    mk('×', 'Remover', () => g.remove(o.id), 'danger');
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
    host.innerHTML = '';
    host.appendChild(el('div', 'lp-scenetitle', nm ? ('<span class="lp-dot"></span> ' + nm) : '<span style="color:var(--muted)">Preview (montagem)</span>'));
    const tg = el('label', 'lp-airtg'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = localStorage.getItem('sl-take-clear') === '1';
    cb.onchange = () => localStorage.setItem('sl-take-clear', cb.checked ? '1' : '0');
    tg.append(cb, document.createTextNode(' limpar preview')); host.appendChild(tg);
    if (!list.length) { host.appendChild(el('div', 'lp-empty', 'Vazio. Clique/arraste um item da Biblioteca pro PREVIEW — vira camada aqui.')); return; }
    [...list].reverse().forEach(o => {
      const row = el('div', 'lp-row' + (o.id === sel ? ' sel' : '') + (o.visible === false ? ' off' : ''));
      const eye = el('button', 'lp-eye'); eye.innerHTML = o.visible === false ? EYEOFF : EYE; eye.title = 'Mostrar / ocultar (no ar também)';
      eye.onclick = e => { e.stopPropagation(); g.setVisible(o.id, o.visible === false); };
      const nms = el('span', 'lp-nm', layerName(o));
      const up = el('button', 'lp-mini', '▲'); up.title = 'Frente'; up.onclick = e => { e.stopPropagation(); g.raise(o.id); };
      const dn = el('button', 'lp-mini', '▼'); dn.title = 'Trás'; dn.onclick = e => { e.stopPropagation(); g.lower(o.id); };
      const x = el('button', 'lp-x', '×'); x.title = 'Remover'; x.onclick = e => { e.stopPropagation(); g.remove(o.id); };
      row.append(eye, nms, up, dn, x);
      if (o.data && o.data.hotkey) { const b = el('span', 'lp-hk', o.data.hotkey); b.title = 'Atalho ' + o.data.hotkey + ' — liga/desliga no ar'; row.insertBefore(b, eye); }
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
