// Estudio = sala de controle. Modelo de FONTE genérico: tudo vira um MediaStream
// e aparece como card em FONTES + célula no MULTIVIEW, selecionável em PREVIEW/PROGRAM.
// Tipos: celular (WebRTC), câmera USB/webcam, tela do PC, vídeo (arquivo), imagem.
const params = new URLSearchParams(location.search);
const room = params.get('room') || 'cam1';
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const $ = (id) => document.getElementById(id);
const elc = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const fontesGrid = $('fontesGrid');
const mvEl = $('mv');
const previewVideo = $('previewVideo');
const programVideo = $('programVideo');
const programVideoB = $('programVideoB');

const KIND = { phone: 'Celular', webcam: 'Câmera USB', screen: 'Tela do PC', video: 'Vídeo', image: 'Imagem', youtube: 'YouTube' };
const sources = new Map(); // id -> entry
let previewId = null, programId = null, ws, colorSeq = 0, localSeq = 0;

// ------------------------------- tiles ------------------------------------
function makeTile(id, kind, label, removable) {
  const f = elc('div', 'fcard'); f.dataset.id = id;
  f.innerHTML =
    '<div class="thumb"><span class="num"></span><video autoplay playsinline muted></video>' +
    `<span class="kind-tag">${KIND[kind]}</span><span class="bat-badge" hidden></span></div>` +
    `<div class="head"><span class="nm" title="${label}">${label}</span>` +
    (removable ? '<button class="fcard-x" title="Remover">&times;</button>' : '') + '</div>' +
    '<div class="foot"><span class="ty">conectando&hellip;</span><span class="st"></span></div>';
  f.addEventListener('click', e => { if (e.target.closest('.fcard-x')) { removeSource(id); return; } setPreview(id); });
  fontesGrid.insertBefore(f, $('addCard'));
  const c = elc('div', 'mvcell'); c.dataset.id = id;
  c.innerHTML = '<video autoplay playsinline muted></video>' + `<span class="n">${label}</span>`;
  c.addEventListener('click', () => setPreview(id));
  mvEl.appendChild(c);
  return { tile: f, tv: f.querySelector('video'), fty: f.querySelector('.ty'), fst: f.querySelector('.st'), mv: c, mvv: c.querySelector('video'), bat: f.querySelector('.bat-badge') };
}

function ensureSource(id, kind, label, removable) {
  let e = sources.get(id);
  if (e) return e;
  e = Object.assign({ kind, label, stream: null, pc: null, mediaEl: null, cleanup: null, bytes: 0, ts: 0, removable }, makeTile(id, kind, label, removable));
  e.fty.textContent = KIND[kind];
  sources.set(id, e);
  renumber(); renderDevices();
  return e;
}

function setStream(id, stream) {
  const e = sources.get(id); if (!e) return;
  e.stream = stream;
  e.tv.srcObject = stream; e.mvv.srcObject = stream;
  e.tv.onloadedmetadata = () => setTileRatio(e);
  if (e.tv.videoWidth) setTileRatio(e);
  if (previewId === id) attachPreview(id);
  if (programId === id) attachProgram(id);
  if (!programId) { setPreview(id); take(); } // 1a fonte já entra no ar
}

function removeSource(id) {
  const e = sources.get(id); if (!e) return;
  e.pc?.close();
  if (e.stream) e.stream.getTracks().forEach(t => t.stop());
  try { e.cleanup?.(); } catch {}
  e.yt?.destroy();
  e.tile.remove(); e.mv.remove();
  sources.delete(id);
  if (previewId === id) { previewId = null; attachPreview(null); }
  if (programId === id) { programId = null; attachProgram(null); }
  refreshButtons(); renderDevices();
}

// ------------------------- câmeras do celular -----------------------------
const ensurePhone = (id) => ensureSource(id, 'phone', 'CAM ' + id.replace('cam', ''), false);

