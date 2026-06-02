// MEDIA — player de YouTube como FONTE. Em vez de modal, o player é posicionado
// por cima do monitor (PREVIEW ou PROGRAM) que estiver usando a fonte. Controle
// total pela barra de mídia (play/pause, tempo, mute). Toca só num lugar -> sem eco.
// Obs: por cross-origin/DRM, o YouTube nao entra no stream gravado/transmitido —
// pra colocar na live, use Adicionar fonte > Tela/aba (captura).
const MediaPanel = (function () {
  let apiReady = false, queue = [];

  function loadAPI() {
    if (window.YT && window.YT.Player) { apiReady = true; return; }
    if (document.getElementById('yt-api')) return;
    const s = document.createElement('script'); s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
    window.onYouTubeIframeAPIReady = () => { apiReady = true; queue.forEach(f => f()); queue = []; };
  }
  function ytId(url) { const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/); return m ? m[1] : null; }

  function createPlayer(videoId, onReady) {
    loadAPI();
    const el = document.createElement('div'); el.className = 'yt-stage'; el.style.display = 'none';
    const inner = document.createElement('div'); el.appendChild(inner);
    document.body.appendChild(el);
    let player = null;
    const build = () => {
      /* global YT */
      player = new YT.Player(inner, { videoId, playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, fs: 0 }, events: { onReady: () => onReady && onReady() } });
    };
    if (apiReady) build(); else queue.push(build);
    const P = (fn, d) => (player && player[fn] ? player[fn]() : d);
    return {
      el,
      show(r) { el.style.display = 'block'; el.style.left = r.left + 'px'; el.style.top = r.top + 'px'; el.style.width = r.width + 'px'; el.style.height = r.height + 'px'; },
      hide() { el.style.display = 'none'; },
      play() { player && player.playVideo && player.playVideo(); },
      pause() { player && player.pauseVideo && player.pauseVideo(); },
      paused() { return P('getPlayerState', 2) !== 1; },
      mute() { player && player.mute && player.mute(); },
      unmute() { player && player.unMute && player.unMute(); },
      muted() { return P('isMuted', true); },
      seek(f) { if (player && player.seekTo) player.seekTo((player.getDuration() || 0) * f, true); },
      time() { return P('getCurrentTime', 0); },
      duration() { return P('getDuration', 0); },
      destroy() { try { player && player.destroy && player.destroy(); } catch {} el.remove(); },
    };
  }
  return { createPlayer, ytId };
})();
window.MediaPanel = MediaPanel;
