/* ============================================
   THEME — Claro / Escuro / Automatico
   Aplica via <html data-theme="..."> e persiste.
   Portado/adaptado do Contourline (sitelocal).
   ============================================ */
const Theme = (() => {
  const KEY = 'sl-theme';
  const VALID = ['dark', 'light', 'auto'];
  const get = () => localStorage.getItem(KEY) || 'dark';

  // som de "interruptor" ao alternar claro/escuro
  function playClick(toLight) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;
      const mk = (len, gain, at) => {
        const b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = ctx.createBufferSource(); s.buffer = b;
        const g = ctx.createGain(); g.gain.setValueAtTime(gain, at);
        s.connect(g); g.connect(ctx.destination); s.start(at); return s;
      };
      mk(0.003, toLight ? 0.55 : 0.45, t);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(toLight ? 1800 : 900, t);
      o.frequency.exponentialRampToValueAtTime(toLight ? 3200 : 400, t + 0.06);
      const og = ctx.createGain(); og.gain.setValueAtTime(toLight ? 0.12 : 0.09, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(og); og.connect(ctx.destination); o.start(t); o.stop(t + 0.08);
      const rel = mk(0.002, 0.18, t + 0.06);
      rel.onended = () => ctx.close();
    } catch {}
  }

  function set(theme) {
    if (!VALID.includes(theme)) theme = 'dark';
    const wasLight = get() === 'light';
    localStorage.setItem(KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (wasLight !== (theme === 'light')) playClick(theme === 'light');
    renderSwitcher();
  }

  function mountSwitcher(container) {
    container.innerHTML = `
      <div class="theme-switcher" id="theme-switcher">
        <button class="theme-switcher-btn" id="theme-switcher-btn" title="Tema">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="theme-icon">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>
        <div class="theme-switcher-menu" id="theme-menu">
          <button class="theme-option" data-theme="dark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <span>Escuro</span>
            <svg class="theme-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button class="theme-option" data-theme="light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></svg>
            <span>Claro</span>
            <svg class="theme-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button class="theme-option" data-theme="auto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>Automatico</span>
            <svg class="theme-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>
      </div>`;
    const sw = container.querySelector('#theme-switcher');
    container.querySelector('#theme-switcher-btn').addEventListener('click', e => {
      e.stopPropagation(); sw.classList.toggle('open');
    });
    container.querySelectorAll('.theme-option').forEach(opt => {
      opt.addEventListener('click', () => { set(opt.dataset.theme); sw.classList.remove('open'); });
    });
    document.addEventListener('click', e => { if (!sw.contains(e.target)) sw.classList.remove('open'); });
    renderSwitcher();
  }

  function renderSwitcher() {
    const cur = get();
    document.querySelectorAll('.theme-option').forEach(o => o.classList.toggle('active', o.dataset.theme === cur));
    const icon = document.getElementById('theme-icon');
    if (icon) {
      if (cur === 'dark') icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      else if (cur === 'light') icon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/>';
      else icon.innerHTML = '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
    }
  }

  // aplica imediatamente (evita flash)
  document.documentElement.setAttribute('data-theme', get());
  return { get, set, mountSwitcher };
})();
window.Theme = Theme;
