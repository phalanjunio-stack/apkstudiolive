/* ============================================================
   PROGBAR — DOIS controladores lado a lado:
   • esquerda  = o vídeo que está no PROGRAMA (no ar)
   • direita   = o vídeo que está no PREVIEW (pré)
   Cada um controla o SEU deck. Funciona pra VÍDEO comum e PLAYLIST:
   - vídeo: ⏮/⏭ = -10s/+10s · Loop
   - playlist: ⏮/⏭ = anterior/próximo · A SEGUIR · Auto (deck do AR)
   ============================================================ */
(function () {
  let bar = null, built = false, units = [];
  const VP = () => window.VideoPlaylist;
  const fmt = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const cl = x => Math.max(0, Math.min(1, x));

  const UNIT_HTML =
    '<div class="pb-onair pb-status"><span class="pb-dot"></span><span class="pb-statustx">NO AR</span></div>' +
    '<button class="pb-tb pb-prev" title="Anterior / voltar 10s">&#9198;</button>' +
    '<button class="pb-play" title="Play/Pause">&#9654;</button>' +
    '<button class="pb-tb pb-skip" title="Próximo / avançar 10s">&#9197;</button>' +
    '<button class="pb-tb pb-cue" title="Voltar ao início e pausar (modo espera)">&#8634;</button>' +
    '<div class="pb-seek"><div class="pb-bar"></div></div>' +
    '<span class="pb-time">0:00 / 0:00</span>' +
    '<div class="pb-vol"><span class="pb-vico">&#128266;</span>' +
      '<input type="range" min="0" max="100" value="100" title="Volume do vídeo"></div>' +
    '<div class="pb-next">' +
      '<div class="pb-next-tx"><span class="pb-next-lb">A SEGUIR</span><span class="pb-next-nm">—</span></div>' +
      '<button class="pb-auto pb-autob" title="Continuar sozinho ao terminar">Auto</button>' +
    '</div>' +
    '<button class="pb-auto pb-loop" title="Repetir o vídeo">Loop</button>';

  function makeUnit(role) {
    const u = { role, cur: null };
    const root = document.createElement('div'); root.className = 'pb-unit'; root.hidden = true;
    root.innerHTML = UNIT_HTML;
    u.root = root; const q = s => root.querySelector(s); u.q = q;
    q('.pb-play').onclick = () => u.cur && u.cur.toggle();
    q('.pb-prev').onclick = () => u.cur && u.cur.prev();
    q('.pb-skip').onclick = () => u.cur && u.cur.next();
    q('.pb-cue').onclick = () => u.cur && u.cur.cue && u.cur.cue();
    q('.pb-autob').onclick = () => { if (u.cur && u.cur.setAuto) u.cur.setAuto(!u.cur.auto()); };
    q('.pb-loop').onclick = () => { if (u.cur && u.cur.setLoop) u.cur.setLoop(!u.cur.loop()); };
    const seek = q('.pb-seek');
    seek.addEventListener('pointerdown', e => { if (!u.cur || !u.cur.dur()) return; const r = seek.getBoundingClientRect(); u.cur.seek(cl((e.clientX - r.left) / r.width)); });
    const vol = q('.pb-vol input'); u.vol = vol;
    vol.addEventListener('input', () => { if (u.cur && u.cur.setVolume) u.cur.setVolume(vol.value / 100); });
    return u;
  }

  function build() {
    if (built) return;
    const monitors = document.querySelector('.dash .main .monitors');
    if (!monitors) return;
    built = true;
    bar = document.createElement('div'); bar.className = 'progbar'; bar.id = 'progBar'; bar.hidden = true;
    units = [makeUnit('preview'), makeUnit('program')]; // PRÉ na esquerda, NO AR na direita (igual aos monitores)
    units.forEach(u => bar.appendChild(u.root));
    monitors.after(bar);
    requestAnimationFrame(tick);
  }

  // a fonte de vídeo que está nesse slot (program ou preview)?
  function activeFor(role) {
    if (!window.Studio) return null;
    let st = {}; try { st = window.Studio.state(); } catch {}
    const id = role === 'program' ? st.program : st.preview;
    if (!id) return null;
    let k = null; try { k = window.Studio.sourceKind(id); } catch {}
    if (k === 'playlist' || k === 'video') return { id, kind: k, isProgram: role === 'program' };
    return null;
  }

  function buildCtl(as) {
    if (as.kind === 'playlist') {
      const v = VP(); if (!v || v.sourceId !== as.id) return null;
      // controla o deck do AR (não o CUE do mini-player)
      return {
        playlist: true, playing: () => v.airPlaying(), toggle: () => v.airToggle(), seek: (f) => v.airSeek(f),
        time: () => v.airTime(), dur: () => v.airDur(), volume: () => v.airVolume(), setVolume: (x) => v.setAirVolume(x),
        cue: () => v.airCue(), prev: () => v.airPrev(), next: () => v.airNext(),
        auto: () => v.auto(), setAuto: (b) => v.setAuto(b),
        nextName: () => { const ni = v.airNextIndex(); return (ni >= 0 && v.list()[ni]) ? v.list()[ni].name : (v.loopAll() ? '↻ reinicia a fila' : '— fim da fila —'); },
      };
    }
    const el = window.Studio.mediaElFor ? window.Studio.mediaElFor(as.id) : null;
    if (!el) return null;
    return {
      playlist: false, playing: () => !el.paused, toggle: () => { el.paused ? el.play().catch(() => {}) : el.pause(); },
      seek: (f) => { if (el.duration) el.currentTime = el.duration * f; }, time: () => el.currentTime || 0, dur: () => el.duration || 0,
      volume: () => el.volume, setVolume: (x) => { el.volume = cl(x); }, cue: () => { try { el.pause(); el.currentTime = 0; } catch {} },
      prev: () => { try { el.currentTime = Math.max(0, el.currentTime - 10); } catch {} },
      next: () => { try { if (el.duration) el.currentTime = Math.min(el.duration, el.currentTime + 10); } catch {} },
      loop: () => el.loop, setLoop: (b) => { el.loop = !!b; },
    };
  }

  function updateUnit(u) {
    const as = activeFor(u.role);
    u.cur = as ? buildCtl(as) : null;
    const show = !!u.cur;
    if (u.root.hidden === show) u.root.hidden = !show;
    if (!show) return;
    const c = u.cur, q = u.q, isProg = u.role === 'program';
    const stx = q('.pb-statustx'); const lbl = isProg ? 'NO AR' : 'PRÉ'; if (stx.textContent !== lbl) stx.textContent = lbl;
    u.root.classList.toggle('pre', !isProg);
    u.root.classList.toggle('is-playlist', !!c.playlist);
    q('.pb-play').innerHTML = c.playing() ? '&#9208;' : '&#9654;';
    const bv = q('.pb-bar'); if (bv) bv.style.width = (c.dur() ? (c.time() / c.dur() * 100) : 0) + '%';
    q('.pb-time').textContent = fmt(c.time()) + ' / ' + fmt(c.dur() || 0);
    if (document.activeElement !== u.vol) { const vv = Math.round((c.volume ? c.volume() : 1) * 100); u.vol.value = vv; q('.pb-vico').innerHTML = vv === 0 ? '&#128263;' : '&#128266;'; }
    if (c.playlist) {
      const nx = q('.pb-next-nm'); const txt = c.nextName(); if (nx.textContent !== txt) { nx.textContent = txt; nx.title = txt; }
      q('.pb-autob').classList.toggle('on', c.auto());
    } else {
      q('.pb-loop').classList.toggle('on', c.loop());
    }
    u.root.classList.toggle('playing', c.playing());
  }

  function tick() {
    if (bar) {
      units.forEach(updateUnit);
      const any = units.some(u => !u.root.hidden);
      if (bar.hidden === any) bar.hidden = !any;
    }
    requestAnimationFrame(tick);
  }

  function init() { build(); if (!built) setTimeout(init, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