function connect() {
  ws = new WebSocket(`wss://${location.host}/ws`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', role: 'studio', room }));
  ws.onmessage = async ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.type === 'sources') msg.list.forEach(ensurePhone);
    else if (msg.type === 'source-joined') ensurePhone(msg.source);
    else if (msg.type === 'source-left') removeSource(msg.source);
    else if (msg.type === 'offer') await onOffer(msg.source, msg.sdp);
    else if (msg.type === 'ice' && msg.candidate) { try { await sources.get(msg.source)?.pc?.addIceCandidate(msg.candidate); } catch {} }
    else if (msg.type === 'meta') updateMeta(msg.source, msg.battery, msg.charging);
  };
  ws.onclose = () => setTimeout(connect, 1000);
}

async function onOffer(id, sdp) {
  const e = ensurePhone(id);
  if (e.pc) e.pc.close();
  const pc = new RTCPeerConnection(ICE);
  e.pc = pc;
  pc.ontrack = (ev) => setStream(id, ev.streams[0]);
  pc.onicecandidate = (ev) => { if (ev.candidate) ws.send(JSON.stringify({ type: 'ice', source: id, candidate: ev.candidate })); };
  pc.onconnectionstatechange = () => {
    const bad = pc.connectionState === 'failed' || pc.connectionState === 'disconnected';
    e.tile.classList.toggle('badconn', bad);
  };
  await pc.setRemoteDescription(sdp);
  const a = await pc.createAnswer(); await pc.setLocalDescription(a);
  ws.send(JSON.stringify({ type: 'answer', source: id, sdp: pc.localDescription }));
}

// ----------------------- fontes locais (qualquer mídia) -------------------
function toast(msg) {
  const t = elc('div', 'toast'); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

async function addWebcam(deviceId, label) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false });
    const id = 'local-' + (++localSeq);
    ensureSource(id, 'webcam', label || 'Câmera USB', true);
    setStream(id, stream);
  } catch (e) { toast('Câmera: ' + e.message); }
}
async function addScreen() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const id = 'local-' + (++localSeq);
    ensureSource(id, 'screen', 'Tela / Aba', true);
    setStream(id, stream);
    // se a aba/janela compartilhou audio (YouTube, jogo, Instagram...), manda pro mixer
    if (stream.getAudioTracks().length) window.Mixer?.addStreamAudio(new MediaStream(stream.getAudioTracks()), 'Tela (audio)');
    stream.getVideoTracks()[0]?.addEventListener('ended', () => removeSource(id));
  } catch (e) { toast('Tela: ' + e.message); }
}
function addVideoFile(file) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url; v.loop = false; v.muted = false; v.playsInline = true;
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'video', file.name, true);
  e.mediaEl = v; e.cleanup = () => URL.revokeObjectURL(url);
  const apply = () => { v.play().catch(() => {}); setStream(id, v.captureStream()); };
  if (v.readyState >= 2) apply(); else v.addEventListener('loadeddata', apply, { once: true });
}
function addImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'image', file.name, true);
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth || 1280; cv.height = img.naturalHeight || 720;
    const ctx = cv.getContext('2d');
    const draw = () => ctx.drawImage(img, 0, 0, cv.width, cv.height);
    draw(); const iv = setInterval(draw, 1000); // mantém o stream vivo
    e.mediaEl = cv; e.cleanup = () => { clearInterval(iv); URL.revokeObjectURL(url); };
    setStream(id, cv.captureStream(2));
  };
  img.onerror = () => { toast('Não consegui abrir a imagem.'); removeSource(id); };
  img.src = url;
}
function pickFile(accept, cb) { const i = elc('input'); i.type = 'file'; i.accept = accept; i.onchange = () => { if (i.files[0]) cb(i.files[0]); }; i.click(); }

