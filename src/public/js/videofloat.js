/* ============================================================
   VIDEO FLOAT — player flutuante da playlist de vídeo
   Miniatura do que está rodando (canvas), preview do PRÓXIMO
   vídeo (sem áudio) e botão "No ar" com transição (fundido).
   ============================================================ */
(function () {
  const KEY = 'kivo-vpf-pos', CKEY = 'kivo-vpf-collapsed';
  const VP = () => window.VideoPlaylist;
  let w = null, built = false, closed = false, bound = null, cv = null, ctx = null, nextV = null, lastNext = '', lastRatio = '';

  function build() {
    if (built) return; built = true;
    w = document.createElement('div'); w.className = 'vpf'; w.id = 'vpFloat'; w.hidden = true;
    w.innerHTML =
      '<div class="vpf-thumb" id="vpfThumb"><canvas id="vpfCanvas" width="360" height="202"></canvas>' +
        '<span class="vpf-grip" title="Arraste">&#8942;&#8942;</span>' +
        '<div class="vpf-thumb-btns">' +
          '<button class="vpf-collapse" id="vpfCollapse" title="Recolher">&#9662;</button>' +
          '<button class="vpf-x" id="vpfX" title="Fechar">&times;</button></div>' +
        '<button class="vpf-expand" id="vpfExpand" title="Abrir player">&#9654;</button></div>' +
      '<div class="vpf-main">' +
        '<button class="vpf-play" id="vpfPlay" title="Play/Pause">&#9654;</button>' +
        '<div class="vpf-info" id="vpfInfo" title="Abrir lista">' +
          '<span class="vpf-title" id="vpfTitle">—</span><span class="vpf-sub">Playlist de vídeo</span></div>' +
        '<div class="vpf-actions">' +
          '<button id="vpfPrev" title="Anterior">&#9198;</button>' +
          '<button id="vpfSkip" title="Próximo">&#9197;</button>' +
          '<button id="vpfCue" title="Voltar ao início e pausar (espera)">&#8634;</button>' +
          '<button class="vpf-list" id="vpfList" title="Abrir lista">&#9776;</button>' +
        '</div>' +
      '</div>' +
      '<div class="vpf-seek" id="vpfSeek"><div class="vpf-bar" id="vpfBar"></div></div>' +
      '<div class="vpf-foot">' +
        '<div class="vpf-next" title="Próximo vídeo (sem áudio)"><video class="vpf-nx-v" id="vpfNext" muted playsinline></video>' +
          '<div class="vpf-nx-tx"><span class="vpf-nx-lb">A SEGUIR</span><span class="vpf-nx-nm" id="vpfNextNm">—</span></div></div>' +
        '<button class="vpf-air" id="vpfAir" title="Pôr no ar com transição (fundido)">&#9654; No ar &#10024;</button>' +
      '</div>';
    document.body.appendChild(w);
    cv = w.querySelector('#vpfCanvas'); ctx = cv.getContext('2d', { alpha: false });
    nextV = w.querySelector('#vpfNext');
    nextV.addEventListener('loadeddata', () => { try { nextV.currentTime = 0.04; } catch {} });
    try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p) { w.style.left = p.x + 'px'; w.style.top = p.y + 'px'; w.style.right = 'auto'; w.style.bottom = 'auto'; } } catch {}
    const on = (id, fn) => { const b = w.querySelector('#' + id); if (b) b.onclick = fn; };
    on('vpfPlay', () => VP() && VP().toggle());
    on('vpfPrev', () => VP() && VP().prev());
    on('vpfSkip', () => VP() && VP().next());
    on('vpfCue', () => { const v = VP(); if (v && v.cue) v.cue(); });
    on('vpfAir', () => { const v = VP(); if (v && v.commitAir) v.commitAir(); });
    const openList = () => { if (window.openPlaylistModal) window.openPlaylistModal('video'); };
    on('vpfList', openList); w.querySelector('#vpfInfo').onclick = openList;
    on('vpfX', () => { closed = true; w.hidden = true; });
    const setCollapsed = (c) => { w.classList.toggle('collapsed', c); try { localStorage.setItem(CKEY, c ? '1' : '0'); } catch {} };
    on('vpfCollapse', () => setCollapsed(true));
    on('vpfExpand', () => setCollapsed(false));
    w.querySelector('#vpfThumb').addEventListener('click', e => { if (w.classList.contains('collapsed') && !e.target.closest('.vpf-grip')) setCollapsed(false); });
    try { if (localStorage.getItem(CKEY) === '1') w.classList.add('collapsed'); } catch {}
    const seek = w.querySelector('#vpfSeek');
    seek.addEventListener('pointerdown', e => { const v = VP(); if (!v || !v.dur()) return; const r = seek.getBoundingClientRect(); v.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); });
    dragBy(w.querySelector('.vpf-grip'));
    dragBy(w.querySelector('.vpf-main'));
    requestAnimationFrame(tick);
  }

  function dragBy(handle) {
    if (!handle) return;
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button, .vpf-info')) return;
      e.preventDefault();
      const r = w.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      try { handle.setPointerCapture(e.pointerId); } catch {}
      w.classList.add('drag');
      const mv = ev => {
        let x = ev.clientX - ox, y = ev.clientY - oy;
        x = Math.max(4, Math.min(innerWidth - w.offsetWidth - 4, x));
        y = Math.max(4, Math.min(innerHeight - w.offsetHeight - 4, y));
        w.style.left = x + 'px'; w.style.top = y + 'px'; w.style.right = 'auto'; w.style.bottom = 'auto';
      };
      const up = () => { w.classList.remove('drag'); handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); try { localStorage.setItem(KEY, JSON.stringify({ x: parseInt(w.style.left), y: parseInt(w.style.top) })); } catch {} };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
    });
  }

  function drawFrame(el) {
    const vw = el.videoWidth, vh = el.videoHeight; if (!vw || !vh) return;
    if (cv.width !== vw || cv.height !== vh) { cv.width = vw; cv.height = vh; }
    try { ctx.drawImage(el, 0, 0, vw, vh); } catch {} // frame INTEIRO (sem cortar)
    const r = vw + '/' + vh;
    if (r !== lastRatio) { // miniatura + player no FORMATO do vídeo (9:16, 16:9, 1:1...)
      lastRatio = r;
      const thumb = w.querySelector('#vpfThumb'); if (thumb) thumb.style.aspectRatio = r;
      let pw = Math.round(250 * (vw / vh)); pw = Math.max(168, Math.min(330, pw));
      w.style.setProperty('--pw', pw + 'px');
    }
  }

  function updNext(v) {
    const ni = v.nextIndex ? v.nextIndex() : -1;
    const it = (ni >= 0 && v.list()[ni]) ? v.list()[ni] : null;
    const nm = it ? it.name : (v.loopAll() ? '↻ reinicia' : '— fim —');
    if (nm !== lastNext) {
      lastNext = nm;
      const el = w.querySelector('#vpfNextNm'); if (el) { el.textContent = nm; el.title = nm; }
      if (it && nextV && nextV.src !== it.url) { try { nextV.src = it.url; } catch {} }
      else if (!it && nextV) { try { nextV.removeAttribute('src'); nextV.load(); } catch {} }
    }
  }

  function tick() {
    const v = VP();
    if (w && !w.hidden && v) {
      const el = v.el ? v.el() : null; if (el) drawFrame(el);
      const bar = w.querySelector('#vpfBar'); if (bar) bar.style.width = (v.dur() ? (v.time() / v.dur() * 100) : 0) + '%';
      const idx = v.current() >= 0 ? v.current() : 0;
      const nm = v.list()[idx] ? v.list()[idx].name : '';
      const t = w.querySelector('#vpfTitle'); if (t && t.textContent !== (nm || '—')) { t.textContent = nm || '—'; t.title = nm || ''; }
      w.querySelector('#vpfPlay').innerHTML = v.playing() ? '&#9208;' : '&#9654;';
      w.classList.toggle('playing', v.playing());
      let stt = {}; try { stt = window.Studio ? window.Studio.state() : {}; } catch {}
      w.querySelector('#vpfAir').classList.toggle('act', stt.program === v.sourceId);
      updNext(v);
    }
    if (v && v !== bound) { bound = v; closed = false; build(); if (w) w.hidden = false; lastNext = ''; }
    else if (!v && bound) { bound = null; if (w) w.hidden = true; }
    requestAnimationFrame(tick);
  }

  // reabrir o mini-player (duplo-clique na fonte playlist / atalho)
  window.VideoFloat = {
    open: () => { build(); if (!w) return; closed = false; w.hidden = !VP(); w.classList.remove('collapsed'); try { localStorage.setItem(CKEY, '0'); } catch {} },
  };

  function init() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
