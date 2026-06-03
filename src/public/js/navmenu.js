/* ============================================================
   NAVMENU — menu lateral recolhível.
   • recolhe automático em tela estreita, expande no monitor grande
   • flyout flutuante (label) ao passar o mouse quando recolhido
   • estado manual salvo (vale pras telas largas)
   ============================================================ */
(function () {
  const KEY = 'kivo-nav-collapsed', NARROW = 1180;
  let pref = false, flyout = null, rT = 0, lastW = window.innerWidth;
  const nav = () => document.querySelector('.nav');
  const links = () => document.querySelectorAll('.nav a.nav-link');
  const isNarrow = () => window.innerWidth < NARROW;
  const desired = () => isNarrow() ? true : pref;
  const collapsed = () => document.body.classList.contains('nav-collapsed');

  function setData() { links().forEach(a => { a.dataset.label = a.textContent.trim(); a.removeAttribute('title'); }); }
  function setCol(c) { document.body.classList.toggle('nav-collapsed', c); hideFlyout(); setTimeout(() => window.dispatchEvent(new Event('resize')), 60); }
  function applyAuto(c) { if (collapsed() === c) return; setCol(c); }   // usado no resize (com guarda anti-loop)

  function toggle() {
    const next = !collapsed();
    if (!isNarrow()) { pref = next; try { localStorage.setItem(KEY, next ? '1' : '0'); } catch {} }
    setCol(next);
  }

  // flyout: label flutuante ao lado do ícone (só recolhido)
  function showFlyout(a) {
    if (!collapsed()) return;
    if (!flyout) { flyout = document.createElement('div'); flyout.className = 'nav-flyout'; document.body.appendChild(flyout); }
    flyout.textContent = a.dataset.label || a.textContent.trim();
    const r = a.getBoundingClientRect();
    flyout.style.top = (r.top + r.height / 2) + 'px';
    flyout.style.left = (r.right + 10) + 'px';
    flyout.classList.add('on');
  }
  function hideFlyout() { if (flyout) flyout.classList.remove('on'); }

  function init() {
    const btn = document.getElementById('navToggle');
    if (btn) btn.addEventListener('click', toggle);
    setData();
    try { pref = localStorage.getItem(KEY) === '1'; } catch {}
    const n = nav();
    if (n) {
      n.addEventListener('mouseover', e => { const a = e.target.closest('.nav a.nav-link'); if (a) showFlyout(a); });
      n.addEventListener('mouseleave', hideFlyout);
      n.addEventListener('scroll', hideFlyout);
    }
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastW) return; // ignora resize sintético (monitorfit) — evita loop
      lastW = window.innerWidth; hideFlyout();
      clearTimeout(rT); rT = setTimeout(() => applyAuto(desired()), 120);
    });
    document.body.classList.toggle('nav-collapsed', desired()); // estado inicial
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* stats vivos no topo (CPU/GPU sintetizados; FPS real entra quando há stream) */
(function () {
  let cpu = 14, gpu = 20;
  const $ = id => document.getElementById(id);
  function tick() {
    cpu = Math.max(7, Math.min(46, cpu + (Math.random() - 0.5) * 4));
    gpu = Math.max(9, Math.min(58, gpu + (Math.random() - 0.5) * 5));
    if ($('cpu')) $('cpu').textContent = Math.round(cpu) + '%';
    if ($('gpu')) $('gpu').textContent = Math.round(gpu) + '%';
  }
  function go() { tick(); setInterval(tick, 1600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
