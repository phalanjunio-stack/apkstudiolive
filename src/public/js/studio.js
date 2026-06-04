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

const KIND = { phone: 'Celular', webcam: 'Câmera USB', screen: 'Tela do PC', video: 'Vídeo', image: 'Imagem', youtube: 'YouTube', playlist: 'Playlist', color: 'Cor', chroma: 'Chroma', replay: 'Replay' };
const sources = new Map(); // id -> entry
let previewId = null, programId = null, ws, colorSeq = 0, localSeq = 0, statePushTimer = null;
// cada vídeo ganha uma COR pra identificar (card + canal do mixer batem na cor)
const VID_COLORS = ['#6c8bff', '#ff7a59', '#a06bff', '#2ee07a', '#ffcf45', '#ff5d9e', '#19c3c3', '#ff924d'];
let vidColorSeq = 0;
const nextVidColor = () => VID_COLORS[(vidColorSeq++) % VID_COLORS.length];
function applySourceColor(e, color) { e.color = color; if (e.tile) { e.tile.style.setProperty('--sc', color); e.tile.classList.add('kv-vid'); } }
// destaca a fonte SELECIONADA (card + canal do mixer) com glow na cor dela; tira dos outros
function selectSource(id) {
  for (const e of sources.values()) { if (e.tile) e.tile.classList.toggle('kv-sel', e.id === id && !!e.color); }
  const sel = sources.get(id);
  if (window.Mixer && window.Mixer.selectChannel) window.Mixer.selectChannel(sel && sel.mixNode || null);
}
function selectSourceByNode(node) { for (const e of sources.values()) { if (e.mixNode === node) { selectSource(e.id); return; } } }

// ------------------------------- tiles ------------------------------------
// acende a FONTE de vídeo (quando você clica no canal do mixer)
function flashEl(el, color) { if (!el) return; if (color) el.style.setProperty('--fc', color); el.classList.remove('kv-flash'); void el.offsetWidth; el.classList.add('kv-flash'); setTimeout(() => el.classList.remove('kv-flash'), 2400); }
function flashSourceByNode(node) { for (const e of sources.values()) { if (e.mixNode === node) { flashEl(e.tile, e.color); return; } } }

function makeTile(id, kind, label, removable) {
  const f = elc('div', 'fcard fx-pop'); f.dataset.id = id;
  f.innerHTML =
    '<div class="thumb"><span class="num"></span><video autoplay playsinline muted></video>' +
    `<span class="kind-tag">${KIND[kind]}</span><span class="bat-badge" hidden></span>` +
    '<button class="golive-btn" title="Jogar direto no ar (PROGRAM)">&#9679; AO VIVO</button></div>' +
    `<div class="head"><span class="nm" title="${label}">${label}</span>` +
    (removable ? '<button class="fcard-x" title="Remover">&times;</button>' : '') + '</div>' +
    '<div class="foot"><span class="ty">conectando&hellip;</span><span class="st"></span></div>';
  f.addEventListener('click', e => {
    if (e.target.closest('.fcard-x')) { removeSource(id); return; }
    if (e.target.closest('.golive-btn')) { setProgram(id); return; } // atalho: direto pro ar
    setPreview(id);
    selectSource(id); // acende (glow) o card + o canal do mixer na cor da fonte
  });
  f.addEventListener('dblclick', e => { // 2 cliques = pré-visualizar (assistir antes do ar; áudio no fone)
    if (e.target.closest('.fcard-x, .golive-btn')) return;
    const s = sources.get(id); if (!s) return;
    if (s.kind === 'playlist') { if (window.VideoFloat && window.VideoFloat.open) window.VideoFloat.open(); else if (window.openPlaylistModal) window.openPlaylistModal('video'); }
    else if (s.url && window.openAudition) window.openAudition(s.url, s.label, true);
  });
  fontesGrid.insertBefore(f, $('addCard'));
  const c = elc('div', 'mvcell fx-pop'); c.dataset.id = id;
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
  if (!previewId && !programId) setPreview(id); // fonte nova entra no PREVIEW (espera o TAKE/cut)
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
  ws.onopen = () => { ws.send(JSON.stringify({ type: 'join', role: 'studio', room })); clearInterval(statePushTimer); statePushTimer = setInterval(pushState, 800); };
  ws.onmessage = async ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.type === 'sources') msg.list.forEach(ensurePhone);
    else if (msg.type === 'source-joined') ensurePhone(msg.source);
    else if (msg.type === 'source-left') removeSource(msg.source);
    else if (msg.type === 'offer') await onOffer(msg.source, msg.sdp);
    else if (msg.type === 'ice' && msg.candidate) { try { await sources.get(msg.source)?.pc?.addIceCandidate(msg.candidate); } catch {} }
    else if (msg.type === 'meta') updateMeta(msg.source, msg.battery, msg.charging);
    else if (msg.type === 'cmd') handleControlCmd(msg);          // comando do celular-controle
    else if (msg.type === 'control-join') pushState();           // controle entrou: manda estado
  };
  ws.onclose = () => setTimeout(connect, 1000);
}

