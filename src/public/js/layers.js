/* ============================================
   CAMADAS NO AR — painel no Dashboard que lista TUDO
   que está no PROGRAM (placar, modelos, PNG, rodapé…)
   pra mostrar/ocultar/selecionar/reordenar/remover.
   ============================================ */
(function () {
  const TYPE = { scoreboard: 'Placar', image: 'Imagem / PNG', slideshow: 'Slideshow', ticker: 'Rodapé', template: 'Modelo', text: 'Escrita', video: 'Vídeo (PiP)' };
  const EYE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYEOFF = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.9 17.9A10 10 0 0 1 12 19C5 19 1 12 1 12a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  let host;
  function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }

  function render() {
    if (!host) return;
    const G = window.Graphics; if (!G) return;
    // CAMADAS = o que está no PREVIEW (montagem). "Pôr no ar" manda pro PROGRAM. Tudo novo entra aqui primeiro.
    const prev = G.getPreviewScene ? G.getPreviewScene() : null;
    const list = (prev != null && G.listForScene) ? G.listForScene(prev).concat(G.globals ? G.globals() : []) : (G.globals ? G.globals() : (G.list ? G.list() : []));
    const sel = G.selected ? G.selected() : null;
    host.innerHTML = '';
    const airBar = el('div', 'lp-air');
    const airBtn = el('button', 'lp-airbtn', '&#9654; Pôr no ar'); airBtn.title = 'Manda as camadas do preview pro PROGRAM (no ar)';
    airBtn.onclick = () => { if (G.takeOverlays) G.takeOverlays(localStorage.getItem('sl-take-clear') === '1'); };
    const tg = el('label', 'lp-airtg'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = localStorage.getItem('sl-take-clear') === '1';
    cb.onchange = () => localStorage.setItem('sl-take-clear', cb.checked ? '1' : '0');
    tg.append(cb, document.createTextNode(' limpar preview'));
    airBar.append(airBtn, tg); host.appendChild(airBar);
    if (!list.length) { host.appendChild(el('div', 'lp-empty', 'Preview vazio. Adicione em Gráficos, Futebol ou Modelos — entra aqui primeiro.')); return; }
    [...list].reverse().forEach(o => {
      const row = el('div', 'lp-row' + (o.id === sel ? ' sel' : '') + (o.visible === false ? ' off' : ''));
      const eye = el('button', 'lp-eye'); eye.innerHTML = o.visible === false ? EYEOFF : EYE; eye.title = 'Mostrar / ocultar';
      eye.onclick = e => { e.stopPropagation(); G.setVisible(o.id, o.visible === false); };
      const nm = el('span', 'lp-nm', (o.type === 'template' && o.data && o.data.name) ? o.data.name : (TYPE[o.type] || 'Camada'));
      const up = el('button', 'lp-mini', '▲'); up.title = 'Trazer p/ frente'; up.onclick = e => { e.stopPropagation(); G.raise(o.id); };
      const dn = el('button', 'lp-mini', '▼'); dn.title = 'Mandar p/ trás'; dn.onclick = e => { e.stopPropagation(); G.lower(o.id); };
      const x = el('button', 'lp-x', '×'); x.title = 'Remover'; x.onclick = e => { e.stopPropagation(); G.remove(o.id); };
      row.append(eye, nm, up, dn, x);
      row.onclick = () => G.select(o.id);
      host.appendChild(row);
    });
  }

  function init() {
    host = document.getElementById('layersPanel');
    if (!host) return;
    if (!window.Graphics) { setTimeout(init, 250); return; }
    window.Graphics.onChange(render); render();
    document.getElementById('lpHideAll')?.addEventListener('click', () => window.Graphics.hideAll && window.Graphics.hideAll());
    document.getElementById('lpShowAll')?.addEventListener('click', () => window.Graphics.showAll && window.Graphics.showAll());
    document.getElementById('lpClear')?.addEventListener('click', () => { if (confirm('Remover TODAS as camadas que estão no ar?')) window.Graphics.clearAll && window.Graphics.clearAll(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
