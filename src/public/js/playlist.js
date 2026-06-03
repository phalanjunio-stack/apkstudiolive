/* ============================================
   PLAYLIST DE VÍDEOS — painel flutuante e arrastável
   Fila de vídeos numa fonte só: toque/pule qualquer um
   com 1 clique, avança sozinho. Pré/AR direto pelo painel.
   ============================================ */
(function () {
  const KEY = 'kivo-vplaylist-pos';
  const SZ = 'kivo-vplaylist-size';
  let w = null, built = false, closed = false, bound = null, lastLen = -1, dragIdx = null;

  function fmt(s) { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function VP() { return window.VideoPlaylist || null; }

  function build() {
    if (built) return; built = true;
    w = document.createElement('div'); w.className = 'vpl'; w.id = 'vplFloat'; w.hidden = true;
    w.innerHTML =
      '<div class="vpl-head"><span class="vpl-ic"><i></i><i></i><i></i></span>' +
      '<span class="vpl-title">Playlist de vídeos</span>' +
      '<span class="vpl-count" id="vplCount">0</span>' +
      '<button class="vpl-x" id="vplX" title="Esconder">&times;</button></div>' +
      '<div class="vpl-list" id="vplList"></div>' +
      '<div class="vpl-seek" id="vplSeek"><div class="vpl-bar" id="vplBar"></div></div>' +
      '<div class="vpl-ctrls">' +
      '<button id="vplPrev" title="Anterior">&#9198;</button>' +
      '<button class="vpl-play" id="vplPlay" title="Play/Pause">&#9654;</button>' +
      '<button id="vplNext" title="Próximo">&#9197;</button>' +
      '<span class="vpl-time" id="vplTime">0:00 / 0:00</span></div>' +
      '<div class="vpl-foot">' +
      '<button class="vpl-t on" id="vplAuto" title="Avançar sozinho ao terminar">Auto</button>' +
      '<button class="vpl-t on" id="vplLoop" title="Repetir a fila toda">Loop</button>' +
      '<button class="vpl-add" id="vplAdd" title="Adicionar mais vídeos">+ vídeos</button>' +
      '<button class="vpl-pre" id="vplPre" title="Mostrar no PREVIEW">Pré</button>' +
      '<button class="vpl-air" id="vplAir" title="Cortar pro AR (PROGRAM)">No ar</button>' +
      '</div>' +
      '<div class="vpl-rz" id="vplRz" title="Arraste para redimensionar"></div>';
    document.body.appendChild(w);
    try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p) { w.style.left = p.x + 'px'; w.style.top = p.y + 'px'; w.style.right = 'auto'; w.style.bottom = 'auto'; } } catch {}
    try { const s = JSON.parse(localStorage.getItem(SZ) || 'null'); if (s && s.w) { w.style.width = s.w + 'px'; w.style.height = s.h + 'px'; } } catch {}
    const on = (id, fn) => { const b = w.querySelector('#' + id); if (b) b.onclick = fn; };
    on('vplPlay', () => VP() && VP().toggle());
    on('vplPrev', () => VP() && VP().prev());
    on('vplNext', () => VP() && VP().next());
    on('vplX', () => { closed = true; w.hidden = true; });
    on('vplAuto', () => { const v = VP(); if (v) v.setAuto(!v.auto()); });
    on('vplLoop', () => { const v = VP(); if (v) v.setLoopAll(!v.loopAll()); });
    on('vplAdd', () => { const v = VP(); if (!v) return; const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*'; i.multiple = true; i.onchange = () => { if (i.files.length) v.add(i.files); }; i.click(); });
    on('vplPre', () => { const v = VP(); if (v && window.Studio) window.Studio.setPreview(v.sourceId); });
    on('vplAir', () => { const v = VP(); if (v && window.Studio) window.Studio.setProgram(v.sourceId); });
    const seek = w.querySelector('#vplSeek');
    seek.addEventListener('pointerdown', e => { const v = VP(); if (!v || !v.dur()) return; const r = seek.getBoundingClientRect(); v.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); });
    dragBy(w.querySelector('.vpl-head'));
    resizeBy(w.querySelector('#vplRz'));
    requestAnimationFrame(tick);
  }

  function resizeBy(handle) {
    if (!handle) return;
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const r = w.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, sw = r.width, sh = r.height;
      try { handle.setPointerCapture(e.pointerId); } catch {}
      w.classList.add('rz');
      const mv = ev => {
        const nw = Math.max(252, Math.min(640, sw + (ev.clientX - sx)));
        const nh = Math.max(220, Math.min(innerHeight - 16, sh + (ev.clientY - sy)));
        w.style.width = nw + 'px'; w.style.height = nh + 'px';
      };
      const up = () => { w.classList.remove('rz'); handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); try { localStorage.setItem(SZ, JSON.stringify({ w: parseInt(w.style.width), h: parseInt(w.style.height) })); } catch {} };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
    });
  }

  function dragBy(handle) {
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
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

  function renderList() {
    const v = VP(); if (!v) return;
    const box = w.querySelector('#vplList'); if (!box) return;
    const arr = v.list(), cur = v.current();
    box.innerHTML = '';
    const clearTargets = () => box.querySelectorAll('.vpl-row').forEach(r => r.classList.remove('drop-tp', 'drop-bt'));
    arr.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'vpl-row' + (i === cur ? ' cur' : '');
      row.draggable = true;
      row.innerHTML = '<span class="vpl-grip" title="Arraste para reordenar">&#8942;&#8942;</span>' +
        '<span class="vpl-n">' + (i + 1) + '</span><span class="vpl-name"></span>' +
        '<span class="vpl-go">' + (i === cur ? '&#9654;' : '') + '</span>' +
        '<button class="vpl-rm" title="Remover da lista">&times;</button>';
      row.querySelector('.vpl-name').textContent = it.name;
      row.title = it.name;
      row.onclick = e => { if (e.target.closest('.vpl-rm')) return; v.playAt(i); };
      row.querySelector('.vpl-rm').onclick = e => { e.stopPropagation(); v.removeAt(i); renderList(); };
      row.addEventListener('dragstart', e => { dragIdx = i; row.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch {} });
      row.addEventListener('dragend', () => { dragIdx = null; row.classList.remove('dragging'); clearTargets(); });
      row.addEventListener('dragover', e => {
        if (dragIdx == null || dragIdx === i) return;
        e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch {}
        const r = row.getBoundingClientRect(), after = (e.clientY - r.top) > r.height / 2;
        row.classList.toggle('drop-bt', after); row.classList.toggle('drop-tp', !after);
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-tp', 'drop-bt'));
      row.addEventListener('drop', e => {
        e.preventDefault(); row.classList.remove('drop-tp', 'drop-bt');
        if (dragIdx == null || dragIdx === i) return;
        const r = row.getBoundingClientRect(), after = (e.clientY - r.top) > r.height / 2;
        let to = after ? i + 1 : i; if (dragIdx < to) to--;
        const from = dragIdx; dragIdx = null; v.move(from, to); renderList();
      });
      box.appendChild(row);
    });
    lastLen = arr.length;
  }

  function update() {
    const v = VP(); if (!w || !v) return;
    if (closed) return;
    w.hidden = false;
    if (dragIdx == null) {                                    // não mexe na lista enquanto arrasta
      if (v.list().length !== lastLen) renderList();
      else {
        const cur = v.current(), rows = w.querySelectorAll('.vpl-row');
        rows.forEach((r, i) => { const on = i === cur; r.classList.toggle('cur', on); const go = r.querySelector('.vpl-go'); if (go) go.innerHTML = on ? '&#9654;' : ''; });
      }
    }
    w.querySelector('#vplCount').textContent = v.list().length;
    w.querySelector('#vplPlay').innerHTML = v.playing() ? '&#9208;' : '&#9654;';
    w.classList.toggle('playing', v.playing());
    w.querySelector('#vplAuto').classList.toggle('on', v.auto());
    w.querySelector('#vplLoop').classList.toggle('on', v.loopAll());
    // destaca Pré/AR conforme o estado da fonte
    let st = {}; try { st = window.Studio ? window.Studio.state() : {}; } catch {}
    w.querySelector('#vplPre').classList.toggle('act', st.preview === v.sourceId);
    w.querySelector('#vplAir').classList.toggle('act', st.program === v.sourceId);
  }

  function tick() {
    const v = VP();
    if (w && !w.hidden && v) {
      const bar = w.querySelector('#vplBar'); if (bar) bar.style.width = (v.dur() ? (v.time() / v.dur() * 100) : 0) + '%';
      const t = w.querySelector('#vplTime'); if (t) t.textContent = fmt(v.time()) + ' / ' + fmt(v.dur() || 0);
      // detecta troca de Pré/AR sem esperar evento
      try { update(); } catch {}
    }
    // (re)vincula quando uma nova playlist é criada; some quando é removida
    const v2 = VP();
    if (v2 && v2 !== bound) { bound = v2; closed = true; build(); v2.onUpdate(update); lastLen = -1; update(); } // não auto-abre: o modal de Playlist é o lar agora
    else if (!v2 && bound) { bound = null; if (w) w.hidden = true; }
    requestAnimationFrame(tick);
  }

  // controle externo (o dock no rodapé abre/fecha o painel completo por aqui)
  window.VideoPlaylistUI = {
    open: () => { build(); closed = false; if (w) w.hidden = false; },
    close: () => { closed = true; if (w) w.hidden = true; },
    toggle: () => { build(); closed = !(w && w.hidden); if (w) w.hidden = closed; },
    isOpen: () => !!w && !w.hidden,
    has: () => !!VP(),
  };

  function init() { build(); } // build() já inicia o loop tick()
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
