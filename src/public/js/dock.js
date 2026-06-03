/* ============================================================
   DOCK — rodapé que fica escondido e aparece no hover.
   Controles rápidos de MÚSICA + VÍDEO (playlist) + a barra
   de STATS (PERFORMANCE/REDE...). O painel completo de vídeos
   abre pelo botão "Lista". Fixar com o 📌.
   ============================================================ */
(function () {
  const PIN = 'kivo-dock-pin';
  let dock = null, pinned = false, hideT = 0, built = false;

  const fmt = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const $ = sel => dock.querySelector(sel);

  function build() {
    if (built) return; built = true;
    dock = document.createElement('div'); dock.className = 'kdock'; dock.id = 'kivoDock';
    dock.innerHTML =
      '<div class="kdock-tab" id="kdockTab"><span class="kdock-grip"></span><span class="kdock-tab-tx">CONTROLES</span>' +
      '<button class="kdock-pin" id="kdockPin" title="Fixar aberto">&#128204;</button></div>' +
      '<div class="kdock-body">' +
        '<div class="kdock-row">' +
          '<div class="kdock-mod kdock-music off">' +
            '<span class="kdock-ic" title="Música de fundo"><i></i><i></i><i></i></span>' +
            '<button id="kdMPrev" title="Anterior">&#9198;</button>' +
            '<button class="kd-play" id="kdMPlay" title="Play/Pause">&#9654;</button>' +
            '<button id="kdMNext" title="Próxima">&#9197;</button>' +
            '<span class="kdock-title" id="kdMTitle">—</span>' +
            '<div class="kdock-seek" id="kdMSeek"><div class="kdock-bar" id="kdMBar"></div></div>' +
            '<span class="kdock-time" id="kdMTime">0:00 / 0:00</span>' +
            '<button class="kd-list" id="kdMList" title="Abrir a playlist de músicas">Lista</button>' +
          '</div>' +
          '<div class="kdock-mod kdock-video off">' +
            '<span class="kdock-ic" title="Playlist de vídeos"><i></i><i></i><i></i></span>' +
            '<button id="kdVPrev" title="Anterior">&#9198;</button>' +
            '<button class="kd-play" id="kdVPlay" title="Play/Pause">&#9654;</button>' +
            '<button id="kdVNext" title="Próximo">&#9197;</button>' +
            '<span class="kdock-title" id="kdVTitle">—</span>' +
            '<button class="kd-t" id="kdVAuto" title="Avançar sozinho ao terminar">Auto</button>' +
            '<button class="kd-t" id="kdVLoop" title="Repetir a fila">Loop</button>' +
            '<button class="kd-list" id="kdVList" title="Abrir a lista (arrastar/reordenar/remover)">Lista</button>' +
            '<button class="kd-pre" id="kdVPre" title="Mostrar no PREVIEW">Pré</button>' +
            '<button class="kd-air" id="kdVAir" title="Cortar pro AR (PROGRAM)">No ar</button>' +
          '</div>' +
        '</div>' +
        '<div class="kdock-stats" id="kdockStats"></div>' +
      '</div>';
    document.body.appendChild(dock);

    // move a barra de stats (PERFORMANCE/REDE/...) pra dentro do dock
    const pb = document.querySelector('.perfbar');
    if (pb) $('#kdockStats').appendChild(pb);
    const dash = document.querySelector('.dash'); if (dash) dash.classList.add('has-dock');

    dock.addEventListener('mouseenter', open);
    dock.addEventListener('mouseleave', scheduleHide);

    pinned = localStorage.getItem(PIN) === '1';
    dock.classList.toggle('pinned', pinned);
    const pin = $('#kdockPin'); pin.classList.toggle('on', pinned);
    pin.onclick = e => {
      e.stopPropagation(); pinned = !pinned;
      dock.classList.toggle('pinned', pinned); pin.classList.toggle('on', pinned);
      try { localStorage.setItem(PIN, pinned ? '1' : '0'); } catch {}
      pinned ? open() : scheduleHide();
    };

    wireMusic(); wireVideo();
    requestAnimationFrame(tick);
  }

  function open() { clearTimeout(hideT); dock.classList.add('open'); }
  function scheduleHide() { if (pinned) return; clearTimeout(hideT); hideT = setTimeout(() => dock.classList.remove('open'), 480); }

  function wireMusic() {
    const M = () => window.BgMusic;
    $('#kdMPrev').onclick = () => M() && M().prev();
    $('#kdMPlay').onclick = () => M() && M().toggle();
    $('#kdMNext').onclick = () => M() && M().next();
    $('#kdMList').onclick = () => window.openPlaylistModal && window.openPlaylistModal('audio');
    const seek = $('#kdMSeek');
    seek.addEventListener('pointerdown', e => { const m = M(); if (!m || !m.audio || !m.audio.duration) return; const r = seek.getBoundingClientRect(); m.audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * m.audio.duration; });
  }

  function wireVideo() {
    const V = () => window.VideoPlaylist;
    $('#kdVPrev').onclick = () => V() && V().prev();
    $('#kdVPlay').onclick = () => V() && V().toggle();
    $('#kdVNext').onclick = () => V() && V().next();
    $('#kdVAuto').onclick = () => { const v = V(); if (v) v.setAuto(!v.auto()); };
    $('#kdVLoop').onclick = () => { const v = V(); if (v) v.setLoopAll(!v.loopAll()); };
    $('#kdVList').onclick = () => { if (window.openPlaylistModal) window.openPlaylistModal('video'); };
    $('#kdVPre').onclick = () => { const v = V(); if (!v || !window.Studio) return; const st = window.Studio.state(); if (st.preview === v.sourceId) window.Studio.clearPreview(); else window.Studio.setPreview(v.sourceId); };
    $('#kdVAir').onclick = () => { const v = V(); if (!v || !window.Studio) return; const st = window.Studio.state(); if (st.program === v.sourceId) window.Studio.clearProgram(); else v.commitAir(); };
  }

  function setTitle(sel, txt) { const el = $(sel); if (!el) return; const t = txt || '—'; if (el.textContent !== t) { el.textContent = t; el.title = t; } }

  function tick() {
    // ---- música ----
    const m = window.BgMusic, st = m ? m.state() : null, a = m && m.audio;
    setTitle('#kdMTitle', st && st.current ? st.current.name : '');
    $('#kdMBar').style.width = (a && a.duration ? (a.currentTime / a.duration * 100) : 0) + '%';
    $('#kdMTime').textContent = a ? (fmt(a.currentTime) + ' / ' + fmt(a.duration || 0)) : '0:00 / 0:00';
    $('#kdMPlay').innerHTML = (a && !a.paused) ? '&#9208;' : '&#9654;';
    const mOn = !!(st && st.current);
    $('.kdock-music').classList.toggle('off', !mOn);
    $('.kdock-music').classList.toggle('playing', !!(a && !a.paused));

    // ---- vídeo ----
    const v = window.VideoPlaylist, has = !!v;
    const idx = has ? (v.current() >= 0 ? v.current() : 0) : -1;
    setTitle('#kdVTitle', (has && v.list()[idx]) ? v.list()[idx].name : '');
    $('#kdVPlay').innerHTML = (has && v.playing()) ? '&#9208;' : '&#9654;';
    $('#kdVAuto').classList.toggle('on', has && v.auto());
    $('#kdVLoop').classList.toggle('on', has && v.loopAll());
    $('.kdock-video').classList.toggle('off', !has);
    $('.kdock-video').classList.toggle('playing', has && v.playing());
    let stt = {}; try { stt = window.Studio ? window.Studio.state() : {}; } catch {}
    $('#kdVPre').classList.toggle('act', has && stt.preview === v.sourceId);
    $('#kdVAir').classList.toggle('act', has && stt.program === v.sourceId);

    // botão "Playlist" da barra de cima ACENDE quando tem música ou vídeo tocando
    const plBtn = document.getElementById('btnPlaylist');
    if (plBtn) plBtn.classList.toggle('on', !!(a && !a.paused) || !!(has && v.playing()));

    requestAnimationFrame(tick);
  }

  function init() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
