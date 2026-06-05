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
  function clearGrid() { const g = G(); if (!g || !g.list) return; g.list().slice().forEach(o => { if (o.data && (o.data.grid || o.data.gridSlot)) g.remove(o.id); }); }

  function apply(n) {
    const g = G(); if (!g || !g.add) return;
    clearGrid();
    cells(n).forEach((c, i) => {
      const o = g.add('video'); if (!o) return;
      g.update(o.id, { gridSlot: true, slotN: i + 1, padManaged: true, onPgm: false, onPrev: true, label: 'Quadro ' + (i + 1), fit: 'cover' });
      if (g.setOverlayScene) g.setOverlayScene(o.id, null);
      g.setPos(o.id, c.x, c.y); g.setWidth(o.id, c.w); g.setHeight(o.id, c.h);
      [o.el, o.elv].forEach(e => { if (e) { e.classList.add('ov-grid', 'grid-slot'); e.setAttribute('data-slotn', i + 1); } });
    });
    if (g.select) g.select(null);
    layout = n; mark();
    toast(n === 1 ? 'Arraste 1 vídeo/câmera pro quadro no PREVIEW.' : 'Grade ' + n + ': arraste um vídeo pra cada quadro.');
  }
  // preenche o quadro (slot) que está sob o ponto (x,y) com a fonte arrastada; true se acertou um slot
  function fillSlot(o, srcId) {
    const g = G(); let s = null; try { s = ST().sourcesInfo().list.find(x => x.id === srcId); } catch (e) {}
    if (!s || !o) return;
    const vid = s.url && s.kind !== 'youtube' && !/^data:image|\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(s.url);
    g.update(o.id, vid ? { src: s.url, sourceId: null, gridSlot: false, label: s.label } : { sourceId: srcId, src: '', gridSlot: false, label: s.label });
    [o.el, o.elv].forEach(e => e && e.classList.remove('grid-slot'));
  }
  function fillSlotAt(x, y, srcId) {
    const g = G(); if (!g || !g.list) return false;
    const slots = g.list().filter(o => o.data && o.data.gridSlot && o.elv);
    for (let i = 0; i < slots.length; i++) { const r = slots[i].elv.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { fillSlot(slots[i], srcId); return true; } }
    return false;
  }

  function background() {
    const b = B(), g = G(); if (!b || !g) return;
    const existing = g.list ? g.list().find(o => o.data && o.data.gridBg) : null;
    if (existing) { g.remove(existing.id); mark(); toast('Fundo removido.'); return; }   // toggle: já tem fundo → tira
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => { const f = i.files && i.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { const made = b.addLayer({ kind: 'image', src: r.result, name: 'Fundo' }, 50, 50);
        if (made) { g.update(made.id, { grid: true, gridBg: true, fit: 'cover' }); g.setPos(made.id, 0, 0); g.setWidth(made.id, 100); g.setHeight(made.id, 100); (g.sendToBack ? g.sendToBack(made.id) : (() => { for (let k = 0; k < 60; k++) g.lower && g.lower(made.id); })()); }
        mark(); toast('Fundo definido (atrás de tudo).'); };
      r.readAsDataURL(f); };
    i.click();
  }

  // ----- 2 cliques no QUADRO vazio: escolher/importar vídeo ou câmera -----
  function closeSlotPicker() { const m = document.getElementById('slotPicker'); if (m) m.remove(); document.removeEventListener('pointerdown', spOut, true); }
  function spOut(e) { if (!e.target.closest('#slotPicker')) closeSlotPicker(); }
  function importVideoToSlot(slotId) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*';
    i.onchange = () => { const f = i.files && i.files[0]; if (!f) return; const id = ST().addVideoFile && ST().addVideoFile(f); if (id) setTimeout(() => { const o = G().get(slotId); if (o) fillSlot(o, id); }, 60); };
    i.click();
  }
  function openSlotPicker(slot, x, y) {
    closeSlotPicker();
    const list = (() => { try { return ST().sourcesInfo().list || []; } catch (e) { return []; } })().filter(s => s.kind !== 'image' && s.kind !== 'youtube');
    const m = document.createElement('div'); m.id = 'slotPicker'; m.className = 'slot-picker';
    let h = '<div class="sp-head">Pôr no quadro ' + (slot.data.slotN || '') + '</div>';
    if (list.length) list.forEach(s => { h += '<button class="sp-it" data-src="' + s.id + '"><span class="sp-dot"></span>' + (s.label || s.id) + '</button>'; });
    else h += '<div class="sp-empty">Nenhuma câmera/vídeo ainda</div>';
    h += '<div class="sp-sep"></div><button class="sp-it sp-add" data-act="vid">＋ Importar vídeo (arquivo)</button><button class="sp-it sp-add" data-act="more">＋ Câmera / outra fonte…</button>';
    m.innerHTML = h; document.body.appendChild(m);
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - 240)) + 'px'; m.style.top = Math.max(8, Math.min(y, window.innerHeight - m.offsetHeight - 8)) + 'px';
    m.querySelectorAll('.sp-it[data-src]').forEach(b => b.onclick = () => { const o = G().get(slot.id); if (o) fillSlot(o, b.dataset.src); closeSlotPicker(); });
    const vid = m.querySelector('[data-act="vid"]'); if (vid) vid.onclick = () => { const sid = slot.id; closeSlotPicker(); importVideoToSlot(sid); };
    const more = m.querySelector('[data-act="more"]'); if (more) more.onclick = () => { closeSlotPicker(); if (ST().openAddMenu) ST().openAddMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', spOut, true), 0);
  }

  function mark() { document.querySelectorAll('.gb-btn').forEach(b => b.classList.toggle('on', +b.dataset.l === layout)); const g = G(); const hasBg = !!(g && g.list && g.list().find(o => o.data && o.data.gridBg)); document.querySelectorAll('.gb-fundo').forEach(b => b.classList.toggle('on', hasBg)); }

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
    bar.querySelectorAll('.gb-btn').forEach(b => b.onclick = () => { const l = +b.dataset.l; if (l === layout) { clearGrid(); layout = 0; const g = G(); if (g && g.select) g.select(null); mark(); toast('Grade desfeita.'); } else apply(l); });
    bar.querySelector('.gb-fundo').onclick = background;
    return bar;
  }

  function init() {
    const monitors = document.querySelector('.main .monitors') || document.querySelector('.monitors');
    if (monitors && monitors.parentNode && !document.getElementById('gridBarStudio')) {
      const bar = makeBar(); bar.id = 'gridBarStudio'; monitors.parentNode.insertBefore(bar, monitors);
    }
    // 2 cliques num QUADRO vazio → escolher/importar vídeo ou câmera
    const prev = document.getElementById('prevOverlay');
    if (prev && !prev.__gridPick) {
      prev.__gridPick = true;
      prev.addEventListener('dblclick', e => {
        const node = e.target.closest('.grid-slot'); if (!node) return;
        const id = +node.dataset.id; const o = G().get && G().get(id);
        if (o && o.data && o.data.gridSlot) { e.preventDefault(); e.stopPropagation(); openSlotPicker(o, e.clientX, e.clientY); }
      });
    }
    window.Grid = { apply, background, makeBar, mark, fillSlotAt };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
