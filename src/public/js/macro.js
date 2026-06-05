/* ============================================
   MACRO "GOL" (Live Macro / Bloco de Ação) — animação no PROGRAM + som, auto-some em 4s.
   window.Macro.gol(texto). Botão flutuante ⚽ GOL. Som = synth WebAudio (toque no fone do operador).
   ============================================ */
(function () {
  let ac = null;
  function cheer() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime;
      for (let i = 0; i < 3; i++) {
        const o = ac.createOscillator(), g = ac.createGain(), st = t + i * 0.13;
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300 + i * 70, st);
        o.frequency.exponentialRampToValueAtTime(640 + i * 90, st + 0.4);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.16, st + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);
        o.connect(g); g.connect(ac.destination); o.start(st); o.stop(st + 0.55);
      }
    } catch (e) {}
  }
  function gol(text) {
    const host = document.getElementById('pgmOverlay') || document.body;
    const el = document.createElement('div'); el.className = 'macro-gol';
    el.innerHTML = '<div class="mg-in"><span class="mg-ball">⚽</span><span class="mg-tx">' + (text || 'GOL!') + '</span></div>';
    host.appendChild(el); cheer();
    setTimeout(() => { el.classList.add('mg-out'); setTimeout(() => el.remove(), 500); }, 4000);
    return el;
  }
  function init() {
    if (!document.getElementById('btnGol')) {
      const b = document.createElement('button'); b.id = 'btnGol'; b.className = 'macro-fab';
      b.title = 'Macro GOL — animação + som no ar (4s). Dá pra ligar num número/pad depois.';
      b.innerHTML = '⚽ GOL';
      b.onclick = () => gol('GOL!');
      document.body.appendChild(b);
    }
    window.Macro = { gol, cheer };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
