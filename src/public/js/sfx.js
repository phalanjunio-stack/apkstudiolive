/* ============================================
   SOUND FX — efeitos sonoros de UI (Web Audio API)
   Sintetizados em tempo real: sem arquivos, sem latencia.
   Portado/adaptado do Contourline (sitelocal).
   ============================================ */
const SoundFX = (() => {
  let _ctx = null, _master = null;
  let _vol = parseFloat(localStorage.getItem('sl-sfx-vol') ?? '0.32');
  let _enabled = localStorage.getItem('sl-sfx-enabled') !== 'false';
  let _hoverThrottle = 0;
  let _userGestured = false;

  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(ev => {
    window.addEventListener(ev, () => { _userGestured = true; }, { once: true, capture: true });
  });

  function _ac() {
    if (!_userGestured) return null; // respeita autoplay policy
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        _master = _ctx.createGain();
        _master.gain.value = _vol;
        _master.connect(_ctx.destination);
      } catch { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  }

  // nota com envelope suave
  function _note(type, freq, start, dur, peak = 0.25, attack = 0.008, freqEnd = null) {
    const o = _ctx.createOscillator(), g = _ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(_master);
    o.start(start); o.stop(start + dur + 0.02);
  }
  function _noise(start, dur, gain = 0.2) {
    const buf = _ctx.createBuffer(1, _ctx.sampleRate * dur, _ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = _ctx.createBufferSource(); src.buffer = buf;
    const g = _ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    const f = _ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    src.connect(f); f.connect(g); g.connect(_master);
    src.start(start); src.stop(start + dur + 0.01);
  }

  // ── Sons ──
  function hover() {
    if (!_enabled) return;
    const now = Date.now();
    if (now - _hoverThrottle < 80) return;
    _hoverThrottle = now;
    const ac = _ac(); if (!ac) return;
    const t = ac.currentTime;
    _note('sine', 1568, t, 0.10, 0.09, 0.006);        // G6 tick
    _note('sine', 3136, t + 0.004, 0.06, 0.035, 0.004); // sparkle
  }
  function click() {
    if (!_enabled) return; const ac = _ac(); if (!ac) return; const t = ac.currentTime;
    _note('sine', 880, t, 0.12, 0.16, 0.005);
    _note('sine', 440, t + 0.002, 0.16, 0.09, 0.008);
  }
  function open() {
    if (!_enabled) return; const ac = _ac(); if (!ac) return; const t = ac.currentTime;
    _note('sine', 300, t, 0.18, 0.26, 0.04, 600);
  }
  function close() {
    if (!_enabled) return; const ac = _ac(); if (!ac) return; const t = ac.currentTime;
    _note('sine', 600, t, 0.20, 0.26, 0.012, 300);
    _note('sine', 1200, t + 0.02, 0.10, 0.05, 0.006);
  }
  function success() {
    if (!_enabled) return; const ac = _ac(); if (!ac) return; const t = ac.currentTime;
    _note('sine', 523, t, 0.22, 0.24, 0.010);
    _note('sine', 659, t + 0.10, 0.24, 0.24, 0.010);
    _note('sine', 784, t + 0.20, 0.30, 0.22, 0.012);
    _note('sine', 1568, t + 0.20, 0.20, 0.09, 0.008);
  }
  function error() {
    if (!_enabled) return; const ac = _ac(); if (!ac) return; const t = ac.currentTime;
    _note('square', 330, t, 0.18, 0.14, 0.005, 165);
    _noise(t, 0.12, 0.05);
  }
  // whoosh de transição (troca de menu)
  function navigate() {
    if (!_enabled) return; const ac = _ac(); if (!ac) return; const t = ac.currentTime;
    _note('sine', 220, t, 0.18, 0.09, 0.010, 880);   // sweep grave→agudo
    _noise(t, 0.10, 0.05);
    _note('sine', 1760, t + 0.10, 0.12, 0.035, 0.006); // sparkle no fim
  }
  // COMEMORAÇÃO DE GOL — fanfarra ascendente + torcida (sintetizado, sem arquivo)
  function _crowd(start, dur) {
    const buf = _ctx.createBuffer(1, _ctx.sampleRate * dur, _ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = _ctx.createBufferSource(); src.buffer = buf;
    const g = _ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.11, start + 0.5);
    g.gain.linearRampToValueAtTime(0.075, start + dur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    const f = _ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 850; f.Q.value = 0.6;
    src.connect(f); f.connect(g); g.connect(_master);
    src.start(start); src.stop(start + dur + 0.02);
  }
  function goal() {
    if (!_enabled) return; const ac = _ac(); if (!ac) return; const t = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => _note('triangle', f, t + i * 0.11, 0.5, 0.22, 0.008)); // C5 E5 G5 C6
    _note('triangle', 1046.5, t + 0.46, 0.7, 0.2, 0.01);
    _note('sine', 2093, t + 0.46, 0.5, 0.05, 0.006);   // brilho
    _crowd(t, 1.5);                                     // torcida
  }

  // ── Hook global nos meus elementos ──
  function _hookGlobal() {
    document.addEventListener('click', e => {
      const el = e.target.closest('button, a, [role="button"], .nav a, .fcard, .ctrl, .bigbtn, .icon-btn, .theme-option');
      if (!el || el.disabled || el.classList.contains('empty')) return;
      if (el.closest('.nav-link, .nav a')) return; // troca de menu já toca navigate()
      click();
    }, true);
    document.addEventListener('mouseover', e => {
      const el = e.target.closest('.fcard:not(.empty), .mvcell:not(.empty), .ctrl, .bigbtn, .nav a, .icon-btn, .device, .theme-option, .take, .cut');
      if (el && !el.disabled) hover();
    }, true);
  }

  // ── Toggle de som (icone no topbar) ──
  function createToggle() {
    const btn = document.createElement('button');
    btn.className = 'icon-btn sfx-toggle-btn';
    btn.title = _enabled ? 'Som ligado' : 'Som desligado';
    btn.innerHTML = _icon(_enabled);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _enabled = !_enabled;
      localStorage.setItem('sl-sfx-enabled', _enabled);
      btn.innerHTML = _icon(_enabled);
      btn.title = _enabled ? 'Som ligado' : 'Som desligado';
      if (_enabled) success();
    });
    return btn;
  }
  function _icon(on) {
    return on
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  }

  return {
    hover, click, open, close, success, error, navigate, goal, createToggle,
    init() { _hookGlobal(); },
  };
})();
window.SoundFX = SoundFX;