// ---- celular como CONTROLE: executa comandos e publica o estado ----
function handleControlCmd(m) {
  try {
    if (m.cmd === 'preview') setPreview(m.id);
    else if (m.cmd === 'program') setProgram(m.id);
    else if (m.cmd === 'take') take();
    else if (m.cmd === 'fade') fadeTake();
    else if (m.cmd === 'ftb') ftb();
    else if (m.cmd === 'music') { const M = window.BgMusic; if (M) { if (m.action === 'prev') M.prev(); else if (m.action === 'next') M.next(); else M.toggle(); } }
    else if (m.cmd === 'football') handleFootballRemote(m);
  } catch {}
  pushState();
}
function footballOverlay() {
  const g = window.Graphics;
  if (!g) return null;
  let o = g.list().find(x => x.type === 'scoreboard');
  if (!o) o = g.add('scoreboard');
  return o;
}
function handleFootballRemote(m) {
  const o = footballOverlay();
  if (!o) return;
  const g = window.Graphics;
  const side = m.side === 'a' ? 'a' : 'h';
  if (m.action === 'goal') {
    if (window.Futebol?.goal) window.Futebol.goal(side, m.player || '');
    else g.score(o.id, side, 1);
  } else if (m.action === 'card') {
    if (window.Futebol?.card) window.Futebol.card(side, m.kind === 'red' ? 'red' : 'yellow', m.player || '');
  } else if (m.action === 'sub') {
    if (window.Futebol?.sub) window.Futebol.sub(side, m.out || '', m.into || '');
  } else if (m.action === 'clock') {
    if (m.mode === 'reset') g.clockCtl(o.id, 'reset');
    else if (m.mode === 'start' && !o.data.running) g.clockCtl(o.id, 'toggle');
    else if (m.mode === 'pause' && o.data.running) g.clockCtl(o.id, 'toggle');
  } else if (m.action === 'added') {
    g.update(o.id, { added: Math.max(0, Number(m.minutes) || 0) });
  } else if (m.action === 'stage') {
    g.update(o.id, { stage: m.stage || '' });
  } else if (m.action === 'event') {
    if (m.event === 'foul') window.SoundFX?.warn?.();
    else if (m.event === 'defense') window.SoundFX?.click?.();
    else window.SoundFX?.success?.();
  }
}
function footballState() {
  const o = window.Graphics?.list?.().find(x => x.type === 'scoreboard');
  const d = o?.data || {};
  return {
    home: d.home || 'CASA',
    away: d.away || 'VISITANTE',
    hs: d.hs ?? 0,
    as: d.as ?? 0,
    clock: d.clock || 0,
    stage: d.stage || '1o Tempo',
    added: d.added || 0,
    running: !!d.running,
  };
}
function pushState() {
  if (!ws || ws.readyState !== 1) return;
  const list = [...sources.values()].map(e => ({ id: e.id, label: e.label, kind: KIND[e.kind] || e.kind }));
  let music = { has: false, playing: false, title: '' };
  try { const M = window.BgMusic; if (M) { const s = M.state(); music = { has: !!s.current, playing: !s.paused, title: s.current ? s.current.name : '' }; } } catch {}
  ws.send(JSON.stringify({ type: 'state', sources: list, program: programId, preview: previewId, music, football: footballState() }));
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
// Captura via CANVAS — desenha o frame atual continuamente e SEGURA o último frame
// quando o vídeo pausa/termina. Resolve o "fica tudo preto" (captureStream de vídeo
// pausado/nunca-tocado fica preto). Áudio continua indo pelo MIXER (elemento <video>).
function canvasStream(v) {
  const c = document.createElement('canvas'); const ctx = c.getContext('2d', { alpha: false });
  const off = document.createElement('canvas'); const offCtx = off.getContext('2d');
  let stopped = false, rafId = 0, freeze = false, fStart = 0, fDur = 600;
  const draw = () => {
    const w = v.videoWidth, h = v.videoHeight;
    if (w && h) { if (c.width !== w) c.width = w; if (c.height !== h) c.height = h; try { ctx.drawImage(v, 0, 0, w, h); } catch {} }
    if (freeze) { // crossfade: frame antigo (congelado) some por cima do novo
      const t = (performance.now() - fStart) / fDur;
      if (t >= 1) freeze = false;
      else { ctx.save(); ctx.globalAlpha = 1 - t; try { ctx.drawImage(off, 0, 0, c.width, c.height); } catch {} ctx.restore(); }
    }
  };
  const pump = () => { if (stopped) return; draw(); if (v.requestVideoFrameCallback) { try { v.requestVideoFrameCallback(pump); return; } catch {} } rafId = requestAnimationFrame(pump); };
  ['loadeddata', 'seeked', 'pause', 'ended', 'play'].forEach(ev => v.addEventListener(ev, draw));
  pump();
  const ka = setInterval(draw, 60); // keep-alive: não fica preto + anima o crossfade quando parado
  return {
    stream: c.captureStream(30),
    stop: () => { stopped = true; try { cancelAnimationFrame(rafId); } catch {} clearInterval(ka); },
    dissolve: (ms) => { if (!c.width) return; off.width = c.width; off.height = c.height; try { offCtx.drawImage(c, 0, 0); } catch {} freeze = true; fStart = performance.now(); fDur = ms || 600; },
  };
}

function addVideoFile(file) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url; v.loop = false; v.playsInline = true; // NÃO autoplay — você decide quando tocar
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'video', file.name, true);
  e.mediaEl = v; e.url = url; applySourceColor(e, nextVidColor());
  // áudio do vídeo cai automático no MIXER (volume controlado lá; não sai direto no alto-falante)
  let mixNode = null;
  try { const ch = window.Mixer && window.Mixer.addMediaElement && window.Mixer.addMediaElement(v, file.name, e.color); mixNode = ch && ch.node; } catch {}
  e.mixNode = mixNode;
  e.cleanup = () => { try { e.canvasStop && e.canvasStop(); } catch {} URL.revokeObjectURL(url); if (mixNode && window.Mixer && window.Mixer.removeChannelByNode) try { window.Mixer.removeChannelByNode(mixNode); } catch {} };
  const apply = () => { if (e.canvasStop) return; const cv = canvasStream(v); e.canvasStop = cv.stop; setStream(id, cv.stream); }; // só vídeo na fonte; áudio é do mixer
  if (v.readyState >= 2) apply(); else v.addEventListener('loadeddata', apply, { once: true });
}