// ----------------------- menu "Adicionar fonte" ---------------------------
function closeAddMenu() { $('addMenu')?.remove(); }
async function openAddMenu(ev) {
  closeAddMenu();
  const items = [];
  let cams = [];
  try { cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch {}
  if (cams.length && cams.some(c => c.label)) cams.forEach(c => items.push(['Câmera: ' + (c.label || 'USB'), () => addWebcam(c.deviceId, c.label || 'Câmera USB')]));
  else items.push(['Câmera USB / webcam', () => addWebcam(null, 'Câmera USB')]);
  items.push(['Tela / janela / aba (jogo, YouTube...)', addScreen]);
  items.push(['Vídeo (arquivo)', () => pickFile('video/*', addVideoFile)]);
  items.push(['Link (YouTube / vídeo URL)', addLink]);
  items.push(['Imagem', () => pickFile('image/*', addImageFile)]);
  const menu = elc('div', 'add-menu'); menu.id = 'addMenu';
  items.forEach(([label, fn]) => { const b = elc('button'); b.textContent = label; b.onclick = () => { closeAddMenu(); fn(); }; menu.appendChild(b); });
  document.body.appendChild(menu);
  const r = (ev.currentTarget || ev.target).getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 248)) + 'px';
  menu.style.top = (r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('click', closeAddMenu, { once: true }), 0);
}

