/* ============================================================
   MONITOR FIT — PREVIEW/PROGRAM SEMPRE no formato certo
   Calcula o maior retângulo no formato da live (16:9 / 9:16 /
   1:1 / livre) que CABE no espaço e centraliza. Nunca estica
   pra 23:9. Responsivo e automático (resize, formato, modo).
   ============================================================ */
(function () {
  function ratioNum() {
    const dash = document.querySelector('.dash');
    if (!dash) return 16 / 9;
    let f = (getComputedStyle(dash).getPropertyValue('--fmt') || '').trim();
    if (!f) f = (dash.dataset.format || '16:9').replace(':', '/');
    const p = f.split('/').map(parseFloat);
    const r = (p[0] && p[1]) ? p[0] / p[1] : NaN;
    return (r && isFinite(r) && r > 0) ? r : 16 / 9;
  }

  function fit() {
    const wrap = document.querySelector('.dash .monitors');
    if (!wrap || wrap.offsetParent === null) return;            // página/monitores escondidos
    const mons = wrap.querySelectorAll(':scope > .mon');
    if (!mons.length) return;
    const innerW = wrap.clientWidth;
    if (innerW < 60) return;
    const R = ratioNum();
    const live = document.body.classList.contains('live-mode');
    const cs = getComputedStyle(wrap);
    const gap = parseFloat(cs.columnGap || cs.gap) || 12;
    const stacked = !live && (innerW < 760 || getComputedStyle(wrap).gridTemplateColumns.split(' ').length <= 1);
    const mid = stacked ? 0 : 116;                               // coluna central (switcher TAKE/CUT)
    const cols = stacked ? 1 : (mons.length > 1 ? 2 : 1);
    const sideGaps = cols > 1 ? gap * cols : 0;
    const cellW = Math.max(40, (innerW - (cols > 1 ? mid : 0) - sideGaps) / cols);
    let availH;
    if (live) availH = wrap.clientHeight || (cellW / R);        // no Estúdio o espaço tem altura própria
    else availH = Math.min(window.innerHeight * 0.56, cellW / R);
    if (!availH || availH < 40) availH = cellW / R;
    const boxW = Math.min(cellW, availH * R);
    const boxH = boxW / R;
    mons.forEach(m => { m.style.width = Math.round(boxW) + 'px'; m.style.height = Math.round(boxH) + 'px'; });
  }

  let raf = 0;
  function schedule() { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { raf = 0; fit(); }); }

  function start() {
    schedule();
    window.addEventListener('resize', schedule);
    try {
      const main = document.querySelector('.dash .main') || document.querySelector('.dash');
      if (main && 'ResizeObserver' in window) new ResizeObserver(schedule).observe(main);
    } catch {}
    try {
      const dash = document.querySelector('.dash');
      if (dash) new MutationObserver(schedule).observe(dash, { attributes: true, attributeFilter: ['class', 'data-format', 'style'] });
      new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch {}
  }

  window.fitMonitors = fit;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
