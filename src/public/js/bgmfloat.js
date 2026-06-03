/* ============================================
   BGM FLOAT — mini-player flutuante e arrastável
   Aparece quando uma música toca; arrasta pra qualquer
   canto da tela. (estilo do player do sitelocal)
   ============================================ */
(function () {
  const KEY = 'sl-bgmfloat-pos';
  const CKEY = 'kivo-bgmf-collapsed';
  let w = null, built = false, closed = false, lastIdx = -2;

  function fmt(s) { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  function build() {
    if (built) return; built = true;
    w = document.createElement('div'); w.className = 'bgmf'; w.id = 'bgmFloat'; w.hidden = true;
    w.innerHTML =
      '<button class="bgmf-mini" id="bgmfMini" title="Abrir player"><span class="bgmf-eqc"><i></i><i></i><i></i></span></button>' +
      '<div class="bgmf-main">' +
        '<span class="bgmf-grip" title="Arraste">&#8942;&#8942;</span>' +
        '<button class="bgmf-play" id="bgmfPlay" title="Play/Pause">&#9654;</button>' +
        '<div class="bgmf-info" id="bgmfInfo" title="Abrir playlist">' +
          '<span class="bgmf-title" id="bgmfTitle">—</span>' +
          '<span class="bgmf-sub">Playlist de música</span>' +
        '</div>' +
        '<div class="bgmf-actions">' +
          '<button id="bgmfPrev" title="Anterior">&#9198;</button>' +
          '<button id="bgmfNext" title="Próxima">&#9197;</button>' +
          '<button class="bgmf-list" id="bgmfList" title="Abrir playlist">&#9776;</button>' +
          '<button class="bgmf-collapse" id="bgmfCollapse" title="Recolher">&#9662;</button>' +
          '<button class="bgmf-x" id="bgmfX" title="Fechar">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="bgmf-seek" id="bgmfSeek"><div class="bgmf-bar" id="bgmfBar"></div></div>';
    document.body.appendChild(w);
    try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p) { w.style.left = p.x + 'px'; w.style.top = p.y + 'px'; w.style.right = 'auto'; w.style.bottom = 'auto'; } } catch {}
    w.querySelector('#bgmfPlay').onclick = () => window.BgMusic && window.BgMusic.toggle();
    w.querySelector('#bgmfPrev').onclick = () => window.BgMusic && window.BgMusic.prev();
    w.querySelector('#bgmfNext').onclick = () => window.BgMusic && window.BgMusic.next();
    w.querySelector('#bgmfX').onclick = () => { closed = true; w.hidden = true; };
    const setCollapsed = (on) => { w.classList.toggle('collapsed', on); try { localStorage.setItem(CKEY, on ? '1' : '0'); } catch {} };
    w.querySelector('#bgmfCollapse').onclick = () => setCollapsed(true);
    w.querySelector('#bgmfMini').onclick = () => setCollapsed(false);
    try { if (localStorage.getItem(CKEY) === '1') w.classList.add('collapsed'); } catch {}
    const openList = () => { if (window.openPlaylistModal) window.openPlaylistModal('audio'); };
    w.querySelector('#bgmfList').onclick = openList;
    w.querySelector('#bgmfInfo').onclick = openList;
    const seek = w.querySelector('#bgmfSeek');
    seek.addEventListener('pointerdown', e => { const a = window.BgMusic && window.BgMusic.audio; if (!a || !a.duration) return; const r = seek.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration; });
    dragBy(w.querySelector('.bgmf-main'));
    requestAnimationFrame(tick);
  }

  function dragBy(handle) {
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button, .bgmf-info')) return;
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

  function tick() {
    const a = window.BgMusic && window.BgMusic.audio;
    if (w && !w.hidden && a) {
      const bar = w.querySelector('#bgmfBar');
      if (bar) bar.style.width = (a.duration ? (a.currentTime / a.duration * 100) : 0) + '%';
      const t = w.querySelector('#bgmfTime'); if (t) t.textContent = fmt(a.currentTime) + ' / ' + fmt(a.duration || 0);
    }
    requestAnimationFrame(tick);
  }

  function update(s) {
    build(); if (!w) return;
    if (s.idx !== lastIdx) { lastIdx = s.idx; if (s.current) closed = false; } // música nova reabre
    const has = !!s.current;
    w.hidden = !has || closed;
    if (s.current) w.querySelector('#bgmfTitle').textContent = s.current.name;
    w.querySelector('#bgmfPlay').innerHTML = s.paused ? '&#9654;' : '&#9208;';
    w.classList.toggle('playing', !s.paused);
  }

  function init() { if (!window.BgMusic) return setTimeout(init, 250); build(); window.BgMusic.onUpdate(update); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