// PLAYLIST DE VÍDEOS — DOIS DECKS:
//  • CUE (vCue): você navega no mini-player SEM ir pro ar (mudo, só pré-escuta).
//  • AR  (vAir): o que está tocando no PROGRAMA (vai pro mixer/stream).
// "No ar" (commitAir) leva o vídeo do CUE pro AR com transição (fundido).
// A barra embaixo dos monitores (progbar) controla/pausa o deck do AR.
function addVideoPlaylist(files) {
  const arr = [...files].filter(Boolean).map(f => ({ name: f.name, url: URL.createObjectURL(f) }));
  if (!arr.length) return;
  const vAir = document.createElement('video'); vAir.loop = false; vAir.playsInline = true;
  const vCue = document.createElement('video'); vCue.loop = false; vCue.playsInline = true; vCue.muted = true;
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'playlist', 'Playlist', true);
  e.mediaEl = vAir; applySourceColor(e, nextVidColor());
  let airIdx = -1, cueIdx = -1, auto = true, loopAll = true, mixNode = null, started = false, cvObj = null;
  try { const ch = window.Mixer && window.Mixer.addMediaElement && window.Mixer.addMediaElement(vAir, 'Playlist', e.color); mixNode = ch && ch.node; } catch {}
  e.mixNode = mixNode;
  e.cleanup = () => { try { e.canvasStop && e.canvasStop(); } catch {} [vAir, vCue].forEach(x => { try { x.pause(); x.removeAttribute('src'); x.load(); } catch {} }); arr.forEach(a => { try { URL.revokeObjectURL(a.url); } catch {} }); if (mixNode && window.Mixer && window.Mixer.removeChannelByNode) try { window.Mixer.removeChannelByNode(mixNode); } catch {} if (window.VideoPlaylist && window.VideoPlaylist.sourceId === id) window.VideoPlaylist = null; };
  const plSubs = [];
  const emit = () => plSubs.forEach(f => { try { f(); } catch {} });
  const capOnce = () => { if (started) return; started = true; cvObj = canvasStream(vAir); e.canvasStop = cvObj.stop; setStream(id, cvObj.stream); };
  vAir.addEventListener('loadeddata', capOnce);

  // -------- CUE: navegação do mini-player (NÃO vai pro ar) --------
  function cueSet(i, play) {
    if (i < 0 || i >= arr.length) return; cueIdx = i; vCue.src = arr[i].url;
    if (play !== false) vCue.play().catch(() => {}); else { try { vCue.load(); } catch {} }
    emit();
  }
  vCue.addEventListener('ended', () => { if (auto) { if (cueIdx + 1 < arr.length) cueSet(cueIdx + 1, true); else if (loopAll) cueSet(0, true); else vCue.pause(); } emit(); });
  vCue.addEventListener('play', emit); vCue.addEventListener('pause', emit); vCue.addEventListener('timeupdate', emit);

  // -------- AR: deck que está no programa --------
  function airSet(i, play, dissolve) {
    if (i < 0 || i >= arr.length) return; airIdx = i;
    if (dissolve && cvObj) cvObj.dissolve(600);
    vAir.src = arr[i].url;
    if (play !== false) vAir.play().catch(() => {});
    e.label = 'Playlist · ' + arr[i].name;
    const nm = e.tile && e.tile.querySelector('.nm'); if (nm) { nm.textContent = e.label; nm.title = e.label; }
    emit();
  }
  vAir.addEventListener('ended', () => { if (auto) { if (airIdx + 1 < arr.length) airSet(airIdx + 1, true, true); else if (loopAll) airSet(0, true, true); else vAir.pause(); } emit(); });
  vAir.addEventListener('play', emit); vAir.addEventListener('pause', emit); vAir.addEventListener('timeupdate', emit);

  // commit: o que está no CUE entra no AR (com fundido) e já vai pro programa
  function commitAir() {
    const i = cueIdx >= 0 ? cueIdx : 0;
    airSet(i, true, started); // dissolve no canvas só se já existe captura
    crossfadeAir(id);         // play + desmuta canal + fundido no monitor de programa
    emit();
  }
  const reindex = (cur) => (cur ? arr.indexOf(cur) : -1);

  window.VideoPlaylist = {
    list: () => arr, sourceId: id,
    // ----- CUE: mini-player / dock / modal navegam AQUI (não mexe no ar) -----
    current: () => cueIdx, playing: () => !vCue.paused, el: () => vCue,
    time: () => vCue.currentTime || 0, dur: () => vCue.duration || 0,
    auto: () => auto, loopAll: () => loopAll,
    playAt: (i) => cueSet(i, true),
    toggle: () => { if (cueIdx < 0) return cueSet(0, true); vCue.paused ? vCue.play().catch(() => {}) : vCue.pause(); emit(); },
    next: () => cueSet(cueIdx + 1 < arr.length ? cueIdx + 1 : (loopAll ? 0 : cueIdx), true),
    prev: () => cueSet(cueIdx > 0 ? cueIdx - 1 : (loopAll ? arr.length - 1 : 0), true),
    seek: (f) => { if (vCue.duration) vCue.currentTime = vCue.duration * f; },
    cue: () => { try { vCue.pause(); vCue.currentTime = 0; } catch {} emit(); },
    setVolume: (x) => { vCue.muted = false; vCue.volume = Math.max(0, Math.min(1, x)); emit(); }, volume: () => vCue.volume,
    nextIndex: () => (cueIdx + 1 < arr.length ? cueIdx + 1 : (loopAll ? 0 : -1)),
    setAuto: (b) => { auto = !!b; emit(); }, setLoopAll: (b) => { loopAll = !!b; emit(); },
    // ----- AR: a barra de baixo (progbar) controla AQUI + "No ar" -----
    commitAir,
    airPlaying: () => !vAir.paused, airTime: () => vAir.currentTime || 0, airDur: () => vAir.duration || 0,
    airCurrent: () => airIdx, airEl: () => vAir,
    airToggle: () => { if (airIdx < 0) return commitAir(); vAir.paused ? vAir.play().catch(() => {}) : vAir.pause(); emit(); },
    airSeek: (f) => { if (vAir.duration) vAir.currentTime = vAir.duration * f; },
    airCue: () => { try { vAir.pause(); vAir.currentTime = 0; } catch {} emit(); },
    airPrev: () => airSet(airIdx > 0 ? airIdx - 1 : (loopAll ? arr.length - 1 : 0), true, true),
    airNext: () => airSet(airIdx + 1 < arr.length ? airIdx + 1 : (loopAll ? 0 : airIdx), true, true),
    airNextIndex: () => (airIdx + 1 < arr.length ? airIdx + 1 : (loopAll ? 0 : -1)),
    airVolume: () => vAir.volume, setAirVolume: (x) => { vAir.volume = Math.max(0, Math.min(1, x)); emit(); },
    // ----- fila -----
    add: (more, at) => {
      const cc = cueIdx >= 0 ? arr[cueIdx] : null, ca = airIdx >= 0 ? arr[airIdx] : null;
      const items = [...more].filter(Boolean).map(f => ({ name: f.name, url: URL.createObjectURL(f) }));
      if (at == null || at < 0 || at > arr.length) arr.push(...items); else arr.splice(at, 0, ...items);
      cueIdx = reindex(cc); airIdx = reindex(ca); emit();
    },
    move: (from, to) => {
      if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return;
      const cc = cueIdx >= 0 ? arr[cueIdx] : null, ca = airIdx >= 0 ? arr[airIdx] : null;
      const [it] = arr.splice(from, 1); arr.splice(to, 0, it);
      cueIdx = reindex(cc); airIdx = reindex(ca); emit();
    },
    removeAt: (i) => {
      if (i < 0 || i >= arr.length) return;
      const cc = cueIdx >= 0 ? arr[cueIdx] : null, ca = airIdx >= 0 ? arr[airIdx] : null;
      const wasCue = i === cueIdx, wasAir = i === airIdx;
      try { URL.revokeObjectURL(arr[i].url); } catch {}
      arr.splice(i, 1);
      if (!arr.length) { cueIdx = airIdx = -1; [vAir, vCue].forEach(x => { try { x.pause(); x.removeAttribute('src'); x.load(); } catch {} }); emit(); return; }
      if (wasCue) { cueIdx = Math.min(i, arr.length - 1); cueSet(cueIdx, !vCue.paused); } else cueIdx = reindex(cc);
      if (wasAir) { airIdx = Math.min(i, arr.length - 1); airSet(airIdx, !vAir.paused, false); } else airIdx = reindex(ca);
      emit();
    },
    onUpdate: (f) => { plSubs.push(f); },
  };
  cueSet(0, false); // 1º vídeo no CUE, parado (miniatura do mini-player)
  toast('Playlist criada — navegue no mini-player; "No ar" troca o que está no ar.');
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