// --------------------------- preview / program ----------------------------
function setPreview(id) { if (!sources.has(id)) return; previewId = id; attachPreview(id); refreshBorders(); refreshButtons(); updateMediaBar(); }
function attachPreview(id) {
  const e = id && sources.get(id);
  const yt = e && e.kind === 'youtube';
  previewVideo.srcObject = (e && !yt) ? e.stream : null;
  $('previewEmpty').style.display = (e && (yt || e.stream)) ? 'none' : 'flex';
  $('previewName').textContent = e ? e.label : '—';
  if (!id) $('previewRes').textContent = '—';
  applyCrop(previewVideo, (e && e.crop) || {}); positionCropHandles((e && e.crop) || {});
  positionYouTube();
}
function setProgram(id) { if (!sources.has(id)) return; programId = id; attachProgram(id); refreshBorders(); }
function attachProgram(id) {
  const e = id && sources.get(id);
  const yt = e && e.kind === 'youtube';
  programVideo.srcObject = (e && !yt) ? e.stream : null;
  programVideo.play?.().catch(() => {});
  const on = !!(e && (yt || e.stream));
  $('programEmpty').style.display = on ? 'none' : 'flex';
  $('liveDot').classList.toggle('on', on);
  $('programOnair').textContent = on ? 'NO AR' : 'OFFLINE';
  if (!id) $('programRes').textContent = '—';
  applyCrop(programVideo, (e && e.crop) || {});
  positionYouTube();
}
function take() { if (previewId) setProgram(previewId); }
// FADE: crossfade suave do PREVIEW pro PROGRAM (camada B por cima, fade-in, depois troca)
function crossfade(id) {
  if (!sources.has(id) || !programVideoB) return;
  const e = sources.get(id);
  if (!e.stream) { setProgram(id); return; } // YouTube/sem stream -> corte
  programVideoB.srcObject = e.stream; programVideoB.style.opacity = '0';
  programVideoB.play?.().catch(() => {});
  requestAnimationFrame(() => requestAnimationFrame(() => { programVideoB.style.opacity = '1'; }));
  setTimeout(() => { setProgram(id); programVideoB.style.opacity = '0'; programVideoB.srcObject = null; }, 600);
}
function fadeTake() { if (previewId) crossfade(previewId); }
function ftb() { const b = $('programBlack'); if (!b) return; b.classList.toggle('on'); $('ftbBtn')?.classList.toggle('on', b.classList.contains('on')); }
// ---- corte de vídeo: segura ALT no PREVIEW e arrasta as bordas (topo/rodapé/laterais) ----
function applyCrop(v, c) {
  if (!v) return;
  const t = c.t || 0, r = c.r || 0, b = c.b || 0, l = c.l || 0;
  v.style.transform = ''; v.style.objectFit = '';
  // corta SÓ a borda (clip), sem redimensionar/zoom — a imagem fica paradinha no lugar
  if (t < 0.3 && r < 0.3 && b < 0.3 && l < 0.3) { v.style.clipPath = ''; return; }
  v.style.clipPath = `inset(${t}% ${r}% ${b}% ${l}%)`;
}
function reapplyCrop(id) { const e = sources.get(id); if (!e) return; if (previewId === id) applyCrop(previewVideo, e.crop || {}); if (programId === id) applyCrop(programVideo, e.crop || {}); }
function positionCropHandles(c) {
  const ui = $('cropUI'); if (!ui) return;
  ui.querySelector('.crop-t').style.top = (c.t || 0) + '%';
  ui.querySelector('.crop-b').style.bottom = (c.b || 0) + '%';
  ui.querySelector('.crop-l').style.left = (c.l || 0) + '%';
  ui.querySelector('.crop-r').style.right = (c.r || 0) + '%';
}
function bindCropUI() {
  const ui = $('cropUI'), mon = $('previewMon'); if (!ui || !mon) return;
  $('cropBtn')?.addEventListener('click', () => {
    if (!previewId && !document.body.classList.contains('crop-mode')) return;
    const on = document.body.classList.toggle('crop-mode');
    $('cropBtn').classList.toggle('on', on);
  });
  ui.ondblclick = () => { if (!previewId) return; const s = sources.get(previewId); if (!s) return; s.crop = { t: 0, r: 0, b: 0, l: 0 }; positionCropHandles(s.crop); reapplyCrop(previewId); };
  ui.querySelectorAll('.crop-h').forEach(h => {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (!previewId) return; const s = sources.get(previewId); if (!s) return;
      if (!s.crop) s.crop = { t: 0, r: 0, b: 0, l: 0 };
      const edge = h.dataset.edge;
      try { h.setPointerCapture(e.pointerId); } catch {}
      const move = (ev) => {
        const r = mon.getBoundingClientRect(); let val;
        if (edge === 't') val = (ev.clientY - r.top) / r.height * 100;
        else if (edge === 'b') val = (r.bottom - ev.clientY) / r.height * 100;
        else if (edge === 'l') val = (ev.clientX - r.left) / r.width * 100;
        else val = (r.right - ev.clientX) / r.width * 100;
        s.crop[edge] = Math.max(0, Math.min(45, val));
        positionCropHandles(s.crop); reapplyCrop(previewId);
      };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
    });
  });
}
function refreshBorders() {
  for (const [id, e] of sources) {
    e.tile.classList.toggle('preview', id === previewId);
    e.tile.classList.toggle('program', id === programId);
    e.mv.classList.toggle('program', id === programId);
  }
}
function refreshButtons() { const on = !!previewId; $('takeBtn').disabled = !on; $('cutBtn').disabled = !on; $('cutBtn2').disabled = !on; const f = $('fadeBtn'), a = $('autoBtn'); if (f) f.disabled = !on; if (a) a.disabled = !on; }

// ----------------------- dispositivos móveis (só celulares) ---------------
function renderDevices() {
  const box = $('devices');
  const phones = [...sources.entries()].filter(([, e]) => e.kind === 'phone');
  if (!phones.length) { box.innerHTML = '<div class="dev-empty">Nenhum dispositivo conectado.</div>'; return; }
  box.innerHTML = '';
  phones.sort((a, b) => a[0].localeCompare(b[0])).forEach(([id]) => {
    const e = sources.get(id);
    const bat = e.battery != null ? ` · ${e.charging ? '⚡' : ''}${e.battery}%` : '';
    const d = elc('div', 'device');
    d.innerHTML = '<span class="di">&#9707;</span>' +
      `<div class="dn"><b>${e.label}</b><span>Conectado (WebRTC)${bat}</span></div>` +
      '<div class="bars ok"><i></i><i></i><i></i><i></i></div>';
    box.appendChild(d);
  });
}

