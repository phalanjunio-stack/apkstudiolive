/* ============================================
   MOTOR DE GRELHA (Smart Grid) — arruma as fontes em layout Solo/2/4 no PREVIEW.
   Cada célula vira uma CAMADA de vídeo (Biblioteca.addLayer) posicionada na grade.
   Reaplica do zero (remove as camadas .grid antigas). "Fundo" = imagem no fundo.
   Aparece como barra no Studio (acima dos monitores) e dentro do Switcher.
   ============================================ */
(function () {
  const G = () => window.Graphics, ST = () => window.Studio, B = () => window.Biblioteca;
  let layout = 0;
  function toast(m) { try { const t = document.createElement('div'); t.className = 'toast show'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); } catch (e) {} }

  const ICONS = {
    solo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    split: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
    quad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
  };

  // posições (%) com margem externa e gap, estilo "podcast"
  function cells(n) {
    const M = 3.5, GAP = 2.5;
    if (n <= 1) return [{ x: 0, y: 0, w: 100, h: 100 }];
    if (n === 2) { const w = (100 - 2 * M - GAP) / 2, h = 100 - 2 * M; return [{ x: M, y: M, w, h }, { x: M + w + GAP, y: M, w, h }]; }
    const w = (100 - 2 * M - GAP) / 2, h = (100 - 2 * M - GAP) / 2;
    return [{ x: M, y: M, w, h }, { x: M + w + GAP, y: M, w, h }, { x: M, y: M + h + GAP, w, h }, { x: M + w + GAP, y: M + h + GAP, w, h }];
  }
  function clearGrid() { const g = G(); if (!g || !g.list) return; g.list().slice().forEach(o => { if (o.data && o.data.grid) g.remove(o.id); }); }
  function tagGrid(o) { if (!o) return; [o.el, o.elv].forEach(e => e && e.classList.add('ov-grid')); }

  function apply(n) {
    const g = G(), b = B(); if (!g || !b) return;
    const list = (() => { try { return ST().sourcesInfo().list || []; } catch (e) { return []; } })();
    if (!list.length) { toast('Conecte câmeras/fontes primeiro (Biblioteca)'); return; }
    clearGrid();
    cells(n).forEach((c, i) => {
      const s = list[i]; if (!s) return;
      const made = b.addLayer({ kind: 'source', id: s.id, label: s.label }, 50, 50);
      if (made) { g.update(made.id, { grid: true, fit: 'cover' }); g.setPos(made.id, c.x, c.y); g.setWidth(made.id, c.w); g.setHeight(made.id, c.h); tagGrid(g.get && g.get(made.id)); }
    });
    if (g.select) g.select(null);
    layout = n; mark();
    toast('Grade ' + (n === 1 ? 'Solo' : n + ' câmeras') + ' montada no PREVIEW — dê TAKE pra ir ao ar.');
  }

  function background() {
    const b = B(), g = G(); if (!b || !g) return;
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => { const f = i.files && i.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { const made = b.addLayer({ kind: 'image', src: r.result, name: 'Fundo' }, 50, 50);
        if (made) { g.update(made.id, { grid: true, fit: 'cover' }); g.setPos(made.id, 0, 0); g.setWidth(made.id, 100); g.setHeight(made.id, 100); for (let k = 0; k < 60; k++) g.lower && g.lower(made.id); }
        toast('Fundo definido (atrás de tudo).'); };
      r.readAsDataURL(f); };
    i.click();
  }

  function mark() { document.querySelectorAll('.gb-btn').forEach(b => b.classList.toggle('on', +b.dataset.l === layout)); }

  function makeBar() {
    const bar = document.createElement('div'); bar.className = 'grid-bar';
    bar.innerHTML =
      '<span class="gb-lab">Motor de grelha</span><div class="gb-sep"></div>' +
      '<div class="gb-grp">' +
        '<button class="gb-btn" data-l="1" title="Solo — 1 câmera em tela cheia">' + ICONS.solo + '</button>' +
        '<button class="gb-btn" data-l="2" title="Dividir — 2 câmeras lado a lado">' + ICONS.split + '</button>' +
        '<button class="gb-btn" data-l="4" title="Grade — 4 câmeras">' + ICONS.quad + '</button>' +
      '</div><div class="gb-sep"></div>' +
      '<button class="gb-fundo" title="Definir imagem de fundo">' + ICONS.img + ' Fundo</button>';
    bar.querySelectorAll('.gb-btn').forEach(b => b.onclick = () => apply(+b.dataset.l));
    bar.querySelector('.gb-fundo').onclick = background;
    return bar;
  }

  function init() {
    const monitors = document.querySelector('.main .monitors') || document.querySelector('.monitors');
    if (monitors && monitors.parentNode && !document.getElementById('gridBarStudio')) {
      const bar = makeBar(); bar.id = 'gridBarStudio'; monitors.parentNode.insertBefore(bar, monitors);
    }
    window.Grid = { apply, background, makeBar, mark };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