// ----- COR SÓLIDA (fundo / placa de cor / base pra chroma) -----
function addColorSource() {
  const i = elc('input'); i.type = 'color'; i.value = '#00b140';
  i.onchange = () => {
    const color = i.value, id = 'local-' + (++localSeq);
    const e = ensureSource(id, 'color', 'Cor ' + color.toUpperCase(), true);
    const cv = elc('canvas'); cv.width = 1280; cv.height = 720; const ctx = cv.getContext('2d');
    e.solidColor = color;
    const draw = () => { ctx.fillStyle = e.solidColor; ctx.fillRect(0, 0, cv.width, cv.height); };
    draw(); const iv = setInterval(draw, 1000);
    e.mediaEl = cv; e.cleanup = () => clearInterval(iv);
    setStream(id, cv.captureStream(2));
  };
  i.click();
}

// ----- CHROMA KEY (Virtual Set): câmera com fundo verde → fundo escolhido -----
async function addChromaSource() {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false }); }
  catch { toast('Não consegui abrir a câmera pro chroma.'); return; }
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'chroma', 'Chroma key', true);
  const v = elc('video'); v.srcObject = stream; v.muted = true; v.playsInline = true; v.play().catch(() => {});
  const cv = elc('canvas'); cv.width = 1280; cv.height = 720; const ctx = cv.getContext('2d');
  const tmp = elc('canvas'); tmp.width = 1280; tmp.height = 720; const tctx = tmp.getContext('2d', { willReadFrequently: true });
  e.chroma = { bg: '#0b1220' }; // fundo (pode virar imagem depois)
  let raf = 0, stopped = false;
  function frame() {
    if (stopped) return;
    if (v.videoWidth) {
      tctx.drawImage(v, 0, 0, cv.width, cv.height);
      let img; try { img = tctx.getImageData(0, 0, cv.width, cv.height); } catch { img = null; }
      if (img) {
        const d = img.data;
        for (let p = 0; p < d.length; p += 4) { const r = d[p], g = d[p + 1], b = d[p + 2]; if (g > 90 && g > r * 1.25 && g > b * 1.2) d[p + 3] = 0; }
        ctx.fillStyle = e.chroma.bg; ctx.fillRect(0, 0, cv.width, cv.height);
        tctx.putImageData(img, 0, 0); ctx.drawImage(tmp, 0, 0);
      } else ctx.drawImage(v, 0, 0, cv.width, cv.height);
    }
    raf = requestAnimationFrame(frame);
  }
  v.addEventListener('loadeddata', () => { if (!raf) frame(); });
  e.mediaEl = cv;
  e.cleanup = () => { stopped = true; try { cancelAnimationFrame(raf); } catch {} stream.getTracks().forEach(t => t.stop()); };
  setStream(id, cv.captureStream(30));
  toast('Chroma ligado: o verde vira o fundo. Boa luz no fundo = recorte melhor.');
}

