/* ============================================
   FX — orquestra os efeitos no topbar:
   - botoes Conectar(QR) / Tema / Som
   - smoke-glow + ripple
   - modal do QR
   - inicia o som de UI
   Portado/adaptado do micro.js do Contourline.
   ============================================ */
(function () {
  // tirei o .theme-switcher-btn daqui: as faíscas/aura (smoke-glow) ao redor do botão de
  // tema ficavam "estranhas" perto do dropdown (pedido do usuário). Fica um botão limpo.
  const GLOW_SEL = '.topbar-btn-connect, .kmode, .sc-air-btn, .theme-switcher-btn';

  // ── injeta aura + halo + 4 faiscas dentro do botao ──
  function attachSmokeGlow(btn) {
    if (!btn || btn.dataset.smokeGlow === '1') return;
    btn.dataset.smokeGlow = '1';
    btn.classList.add('smoke-glow');
    const frag = document.createDocumentFragment();
    const aura = document.createElement('span'); aura.className = 'sg-aura'; frag.appendChild(aura);
    const halo = document.createElement('span'); halo.className = 'sg-halo'; frag.appendChild(halo);
    [{ ang: 35, d: 1.8, del: 0 }, { ang: 125, d: 2.1, del: 0.4 },
     { ang: 215, d: 1.7, del: 0.7 }, { ang: 305, d: 2.0, del: 0.2 }].forEach(s => {
      const sp = document.createElement('span');
      sp.className = 'sg-spark';
      sp.style.cssText = `--ang:${s.ang}deg;--d:${s.d}s;--del:${s.del}s`;
      frag.appendChild(sp);
    });
    btn.insertBefore(frag, btn.firstChild);
  }
  function scanGlow() { document.querySelectorAll(GLOW_SEL).forEach(attachSmokeGlow); }

  // ── onda no clique ──
  document.addEventListener('click', e => {
    const btn = e.target.closest(GLOW_SEL);
    if (!btn || btn.disabled) return;
    btn.querySelectorAll('.tb-ripple').forEach(n => n.remove());
    const r = document.createElement('span');
    r.className = 'tb-ripple';
    btn.appendChild(r);
    r.addEventListener('animationend', () => r.remove(), { once: true });
  }, true);

  // ── modal do QR ──
  function wireConnectModal() {
    const modal = document.getElementById('connectModal');
    if (!modal) return;
    let loaded = false;
    async function load() {
      if (loaded) return; loaded = true;
      try {
        const room = new URLSearchParams(location.search).get('room') || 'cam1';
        const info = await fetch('/api/info').then(r => r.json());
        const url = info.phoneUrl + '?room=' + encodeURIComponent(room);
        document.getElementById('qrBig').src = '/qr?text=' + encodeURIComponent(url);
        const a = document.getElementById('phoneUrlBig'); a.textContent = url; a.href = url;
      } catch {}
    }
    function show() { load(); modal.hidden = false; window.SoundFX?.open(); }
    function hide() { modal.hidden = true; window.SoundFX?.close(); }
    modal.__show = show;
    modal.addEventListener('click', e => { if (e.target === modal) hide(); });
    document.getElementById('connectClose')?.addEventListener('click', hide);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) hide(); });
  }

  // ── monta os botoes no topbar ──
  function mountTopbar() {
    const right = document.querySelector('.dtop-right');
    if (!right) return;

    // 1) Conectar celular (QR)
    const connect = document.createElement('button');
    connect.className = 'icon-btn topbar-btn-connect';
    connect.title = 'Controle pelo celular (QR)';
    connect.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="18" y1="14" x2="21" y2="14"/><line x1="21" y1="18" x2="21" y2="21"/><line x1="17" y1="21" x2="18" y2="21"/></svg>';
    connect.addEventListener('click', () => { if (window.openConnectModal) window.openConnectModal('control', 'control'); else document.getElementById('connectModal')?.__show?.(); });

    // 2) Tema
    const themeBox = document.createElement('div');
    window.Theme?.mountSwitcher(themeBox);

    // 3) Som
    const sound = window.SoundFX?.createToggle();

    // ancora no primeiro icone existente (engrenagem) — fica: rede, [conectar, tema, som], engrenagem...
    const anchor = right.querySelector('.icon-btn') || right.firstChild;
    right.insertBefore(connect, anchor);
    right.insertBefore(themeBox, anchor);
    if (sound) right.insertBefore(sound, anchor);
  }

  function init() {
    document.documentElement.style.scrollBehavior = 'smooth';
    mountTopbar();
    wireConnectModal();
    scanGlow();
    new MutationObserver(scanGlow).observe(document.body, { childList: true, subtree: true });
    window.SoundFX?.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