// ------------------------------- estatísticas -----------------------------
const fpsHist = [];
function trackRes(stream) { const t = stream?.getVideoTracks?.()[0]; if (!t) return ['—', 0]; const s = t.getSettings(); return [(s.width || 0) + '×' + (s.height || 0), Math.round(s.frameRate || 0)]; }
setInterval(async () => {
  let totalKbps = 0, framesDropped = 0, health = 'ok', pgmFps = 0, pgmRtt = null, pgmLoss = 0, any = false;
  for (const [id, e] of sources) {
    any = true;
    if (e.pc) {
      const stats = await e.pc.getStats(); let inbound, pair;
      stats.forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'video') inbound = r; if (r.type === 'candidate-pair' && r.nominated) pair = r; });
      if (inbound) {
        const fps = Math.round(inbound.framesPerSecond || 0);
        const res = (inbound.frameWidth || 0) + '×' + (inbound.frameHeight || 0);
        const now = inbound.timestamp, bytes = inbound.bytesReceived || 0;
        if (e.ts) totalKbps += Math.max(0, Math.round(((bytes - e.bytes) * 8) / (now - e.ts)));
        e.bytes = bytes; e.ts = now;
        framesDropped += inbound.framesDropped || 0;
        if (Math.round((inbound.jitter || 0) * 1000) > 60) health = 'warn';
        e.fst.textContent = `${res} ${fps}f`;
        if (id === programId) { pgmFps = fps; pgmRtt = pair?.currentRoundTripTime; pgmLoss = inbound.packetsLost || 0; $('programRes').textContent = res; }
        if (id === previewId) $('previewRes').textContent = res;
      }
    } else {
      const [res, fps] = trackRes(e.stream);
      e.fst.textContent = res === '—' ? '' : `${res}`;
      if (id === programId) { pgmFps = fps; $('programRes').textContent = res; }
      if (id === previewId) $('previewRes').textContent = res;
    }
  }
  $('fps').textContent = pgmFps || '—';
  fpsHist.push(pgmFps); if (fpsHist.length > 46) fpsHist.shift(); drawSpark('fpsSpark', fpsHist, 70);
  $('pFrames').textContent = framesDropped;
  $('pLat').textContent = pgmRtt != null ? Math.round(pgmRtt * 1000) + ' ms' : '—';
  $('pUp').textContent = any ? (totalKbps / 1000).toFixed(1) + ' Mbps' : '—';
  $('pDrop').textContent = any ? (pgmLoss ? pgmLoss + ' pk' : '0%') : '—';
  applyHealth(sources.size ? health : '');
}, 1000);

