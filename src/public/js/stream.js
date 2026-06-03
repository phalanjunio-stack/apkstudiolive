/* ============================================
   STREAM — transmissão ao vivo (RTMP via servidor/ffmpeg).
   Compõe o PROGRAM num canvas (vídeo + imagens/arte dos
   gráficos + textos) + áudio do mixer → MediaRecorder →
   WebSocket /stream → ffmpeg empurra pros destinos.
   ============================================ */
const KivoStream = (function () {
  let ws = null, rec = null, raf = 0, canvas = null, ctx = null, live = false, onState = null, starting = false;

  function dests() { try { return JSON.parse(localStorage.getItem('sl-stream-dests') || '[]').filter(d => d.on && d.url && d.key); } catch { return []; } }
  function res() {
    const dash = document.querySelector('.dash'); const f = dash ? dash.dataset.format : '16:9';
    if (f === '9:16') return [720, 1280];
    if (f === '1:1') return [720, 720];
    if (f === '4:5') return [864, 1080];
    if (f === 'custom') { const v = (getComputedStyle(dash).getPropertyValue('--fmt') || '16/9').split('/'); const r = (+v[0]) / (+v[1]) || 16 / 9; return r >= 1 ? [1280, Math.round(1280 / r)] : [Math.round(720 * r), 720]; }
    return [1280, 720];
  }
  function drawFrame() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const pv = document.getElementById('programVideo');
    if (pv && pv.videoWidth) {
      const vr = pv.videoWidth / pv.videoHeight, cr = W / H; let dw, dh;
      if (vr > cr) { dh = H; dw = H * vr; } else { dw = W; dh = W / vr; }
      try { ctx.drawImage(pv, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch {}
    }
    const host = document.getElementById('pgmOverlay');
    if (host) {
      const hr = host.getBoundingClientRect();
      if (hr.width > 2) {
        const sx = W / hr.width, sy = H / hr.height;
        // imagens / artes (logo, PNG, slideshow, arte de modelo)
        host.querySelectorAll('img').forEach(img => {
          if (!img.complete || !img.naturalWidth || img.offsetParent === null) return;
          const r = img.getBoundingClientRect(); if (r.width < 1) return;
          try { ctx.drawImage(img, (r.left - hr.left) * sx, (r.top - hr.top) * sy, r.width * sx, r.height * sy); } catch {}
        });
        // textos (placar, campos de modelo, rodapé)
        host.querySelectorAll('span, b, div').forEach(elx => {
          if (elx.children.length || !elx.textContent.trim()) return;
          const r = elx.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
          const cs = getComputedStyle(elx); if (cs.visibility === 'hidden' || +cs.opacity === 0) return;
          ctx.fillStyle = cs.color;
          ctx.font = (cs.fontStyle || '') + ' ' + (cs.fontWeight || '700') + ' ' + (parseFloat(cs.fontSize) * sy) + 'px ' + cs.fontFamily;
          ctx.textBaseline = 'middle';
          ctx.textAlign = cs.textAlign === 'right' ? 'right' : cs.textAlign === 'center' ? 'center' : 'left';
          const cx = ctx.textAlign === 'right' ? r.right : ctx.textAlign === 'center' ? (r.left + r.width / 2) : r.left;
          try { ctx.fillText(elx.textContent.trim(), (cx - hr.left) * sx, (r.top + r.height / 2 - hr.top) * sy); } catch {}
        });
      }
    }
    raf = requestAnimationFrame(drawFrame);
  }
  function audioTrack() { const st = window.Mixer && window.Mixer.programStream; return (st && st.getAudioTracks) ? (st.getAudioTracks()[0] || null) : null; }

  function toast(m) { const t = document.createElement('div'); t.className = 'toast show'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }
  async function start() {
    if (live || starting) return; starting = true;
    try {
      const ds = dests();
      if (!ds.length) { toast('⚠ Cadastre e LIGUE um destino na aba Stream (YouTube/Facebook) antes do GO LIVE.'); return; }
      toast('Preparando transmissão…');
      const status = await fetch('/api/stream/status').then(r => r.json()).catch(() => ({ ffmpeg: false }));
      if (!status.ffmpeg) { alert('O ffmpeg não está instalado no servidor.\n\nInstale com:\n   winget install ffmpeg\n\ne reinicie o servidor (INICIAR.bat).'); return; }
      const [w, h] = res();
      canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; ctx = canvas.getContext('2d');
      drawFrame();
      const vstream = canvas.captureStream(30);
      const at = audioTrack(); if (at) vstream.addTrack(at);
      ws = new WebSocket('wss://' + location.host + '/stream');
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start', dests: ds.map(d => ({ url: d.url, key: d.key })), bitrate: 4500 }));
        let mime = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) mime = 'video/webm;codecs=h264';
        else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) mime = 'video/webm;codecs=vp8,opus';
        rec = new MediaRecorder(vstream, { mimeType: mime, videoBitsPerSecond: 4500000, audioBitsPerSecond: 160000 });
        rec.ondataavailable = e => { if (e.data && e.data.size && ws && ws.readyState === 1) e.data.arrayBuffer().then(b => { try { ws.send(b); } catch {} }); };
        rec.start(250);
        live = true; setState();
      };
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === 'error') { alert('Transmissão: ' + m.error); stop(); }
        else if (m.type === 'ended' && m.code) { alert('A transmissão caiu (ffmpeg código ' + m.code + ').\n\n' + (m.error || 'Veja a chave/URL do destino.')); stop(); }
        else if (m.type === 'live') { console.log('[stream] no ar — ' + m.dests + ' destino(s)'); }
      };
      ws.onclose = () => { if (live) stop(); };
      ws.onerror = () => {};
    } finally { starting = false; }
  }
  function stop() {
    live = false;
    try { rec && rec.state !== 'inactive' && rec.stop(); } catch {}
    rec = null;
    if (ws) { try { ws.send(JSON.stringify({ type: 'stop' })); } catch {} try { ws.close(); } catch {} ws = null; }
    if (raf) cancelAnimationFrame(raf); raf = 0; ctx = null; canvas = null; setState();
  }
  function setState() { if (onState) onState(live); }
  return { start, stop, toggle: () => (live ? stop() : start()), isLive: () => live, onState: f => { onState = f; } };
})();
window.KivoStream = KivoStream;

// ---- liga o botão GO LIVE ----
(function () {
  function init() {
    const btn = document.getElementById('goLiveBtn'); if (!btn) return;
    btn.disabled = false;
    btn.onclick = () => window.KivoStream.toggle();
    window.KivoStream.onState(on => {
      btn.classList.toggle('on-air', on);
      btn.innerHTML = on ? '&#9632; PARAR (no ar)' : '&#9673; GO LIVE';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