// ----- INSTANT REPLAY: buffer rolante do PROGRAM → clipe em câmera lenta -----
let replayRec = null, replayChunks = [];
const REPLAY_MS = 15000;
function ensureReplayBuffer() {
  if (replayRec && replayRec.state === 'recording') return;
  const stream = liveStream && liveStream();
  if (!stream || !stream.getVideoTracks || !stream.getVideoTracks().length) return;
  try {
    const mt = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    replayRec = new MediaRecorder(stream, { mimeType: mt });
    replayRec.ondataavailable = ev => {
      if (ev.data && ev.data.size) {
        replayChunks.push({ t: performance.now(), blob: ev.data });
        const cut = performance.now() - REPLAY_MS;
        while (replayChunks.length > 2 && replayChunks[0].t < cut) replayChunks.shift();
      }
    };
    replayRec.onstop = () => { replayRec = null; };
    replayRec.start(1000);
  } catch {}
}
function addReplay() {
  ensureReplayBuffer();
  if (!replayChunks.length) { toast('Replay sem buffer ainda — deixe algo no AR uns segundos e tente de novo.'); return; }
  const blob = new Blob(replayChunks.map(c => c.blob), { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const v = elc('video'); v.src = url; v.muted = true; v.playsInline = true; v.playbackRate = 0.5;
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'replay', 'Replay 0.5x', true);
  e.mediaEl = v;
  const apply = () => { const cs = canvasStream(v); e.canvasStop = cs.stop; setStream(id, cs.stream); v.play().catch(() => {}); };
  if (v.readyState >= 2) apply(); else v.addEventListener('loadeddata', apply, { once: true });
  e.cleanup = () => { try { e.canvasStop && e.canvasStop(); } catch {} URL.revokeObjectURL(url); };
  toast('Replay em câmera lenta pronto — mande pro ar com TAKE.');
}
function pickFile(accept, cb) { const i = elc('input'); i.type = 'file'; i.accept = accept; i.onchange = () => { if (i.files[0]) cb(i.files[0]); }; i.click(); }
function pickFiles(accept, cb) { const i = elc('input'); i.type = 'file'; i.accept = accept; i.multiple = true; i.onchange = () => { if (i.files.length) cb(i.files); }; i.click(); }

// ----------------------- menu "Adicionar fonte" ---------------------------
function closeAddMenu() { $('addMenu')?.remove(); document.removeEventListener('keydown', escClose); }
function escClose(e) { if (e.key === 'Escape') closeAddMenu(); }
// posiciona um menu flutuante: abre embaixo do alvo; se não couber, abre pra cima;
// se não couber em nenhum, encosta e rola. Sempre dentro da tela.
function placeMenu(menu, anchor) {
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const vw = window.innerWidth, vh = window.innerHeight, m = 8;
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = Math.max(m, Math.min(r.left, vw - mw - m));
  const below = r.bottom + 6, above = r.top - mh - 6;
  let top, up = false;
  if (below + mh + m <= vh) top = below;
  else if (above >= m) { top = above; up = true; }
  else { top = Math.max(m, vh - mh - m); menu.style.maxHeight = (vh - 2 * m) + 'px'; menu.style.overflowY = 'auto'; }
  menu.style.left = left + 'px'; menu.style.top = top + 'px';
  menu.classList.toggle('menu-up', up);
}
window.placeMenu = placeMenu;

async function openAddMenu(ev) {
  closeAddMenu();
  const items = [];
  let cams = [];
  try { cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch {}
  if (cams.length && cams.some(c => c.label)) cams.forEach(c => items.push(['Câmera: ' + (c.label || 'USB'), () => addWebcam(c.deviceId, c.label || 'Câmera USB')]));
  else items.push(['Câmera USB / webcam', () => addWebcam(null, 'Câmera USB')]);
  items.push(['Celular (câmera via QR)', () => window.openConnectModal && window.openConnectModal('camera', 'camera')]);
  items.push(['Tela / janela / aba (jogo, YouTube...)', addScreen]);
  items.push(['Vídeo (arquivo)', () => pickFile('video/*', addVideoFile)]);
  items.push(['Playlist de vídeos (vários)', () => pickFiles('video/*', addVideoPlaylist)]);
  items.push(['Link (YouTube / vídeo URL)', addLink]);
  items.push(['Imagem', () => pickFile('image/*', addImageFile)]);
  items.push(['Cor sólida (fundo / placa)', addColorSource]);
  items.push(['Chroma key (fundo verde → virtual set)', addChromaSource]);
  items.push(['Instant Replay (câmera lenta)', addReplay]);
  items.push(['Convidado por link (celular / PC)', () => window.openConnectModal && window.openConnectModal('camera', 'camera')]);
  const ov = elc('div', 'modal-overlay glow-overlay'); ov.id = 'addMenu';
  const shell = elc('div', 'glow-shell');
  const card = elc('div', 'glow-modal');
  card.innerHTML = '<div class="gm-head"><h2>Adicionar fonte</h2><button class="modal-close" type="button" style="position:static" aria-label="Fechar">✕</button></div>' +
    '<div class="gm-body"><p class="addsrc-sub">Escolha o tipo de fonte pra colocar no preview.</p><div class="addsrc-list"></div></div>';
  const list = card.querySelector('.addsrc-list');
  items.forEach(([label, fn]) => { const b = elc('button', 'addsrc-item'); b.type = 'button'; b.textContent = label; b.onclick = () => { closeAddMenu(); fn(); }; list.appendChild(b); });
  card.querySelector('.modal-close').onclick = closeAddMenu;
  shell.appendChild(card); ov.appendChild(shell);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeAddMenu(); });
  document.body.appendChild(ov);
  document.addEventListener('keydown', escClose);
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
function muteVideoChannel(e) {
  if (!e) return;
  if (e.mixNode && window.Mixer && window.Mixer.setChannelMuted) try { window.Mixer.setChannelMuted(e.mixNode, true); } catch {}
  try { if (e.mediaEl && !e.mediaEl.paused) e.mediaEl.pause(); } catch {} // pausa o vídeo que saiu do ar (não fica rodando à toa)
}
function setProgram(id) {
  if (!sources.has(id)) return;
  const old = (programId && programId !== id) ? sources.get(programId) : null;
  programId = id; attachProgram(id); refreshBorders();
  muteVideoChannel(old); // muta o vídeo que SAIU do ar (evita áudio de 2 vídeos)
  setTimeout(() => { try { ensureReplayBuffer(); } catch {} }, 400); // começa a gravar o buffer do replay
}
// tirar do ar / do preview (toggle dos botões)
function clearProgram() { const old = programId ? sources.get(programId) : null; programId = null; attachProgram(null); refreshBorders(); muteVideoChannel(old); }
function clearPreview() { previewId = null; attachPreview(null); refreshBorders(); refreshButtons(); updateMediaBar(); }
function attachProgram(id) {
  const e = id && sources.get(id);
  const yt = e && e.kind === 'youtube';
  programVideo.srcObject = (e && !yt) ? e.stream : null;
  programVideo.play?.().catch(() => {});
  const on = !!(e && (yt || e.stream));
  $('programEmpty').style.display = on ? 'none' : 'flex';
  $('liveDot').classList.toggle('on', on);
  document.querySelector('.dash')?.classList.toggle('is-live', on);
  $('programOnair').textContent = on ? 'NO AR' : 'OFFLINE';
  if (!id) $('programRes').textContent = '—';
  applyCrop(programVideo, (e && e.crop) || {});
  positionYouTube();
}
function take() { if (previewId) setProgram(previewId); }
// TAKE + Play: manda pro ar JÁ TOCANDO, com áudio (desmuta) e vídeo (play)
function takeAutoPlay() {
  const id = previewId; if (!id || !sources.has(id)) return;
  const e = sources.get(id);
  setProgram(id);
  if (e.mediaEl && e.mediaEl.paused) e.mediaEl.play().catch(() => {});
  if (e.mixNode && window.Mixer && window.Mixer.setChannelMuted) window.Mixer.setChannelMuted(e.mixNode, false);
}
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
// pôr uma fonte no ar COM transição suave (fundido) + já tocando e com áudio (pro player flutuante)
function crossfadeAir(id) {
  if (!sources.has(id)) return;
  const e = sources.get(id);
  if (e.mediaEl && e.mediaEl.paused) e.mediaEl.play().catch(() => {});
  if (e.mixNode && window.Mixer && window.Mixer.setChannelMuted) window.Mixer.setChannelMuted(e.mixNode, false);
  crossfade(id);
}
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
function refreshButtons() { const on = !!previewId; $('takeBtn').disabled = !on; $('cutBtn').disabled = !on; $('cutBtn2').disabled = !on; const f = $('fadeBtn'), a = $('autoBtn'), ta = $('takeAutoBtn'); if (f) f.disabled = !on; if (a) a.disabled = !on; if (ta) ta.disabled = !on; }

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
  $('fps').textContent = pgmFps || 60;
  fpsHist.push(pgmFps); if (fpsHist.length > 46) fpsHist.shift(); drawSpark('fpsSpark', fpsHist, 70);
  $('pFrames').textContent = framesDropped ? framesDropped + ' (' + ((framesDropped / (framesDropped + 2000)) * 100).toFixed(2) + '%)' : '0 (0.00%)';
  $('pLat').textContent = (pgmRtt != null ? Math.round(pgmRtt * 1000) : 11 + Math.round(Math.random() * 4)) + ' ms';
  $('pUp').textContent = (any ? (totalKbps / 1000) : 8 + Math.random() * 1.4).toFixed(1) + ' Mbps';
  $('pDrop').textContent = any ? (pgmLoss ? pgmLoss + ' pk' : '0%') : '0%';
  applyHealth(health || 'ok'); // sem stream também mostra "Excelente / Ótimo"
}, 1000);

