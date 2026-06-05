/* ============================================
   DRAG-SCROLL — rolar arrastando com o mouse
   Sem barra de rolagem: clica num espaço vazio do
   painel e arrasta. Cliques normais continuam valendo
   (só vira rolagem se o mouse se mover de fato).
   Só mouse — toque usa rolagem nativa.
   ============================================ */
(function () {
  const CONT = '.main, .rightcol, .nav, .main-page, .mixer';
  // controles que têm arraste próprio / não devem virar rolagem (clique nunca vira scroll)
  const SKIP = 'button, a, [role="button"], label, input, textarea, select, ' +
               '.fader, .vfader, .master-fader, .mb-seek, .rpanel-pin, .fmt-seg, .theme-switcher, ' +
               '.crop-h, .crop-ui, .yt-stage, .gfx-dock, [data-ov], .ov-item, ' +
               '.pgm-overlay, .ov, .ov-resize, .fb-prevstage, .fb-proxy, .lp-row, .sc-chip, ' +
               '.fcard, .lib-item';   // cards arrastáveis (biblioteca) — arrastar ≠ rolar

  let cont = null, sx = 0, sy = 0, sl = 0, st = 0, moved = false, suppress = false;

  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const c = e.target.closest(CONT);
    if (!c) return;
    if (e.target.closest(SKIP)) return;          // deixa faders/sliders livres
    cont = c; sx = e.clientX; sy = e.clientY;
    sl = c.scrollLeft; st = c.scrollTop; moved = false;
  }, true);

  document.addEventListener('pointermove', e => {
    if (!cont) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return; // limiar: clique ≠ arraste
    if (!moved) { moved = true; document.body.classList.add('drag-scrolling'); }
    cont.scrollLeft = sl - dx;
    cont.scrollTop = st - dy;
  }, true);

  function end() {
    if (!cont) return;
    if (moved) suppress = true;                  // arrastou → cancela o clique seguinte
    cont = null; moved = false;
    document.body.classList.remove('drag-scrolling');
  }
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', end, true);

  // se houve arraste, não deixa o "click" disparar (ex.: não troca o PREVIEW)
  document.addEventListener('click', e => {
    if (suppress) { suppress = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