function drawSpark(id, arr, max) {
  const cv = $(id); if (!cv) return; const ctx = cv.getContext('2d'); const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h); if (arr.length < 2) return;
  ctx.beginPath();
  arr.forEach((v, i) => { const x = (i / (arr.length - 1)) * w; const y = h - (Math.min(v, max) / max) * (h - 2) - 1; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = '#36d1ff'; ctx.lineWidth = 1.5; ctx.stroke();
}
function applyHealth(h) {
  const map = { ok: ['Excelente', 'Otimo'], warn: ['Bom', 'Bom'], bad: ['Instavel', 'Atencao'], '': ['—', '—'] };
  const [rede, perf] = map[h] || map[''];
  $('netLabel').textContent = rede; $('pNet').textContent = rede; $('pPerf').textContent = perf;
  $('netBars').className = 'bars ' + (h || '');
}

// --------------------------------- init -----------------------------------
$('takeBtn').onclick = take;
$('cutBtn').onclick = take;
$('cutBtn2').onclick = take;
$('fadeBtn').onclick = fadeTake;
$('autoBtn').onclick = fadeTake;
$('ftbBtn').onclick = ftb;

(function init() {
  const add = elc('div', 'fcard addcard'); add.id = 'addCard';
  add.innerHTML = '<div class="addcard-inner"><span class="plus">+</span><span>Adicionar fonte</span></div>';
  add.addEventListener('click', openAddMenu);
  fontesGrid.appendChild(add);
  bindMediaBar();
  bindCropUI();
  document.addEventListener('keydown', (e) => { if (e.key === 'Alt' && previewId) document.body.classList.add('alt-crop'); });
  document.addEventListener('keyup', (e) => { if (e.key === 'Alt') document.body.classList.remove('alt-crop'); });
  window.addEventListener('blur', () => document.body.classList.remove('alt-crop'));
  window.addEventListener('resize', positionYouTube);
  setInterval(positionYouTube, 500);
  connect();
})();

// API pública (usada pela página "Fontes" do menu)
// ---- barra de mídia: play/pause, seek, tempo, mute, loop (vídeo arquivo/URL e YouTube) ----
let mediaCur = null;
const fmtT = (s) => { s = Math.floor(s) || 0; return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// controllers unificados pros dois tipos de mídia
function videoCtl(v) { return { play: () => v.play().catch(() => {}), pause: () => v.pause(), paused: () => v.paused, time: () => v.currentTime || 0, dur: () => v.duration || 0, seek: (f) => { if (v.duration) v.currentTime = v.duration * f; }, muted: () => v.muted, toggleMute: () => { v.muted = !v.muted; }, loopable: true, loop: () => v.loop, toggleLoop: () => { v.loop = !v.loop; } }; }
function ytCtl(h) { return { play: () => h.play(), pause: () => h.pause(), paused: () => h.paused(), time: () => h.time(), dur: () => h.duration(), seek: (f) => h.seek(f), muted: () => h.muted(), toggleMute: () => { h.muted() ? h.unmute() : h.mute(); }, loopable: false, loop: () => false, toggleLoop: () => {} }; }
function bindMediaBar() {
  if (!$('mediaBar')) return;
  $('mPlay').onclick = () => { if (mediaCur) (mediaCur.paused() ? mediaCur.play() : mediaCur.pause()); };
  $('mMute').onclick = () => { if (mediaCur) { mediaCur.toggleMute(); $('mMute').innerHTML = mediaCur.muted() ? '&#128263;' : '&#128266;'; } };
  $('mLoop').onclick = () => { if (mediaCur) { mediaCur.toggleLoop(); $('mLoop').classList.toggle('on', mediaCur.loop()); } };
  let seeking = false;
  $('mSeek').oninput = () => { seeking = true; };
  $('mSeek').onchange = () => { if (mediaCur) mediaCur.seek($('mSeek').value / 1000); seeking = false; };
  setInterval(() => { if (!mediaCur) return; const d = mediaCur.dur(), c = mediaCur.time(); if (!seeking && d) $('mSeek').value = Math.round(c / d * 1000); $('mTime').textContent = fmtT(c) + ' / ' + fmtT(d); $('mPlay').innerHTML = mediaCur.paused() ? '&#9654;' : '&#9208;'; }, 400);
}
function updateMediaBar() {
  const e = previewId && sources.get(previewId), bar = $('mediaBar');
  if (!bar) return;
  let ctl = null;
  if (e && e.kind === 'video' && e.mediaEl) ctl = videoCtl(e.mediaEl);
  else if (e && e.kind === 'youtube' && e.yt) ctl = ytCtl(e.yt);
  mediaCur = ctl;
  if (ctl) { bar.classList.remove('is-hidden'); $('mName').textContent = e.label; $('mLoop').style.display = ctl.loopable ? '' : 'none'; $('mMute').innerHTML = ctl.muted() ? '&#128263;' : '&#128266;'; }
  else bar.classList.add('is-hidden');
}
// vídeo por URL direta (.mp4/.webm) -> fonte real
function addVideoUrl(url) {
  const v = document.createElement('video');
  v.src = url; v.crossOrigin = 'anonymous'; v.loop = false; v.muted = false; v.playsInline = true;
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'video', (url.split('/').pop() || 'Video').split('?')[0], true);
  e.mediaEl = v;
  const apply = () => { v.play().catch(() => {}); setStream(id, v.captureStream()); };
  if (v.readyState >= 2) apply();
  else { v.addEventListener('loadeddata', apply, { once: true }); v.addEventListener('error', () => { toast('Nao consegui carregar esse link de video.'); removeSource(id); }, { once: true }); }
}
// YouTube -> fonte: player posicionado por cima do PREVIEW/PROGRAM
function addYouTube(url) {
  const vid = window.MediaPanel && window.MediaPanel.ytId(url);
  if (!vid) return toast('Link do YouTube invalido.');
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'youtube', 'YouTube', true);
  const thumb = `url(https://img.youtube.com/vi/${vid}/hqdefault.jpg)`;
  const th = e.tile.querySelector('.thumb'); th.style.backgroundImage = thumb; th.style.backgroundSize = 'cover'; th.style.backgroundPosition = 'center';
  e.mv.style.backgroundImage = thumb; e.mv.style.backgroundSize = 'cover'; e.mv.style.backgroundPosition = 'center';
  e.tv.style.display = 'none'; e.mvv.style.display = 'none';
  e.yt = window.MediaPanel.createPlayer(vid, () => { positionYouTube(); updateMediaBar(); });
  if (!programId) { setPreview(id); take(); } else setPreview(id);
  positionYouTube();
}
function positionYouTube() {
  for (const [id, e] of sources) {
    if (e.kind !== 'youtube' || !e.yt) continue;
    const mon = programId === id ? $('programMon') : (previewId === id ? $('previewMon') : null);
    if (mon && mon.offsetParent !== null) { const r = mon.getBoundingClientRect(); if (r.width > 4) { e.yt.show(r); continue; } }
    e.yt.hide();
  }
}
function addLink() {
  const url = prompt('Cole o link (YouTube, ou link direto de video .mp4):');
  if (!url) return;
  if (/youtube\.com|youtu\.be/i.test(url)) return addYouTube(url);
  if (/instagram\.com/i.test(url)) return toast('Instagram: use Adicionar fonte > Tela/aba (captura).');
  addVideoUrl(url);
}
window.Studio = { addWebcam, addScreen, addVideoFile, addImageFile, addVideoUrl, addLink, addYouTube, pickFile, openAddMenu };