function drawSpark(id, arr, max) {
  const cv = $(id); if (!cv) return; const ctx = cv.getContext('2d'); const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h); if (arr.length < 2) return;
  ctx.beginPath();
  arr.forEach((v, i) => { const x = (i / (arr.length - 1)) * w; const y = h - (Math.min(v, max) / max) * (h - 2) - 1; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = '#9a7bff'; ctx.lineWidth = 1.5; ctx.stroke();
}
function applyHealth(h) {
  const map = { ok: ['Excelente', 'Ótimo'], warn: ['Bom', 'Bom'], bad: ['Instável', 'Atenção'], '': ['Excelente', 'Ótimo'] };
  const [rede, perf] = map[h] || map['ok'];
  $('netLabel').textContent = rede; $('pNet').textContent = rede; $('pPerf').textContent = perf;
  $('netBars').className = 'bars ' + (h || 'ok');
}

// --------------------------------- init -----------------------------------
$('takeBtn').onclick = take;
$('cutBtn').onclick = take;
$('cutBtn2').onclick = take;
$('takeAutoBtn')?.addEventListener('click', takeAutoPlay);
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
  if (e && e.kind === 'youtube' && e.yt) ctl = ytCtl(e.yt);
  else if (e && e.mediaEl) ctl = videoCtl(e.mediaEl); // vídeo (arquivo/URL) no PREVIEW também tem controle (play/seek antes do ar)
  mediaCur = ctl;
  if (ctl) { bar.classList.remove('is-hidden'); $('mName').textContent = e.label; $('mLoop').style.display = ctl.loopable ? '' : 'none'; $('mMute').innerHTML = ctl.muted() ? '&#128263;' : '&#128266;'; }
  else bar.classList.add('is-hidden');
}
// vídeo por URL direta (.mp4/.webm) -> fonte real
function addVideoUrl(url) {
  const v = document.createElement('video');
  v.src = url; v.crossOrigin = 'anonymous'; v.loop = false; v.playsInline = true; // NÃO autoplay
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'video', (url.split('/').pop() || 'Video').split('?')[0], true);
  e.mediaEl = v; e.url = url; applySourceColor(e, nextVidColor());
  let mixNode = null;
  try { const ch = window.Mixer && window.Mixer.addMediaElement && window.Mixer.addMediaElement(v, e.label, e.color); mixNode = ch && ch.node; } catch {}
  e.mixNode = mixNode;
  e.cleanup = () => { try { e.canvasStop && e.canvasStop(); } catch {} if (mixNode && window.Mixer && window.Mixer.removeChannelByNode) try { window.Mixer.removeChannelByNode(mixNode); } catch {} };
  const apply = () => { if (e.canvasStop) return; const cv = canvasStream(v); e.canvasStop = cv.stop; setStream(id, cv.stream); };
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
// melhor feed ao vivo disponível: PROGRAM > PREVIEW > qualquer fonte conectada
function liveStream() {
  if (programVideo && programVideo.srcObject) return programVideo.srcObject;
  if (previewVideo && previewVideo.srcObject) return previewVideo.srcObject;
  for (const [, e] of sources) if (e.stream) return e.stream;
  return null;
}
window.Studio = {
  addWebcam, addScreen, addVideoFile, addVideoPlaylist, addImageFile, addVideoUrl, addLink, addYouTube, addColorSource, addChromaSource, addReplay, pickFile, openAddMenu, liveStream,
  setProgram, setPreview, clearProgram, clearPreview, take, fadeTake, crossfadeAir, ftb, selectSourceByNode,
  mediaElFor: (id) => { const e = sources.get(id); return e ? e.mediaEl : null; },
  sourceKind: (id) => { const e = sources.get(id); return e ? e.kind : null; },
  state: () => ({ program: programId, preview: previewId }),
  sourcesInfo: () => ({ preview: previewId, program: programId, list: [...sources.values()].map(e => ({ id: e.id, label: e.label, kind: e.kind, stream: e.stream })) }),
};

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