// renumera os cards (1,2,3...) = numero da tecla de atalho
function renumber() {
  let i = 0;
  for (const [, e] of sources) { i++; const num = e.tile.querySelector('.num'); num.textContent = i; num.className = 'num c' + (((i - 1) % 6) + 1); }
}

// bateria recebida do celular -> badge no card + lista
function updateMeta(id, battery, charging) {
  const e = sources.get(id); if (!e) return;
  e.battery = battery; e.charging = charging;
  if (e.bat) {
    e.bat.hidden = false;
    e.bat.textContent = (charging ? '⚡' : '') + battery + '%';
    e.bat.className = 'bat-badge ' + (battery <= 15 ? 'low' : battery <= 35 ? 'mid' : 'ok');
  }
  renderDevices();
}

// ATALHOS DE TECLADO — troca de camera rapida
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
  const ids = [...sources.keys()];
  if (e.key >= '1' && e.key <= '9') {
    const i = +e.key - 1; if (ids[i]) setProgram(ids[i]); // corta direto pro PROGRAM
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); take();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    if (!ids.length) return;
    let i = ids.indexOf(previewId);
    i = e.key === 'ArrowRight' ? (i + 1) % ids.length : (i - 1 + ids.length) % ids.length;
    setPreview(ids[i]);
  }
});

// detecta o formato real (16:9 / 9:16 / 1:1) e ajusta o card + a celula do multiview
function setTileRatio(e) {
  const w = e.tv.videoWidth, h = e.tv.videoHeight;
  if (!w || !h) return;
  const r = w + '/' + h;
  e.tile.style.setProperty('--r', r);
  e.mv.style.setProperty('--r', r);
}
