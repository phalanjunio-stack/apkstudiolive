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
  f.draggable = true;   // arrastar a FONTE → soltar no PREVIEW vira CAMADA
  f.addEventListener('dragstart', e => { try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'copy'; } catch (err) {} f.classList.add('dragging-src'); });
  f.addEventListener('dragend', () => f.classList.remove('dragging-src'));
  f.innerHTML =
    '<div class="thumb"><button class="num" title="Número (pad/tecla) — clique pra marcar">#</button><video autoplay playsinline muted></video>' +
    `<span class="kind-tag">${KIND[kind]}</span><span class="bat-badge" hidden></span></div>` +
    `<div class="head"><span class="nm" title="${label}">${label}</span>` +
    (removable ? '<button class="fcard-x" title="Remover">&times;</button>' : '') + '</div>' +
    '<div class="foot"><span class="ty">conectando&hellip;</span><span class="st"></span></div>';
  f.addEventListener('click', e => {
    if (e.target.closest('.fcard-x')) { removeSource(id); return; }
    if (e.target.closest('.num')) { e.stopPropagation(); cycleSourceHotkey(id); return; }   // # = marcar número da fonte
    dropSourceAsLayer(id);   // clicar no card = adiciona como CAMADA no preview (tudo é camada)
    selectSource(id);        // acende o canal do mixer na cor da fonte
  });
  f.addEventListener('dblclick', e => { // 2 cliques = pré-visualizar (assistir antes do ar; áudio no fone)
    if (e.target.closest('.fcard-x')) return;
    const s = sources.get(id); if (!s) return;
    if (s.kind === 'playlist') { if (window.VideoFloat && window.VideoFloat.open) window.VideoFloat.open(); else if (window.openPlaylistModal) window.openPlaylistModal('video'); }
    else if (s.url && window.openAudition) window.openAudition(s.url, s.label, true);
  });
  // convidados remotos (celular/WebRTC) vão pro grid REMOTOS; o resto fica nos LOCAIS
  const rg = (kind === 'phone') ? document.getElementById('remotosGrid') : null;
  if (rg) { f.classList.add('fcard-remote'); rg.appendChild(f); } else fontesGrid.appendChild(f);   // fontes entram DEPOIS do quadro "+ Adicionar fonte"
  if (window.Guests && window.Guests.refresh) window.Guests.refresh();
  const c = elc('div', 'mvcell fx-pop'); c.dataset.id = id;
  c.innerHTML = '<video autoplay playsinline muted></video>' + `<span class="n">${label}</span>`;
  c.addEventListener('click', () => setPreview(id));
  mvEl.appendChild(c);
  wirePreviewDrop();   // garante a zona de drop do PREVIEW ligada (idempotente)
  return { tile: f, tv: f.querySelector('video'), fty: f.querySelector('.ty'), fst: f.querySelector('.st'), mv: c, mvv: c.querySelector('video'), bat: f.querySelector('.bat-badge') };
}

// ---- Arrastar FONTE → soltar no PREVIEW: vira CAMADA (modelo unificado "tudo é camada") ----
let _previewDropWired = false;
function wirePreviewDrop() {
  if (_previewDropWired) return;
  const mon = $('previewMon'); if (!mon) return;
  _previewDropWired = true;
  mon.addEventListener('dragover', e => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {} mon.classList.add('drop-hot'); });
  mon.addEventListener('dragleave', e => { if (!e.relatedTarget || !mon.contains(e.relatedTarget)) mon.classList.remove('drop-hot'); });
  mon.addEventListener('drop', e => { e.preventDefault(); mon.classList.remove('drop-hot'); const id = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || ''; if (id) { if (window.Grid && window.Grid.fillSlotAt && window.Grid.fillSlotAt(e.clientX, e.clientY, id)) return; dropSourceAsLayer(id); } });
}
// fonte da biblioteca → CAMADA. UM caminho só: delega pro Biblioteca.addLayer
// (garante a cena de preview, vídeo entra tela cheia, imagem vira logo, seleciona).
function dropSourceAsLayer(id) {
  const s = sources.get(id); if (!s) return;
  const B = window.Biblioteca, Gd = window.Graphics;
  const isImg = s.kind === 'image' || (s.url && /^data:image|\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(s.url));
  // vídeo de ARQUIVO (tem url) → a camada toca o arquivo DIRETO (confiável). Câmera ao vivo (webcam/celular) → usa o stream.
  const isVidFile = !isImg && !!s.url && s.kind !== 'youtube';   // qualquer arquivo (não-imagem, não-youtube) toca direto
  // DEDUP: se essa fonte/mídia já é camada, só seleciona (não duplica). Duplicar = botão no painel Camadas.
  if (Gd && Gd.list) { const ex = Gd.list().find(o => o.data && (o.data.sourceId === id || ((isImg || isVidFile) && s.url && o.data.src === s.url))); if (ex) { if (Gd.select) Gd.select(ex.id); try { window.SoundFX && window.SoundFX.click(); } catch (e) {} return; } }
  if (B && B.addLayer) {
    if (isImg && s.url) B.addLayer({ kind: 'image', src: s.url, name: s.label }, 50, 50);
    else if (isVidFile) B.addLayer({ kind: 'video', src: s.url, name: s.label }, 50, 50);   // toca o arquivo direto
    else B.addLayer({ kind: 'source', id, label: s.label }, 50, 50);                          // câmera ao vivo (stream)
    try { window.SoundFX && window.SoundFX.click(); } catch (e) {}
    return;
  }
  // fallback (Biblioteca ainda não carregou)
  const G = window.Graphics; if (!G || !G.add) return;
  let o; if (isImg && s.url) { o = G.add('image'); if (o) G.update(o.id, { src: s.url }); }
  else { o = G.add('video'); if (o) G.update(o.id, s.stream ? { sourceId: id, label: s.label } : { src: s.url, label: s.label }); }
  if (o && G.select) G.select(o.id);
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
  // fonte nova NÃO vira mais "fundo" do PREVIEW. Ela fica na biblioteca; vira CAMADA quando
  // você clica ou arrasta o card (modelo "tudo é camada"). Corrige o vídeo que entrava como fundo.
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

// ------------------------- Kivo Composer bridge ---------------------------
const COMPOSER_URL = '/composer/';
const COMPOSER_OVERLAY_URL = '/composer/overlay.html';
function composerOverlay() {
  const g = window.Graphics;
  return g && g.list ? g.list().find(o => o.type === 'composer') : null;
}
function updateComposerState() {
  const state = $('composerState');
  const btn = $('composerAirBtn');
  if (!state) return;
  const ov = composerOverlay();
  const live = !!(ov && ov.visible !== false);
  state.classList.toggle('is-live', live);
  state.textContent = live ? 'Overlay Composer no PROGRAM' : 'Overlay pronto em /composer/overlay.html';
  if (btn) btn.textContent = live ? 'Tirar overlay da Live' : 'Enviar overlay para Live';
  if (btn) btn.classList.toggle('on', live);
}
function openComposer() {
  window.open(COMPOSER_URL, 'kivo_composer');
}
function ensureComposerOverlay() {
  const g = window.Graphics;
  if (!g || !g.add) { toast('Motor de gráficos ainda carregando.'); return null; }
  let ov = composerOverlay();
  if (!ov) ov = g.add('composer');
  if (!ov) return null;
  if (g.setOverlayScene) g.setOverlayScene(ov.id, null);
  if (g.update) g.update(ov.id, { src: COMPOSER_OVERLAY_URL, label: 'Kivo Composer' });
  if (g.setPos) g.setPos(ov.id, 0, 0);
  if (g.setWidth) g.setWidth(ov.id, 100);
  if (g.setHeight) g.setHeight(ov.id, 100);
  if (g.setVisible) g.setVisible(ov.id, true);
  if (g.raise) g.raise(ov.id);
  updateComposerState();
  toast('Overlay do Kivo Composer enviado para Live.');
  return ov;
}
function hideComposerOverlay() {
  const g = window.Graphics;
  const ov = composerOverlay();
  if (!g || !ov) { updateComposerState(); return toast('Composer ainda não está no ar.'); }
  g.setVisible(ov.id, false);
  updateComposerState();
  toast('Overlay do Composer ocultado.');
}
// 1 botão = toggle: no ar → tira; fora → envia (regra "tudo que ativa, desativa")
function toggleComposerOverlay() {
  const ov = composerOverlay();
  if (ov && ov.visible !== false) hideComposerOverlay(); else ensureComposerOverlay();
}
function bindComposerBridge() {
  $('btnComposer')?.addEventListener('click', openComposer);
  $('composerOpenBtn')?.addEventListener('click', openComposer);
  $('composerAirBtn')?.addEventListener('click', toggleComposerOverlay);
  $('composerHideBtn')?.addEventListener('click', hideComposerOverlay);
  const waitGraphics = () => {
    if (window.Graphics && window.Graphics.onChange) {
      window.Graphics.onChange(updateComposerState);
      updateComposerState();
    } else {
      setTimeout(waitGraphics, 250);
    }
  };
  waitGraphics();
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
  v.src = url; v.loop = true; v.playsInline = true;   // toca em loop pra a camada MOSTRAR o vídeo (senão fica quadro congelado)
  const id = 'local-' + (++localSeq);
  const e = ensureSource(id, 'video', file.name, true);
  e.mediaEl = v; e.url = url; applySourceColor(e, nextVidColor());
  // áudio do vídeo cai automático no MIXER (volume controlado lá; não sai direto no alto-falante)
  let mixNode = null;
  try { const ch = window.Mixer && window.Mixer.addMediaElement && window.Mixer.addMediaElement(v, file.name, e.color); mixNode = ch && ch.node; } catch {}
  e.mixNode = mixNode;
  e.cleanup = () => {
    try { e.canvasStop && e.canvasStop(); } catch {}
    // REF-COUNT: a camada de vídeo de arquivo copia esta blob URL pra data.src. Se a fonte for
    // removida e a gente revogar a URL, a camada que ainda a referencia vira TELA PRETA no próximo
    // repaint. Então só revoga quando NENHUMA camada do Graphics depende mais dela.
    let used = false;
    try { used = !!(window.Graphics && window.Graphics.list && window.Graphics.list().some(o => o && o.data && o.data.src === url)); } catch {}
    if (!used) { try { URL.revokeObjectURL(url); } catch {} }
    if (mixNode && window.Mixer && window.Mixer.removeChannelByNode) try { window.Mixer.removeChannelByNode(mixNode); } catch {}
  };
  const apply = () => { if (e.canvasStop) return; const cv = canvasStream(v); e.canvasStop = cv.stop; setStream(id, cv.stream); v.play && v.play().catch(() => {}); }; // só vídeo na fonte; áudio é do mixer
  if (v.readyState >= 2) apply(); else v.addEventListener('loadeddata', apply, { once: true });
  return id;
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
  let raf = 0, stopped = false, _clast = 0;
  function frame(ts) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (ts && _clast && ts - _clast < 33) return;   // ~30fps: a 60 (rAF puro) era desperdício e travava a UI
    _clast = ts || 0;
    if (!v.videoWidth) return;
    const live = (programId === id || previewId === id);   // só recorta o verde quando a câmera está no ar/preview
    if (live) {
      tctx.drawImage(v, 0, 0, cv.width, cv.height);
      let img; try { img = tctx.getImageData(0, 0, cv.width, cv.height); } catch { img = null; }
      if (img) {
        const d = img.data;
        for (let p = 0; p < d.length; p += 4) { const r = d[p], g = d[p + 1], b = d[p + 2]; if (g > 90 && g > r * 1.25 && g > b * 1.2) d[p + 3] = 0; }
        ctx.fillStyle = e.chroma.bg; ctx.fillRect(0, 0, cv.width, cv.height);
        tctx.putImageData(img, 0, 0); ctx.drawImage(tmp, 0, 0);
      } else ctx.drawImage(v, 0, 0, cv.width, cv.height);
    } else ctx.drawImage(v, 0, 0, cv.width, cv.height);   // ocioso: só passa a imagem (sem o loop de 921k pixels)
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

// entrada de ÁUDIO (microfone / mesa) — vai direto pro MIXER, sem virar card de vídeo (igual OBS)
async function addAudioInput(deviceId, label) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false });
    if (window.Mixer && window.Mixer.addStreamAudio) window.Mixer.addStreamAudio(stream, label || 'Microfone');
    else stream.getTracks().forEach(t => t.stop());
    toast('Áudio "' + (label || 'Microfone') + '" no mixer.');
  } catch (e) { toast('Áudio: ' + e.message); }
}
// menu OBS-style: escolhe o TIPO (Câmera/Captura/Mídia/Áudio) → a ORIGEM (dispositivo).
// Câmera/vídeo/tela viram FONTE (card na biblioteca, arraste pro PREVIEW). Imagem/logo vai pra biblioteca.
// ícones de linha (estilo Lucide, igual ao menu lateral) — sem emoji
const ADDIC = {
  webcam: '<circle cx="12" cy="11" r="3.4"/><path d="M3 7h3l2-2.5h8L18 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18.5h2"/>',
  wand: '<path d="m12 3-1.6 4.8a2 2 0 0 1-1.3 1.3L4.5 10.7l4.6 1.6a2 2 0 0 1 1.3 1.3L12 18.4l1.6-4.8a2 2 0 0 1 1.3-1.3l4.6-1.6-4.6-1.6a2 2 0 0 1-1.3-1.3Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  listvideo: '<path d="M3 6h12"/><path d="M3 12h8"/><path d="M3 18h8"/><path d="m15 11 6 3.5-6 3.5v-7Z"/>',
  link: '<path d="m9 15 6-6"/><path d="M11 6.5 13 4.5a4 4 0 0 1 6 6l-2 2"/><path d="M13 17.5l-2 2a4 4 0 0 1-6-6l2-2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 21"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v4"/><path d="M8 22h8"/>',
  palette: '<path d="M12 3.5 6.5 9a7.5 7.5 0 1 0 11 0Z"/>',
  rewind: '<path d="M11 19 3 12l8-7v14Z"/><path d="M21 19l-8-7 8-7v14Z"/>',
};
function addIcon(k) { return '<svg class="addsrc-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ADDIC[k] || '') + '</svg>'; }
// menu OBS-style: escolhe o TIPO (Câmera/Captura/Mídia/Áudio) → a ORIGEM (dispositivo).
// Câmera/vídeo/tela viram FONTE (card na biblioteca, arraste pro PREVIEW). Imagem/logo vai pra biblioteca.
async function openAddMenu(ev) {
  closeAddMenu();
  let cams = [], mics = [];
  try { const d = await navigator.mediaDevices.enumerateDevices(); cams = d.filter(x => x.kind === 'videoinput'); mics = d.filter(x => x.kind === 'audioinput'); } catch {}
  const items = [];
  items.push(['__grp', 'Câmeras']);
  if (cams.length && cams.some(c => c.label)) cams.forEach(c => items.push([(c.label || 'Câmera USB'), () => addWebcam(c.deviceId, c.label || 'Câmera USB'), 'webcam']));
  else items.push(['Câmera USB / webcam', () => addWebcam(null, 'Câmera USB'), 'webcam']);
  items.push(['Celular (câmera via QR)', () => window.openConnectModal && window.openConnectModal('camera', 'camera'), 'phone']);
  items.push(['Chroma key (fundo verde → virtual set)', addChromaSource, 'wand']);
  items.push(['__grp', 'Captura de tela']);
  items.push(['Tela / janela / aba (jogo, YouTube...)', addScreen, 'monitor']);
  items.push(['__grp', 'Mídia']);
  items.push(['Vídeo (arquivo)', () => pickFile('video/*', addVideoFile), 'film']);
  items.push(['Playlist de vídeos (vários)', () => pickFiles('video/*', addVideoPlaylist), 'listvideo']);
  items.push(['Link (YouTube / vídeo URL)', addLink, 'link']);
  items.push(['Imagem / Logo (biblioteca)', () => window.Biblioteca ? window.Biblioteca.importImages() : pickFile('image/*', addImageFile), 'image']);
  items.push(['__grp', 'Áudio']);
  if (mics.length && mics.some(m => m.label)) mics.forEach(m => items.push([(m.label || 'Microfone'), () => addAudioInput(m.deviceId, m.label || 'Microfone'), 'mic']));
  else items.push(['Microfone / entrada de áudio', () => addAudioInput(null, 'Microfone'), 'mic']);
  items.push(['__grp', 'Gerar']);
  items.push(['Cor sólida (fundo / placa)', addColorSource, 'palette']);
  items.push(['Instant Replay (câmera lenta)', addReplay, 'rewind']);
  const ov = elc('div', 'modal-overlay glow-overlay'); ov.id = 'addMenu';
  const shell = elc('div', 'glow-shell');
  const card = elc('div', 'glow-modal');
  card.innerHTML = '<div class="gm-head"><h2>Adicionar fonte</h2><button class="modal-close" type="button" style="position:static" aria-label="Fechar">✕</button></div>' +
    '<div class="gm-body"><p class="addsrc-sub">Escolha a origem. Câmera, vídeo e tela entram na biblioteca — arraste pro PREVIEW pra virar camada.</p><div class="addsrc-list"></div></div>';
  const list = card.querySelector('.addsrc-list');
  items.forEach(([label, fn, icon]) => {
    if (label === '__grp') { list.appendChild(elc('div', 'addsrc-grp')).textContent = fn; return; }
    const b = elc('button', 'addsrc-item'); b.type = 'button';
    b.innerHTML = addIcon(icon) + '<span class="addsrc-tx"></span>';
    b.querySelector('.addsrc-tx').textContent = label;
    b.onclick = () => { closeAddMenu(); fn(); }; list.appendChild(b);
  });
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
  { const _pn = $('previewName'); if (_pn) _pn.textContent = ''; }   // sem nome do arquivo poluindo o PREVIEW (pedido do usuário)
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
function take() {   // TAKE = publica o PREVIEW no PROGRAMA (camadas onPrev→onPgm) + troca o vídeo-base (legado)
  const clear = localStorage.getItem('sl-take-clear') === '1';
  if (window.Graphics && window.Graphics.commitPreviewToProgram) window.Graphics.commitPreviewToProgram(clear);   // modelo unificado: TODAS as camadas (Biblioteca/Grelha/Pads) são padManaged → commit aplica pv→ao vivo e onPrev→onPgm
  if (!previewId) { refreshButtons(); return; }
  const newProg = previewId, oldProg = programId;
  setProgram(newProg);                                           // muteVideoChannel já pausa o ex-programa
  const ne = sources.get(newProg);
  if (ne && ne.mediaEl && ne.mediaEl.paused) ne.mediaEl.play().catch(() => {});  // garante o novo no ar TOCANDO
  if (oldProg && oldProg !== newProg) setPreview(oldProg);       // SWAP: ex-programa → preview (fica pausado/congelado)
}
// TAKE + Play: manda pro ar JÁ TOCANDO, com áudio (desmuta) e vídeo (play)
function takeAutoPlay() {
  if (window.Graphics && window.Graphics.commitPreviewToProgram) window.Graphics.commitPreviewToProgram(localStorage.getItem('sl-take-clear') === '1');
  const id = previewId; if (!id || !sources.has(id)) { refreshButtons(); return; }
  const e = sources.get(id); const oldProg = programId;
  setProgram(id);
  if (e.mediaEl && e.mediaEl.paused) e.mediaEl.play().catch(() => {});
  if (e.mixNode && window.Mixer && window.Mixer.setChannelMuted) window.Mixer.setChannelMuted(e.mixNode, false);
  if (oldProg && oldProg !== id) setPreview(oldProg);   // SWAP: ex-programa → preview (pausado)
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
function fadeTake() {
  if (window.Graphics && window.Graphics.commitPreviewToProgram) window.Graphics.commitPreviewToProgram(localStorage.getItem('sl-take-clear') === '1');
  if (!previewId) { refreshButtons(); return; }
  const oldProg = programId, newProg = previewId;
  crossfade(newProg);
  if (oldProg && oldProg !== newProg) setPreview(oldProg);   // SWAP: ex-programa → preview (igual ao TAKE)
}
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
    // "tudo é camada": se há uma camada selecionada, corta ELA (corte Photoshop bom). Senão, corte de fonte (legado).
    const g = window.Graphics; const sel = g && g.selected ? g.selected() : null;
    if (sel != null && window.Biblioteca && window.Biblioteca.crop) { window.Biblioteca.crop(sel); return; }
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
function refreshButtons() { const on = !!previewId || (window.Graphics && window.Graphics.previewCount && window.Graphics.previewCount() > 0); $('takeBtn').disabled = !on; $('cutBtn').disabled = !on; const c2 = $('cutBtn2'); if (c2) c2.disabled = !on; const f = $('fadeBtn'), a = $('autoBtn'), ta = $('takeAutoBtn'); if (f) f.disabled = !on; if (a) a.disabled = !on; if (ta) ta.disabled = !on; }

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
$('cutBtn2') && ($('cutBtn2').onclick = take);
$('takeAutoBtn')?.addEventListener('click', takeAutoPlay);
$('fadeBtn').onclick = fadeTake;
$('autoBtn').onclick = fadeTake;
$('ftbBtn').onclick = ftb;
// botões TAKE/CUT ligam/desligam conforme há conteúdo no PREVIEW (camadas onPrev).
// studio.js carrega ANTES do graphics.js → espera o motor existir pra inscrever.
(function hookButtons() { if (window.Graphics && window.Graphics.onChange) { window.Graphics.onChange(refreshButtons); window.Graphics.onChange(updateMediaBar); refreshButtons(); } else setTimeout(hookButtons, 150); })();
// T-BAR: arrasta a barrinha de ponta a ponta = TAKE (fade); soltar antes do fim cancela
(function wireTBar() {
  const bar = document.querySelector('.switch .tbar'); if (!bar) return; const knob = bar.querySelector('i'); if (!knob) return;
  let dragging = false, did = false;
  bar.addEventListener('pointerdown', e => { dragging = true; did = false; try { bar.setPointerCapture(e.pointerId); } catch (er) {} move(e); });
  function move(e) { if (!dragging) return; const r = bar.getBoundingClientRect(); let p = (e.clientX - r.left) / r.width; p = Math.max(0, Math.min(1, p)); knob.style.left = (p * 100) + '%'; if (!did && p > 0.85) { did = true; take(); } }
  bar.addEventListener('pointermove', move);
  function up() { if (!dragging) return; dragging = false; knob.style.left = ''; }   // volta pro lugar
  bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
})();

(function init() {
  const add = elc('div', 'fcard addcard'); add.id = 'addCard';
  add.innerHTML = '<div class="addcard-inner"><span class="plus">+</span><span>Adicionar fonte</span></div>';
  add.addEventListener('click', openAddMenu);
  fontesGrid.prepend(add);   // o quadro "+ Adicionar fonte" fica no TOPO da LOCAIS (sempre visível)
  $('addFonteBtn') && $('addFonteBtn').addEventListener('click', openAddMenu);
  bindComposerBridge();
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
let mediaCur = null, mediaMode = 'prev', mediaSeeking = false;   // player de mídia: controlador atual + modo (prev/air)
const fmtT = (s) => { s = Math.floor(s) || 0; return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// controllers unificados pros dois tipos de mídia
function videoCtl(v) { return { play: () => v.play().catch(() => {}), pause: () => v.pause(), paused: () => v.paused, time: () => v.currentTime || 0, dur: () => v.duration || 0, seek: (f) => { if (v.duration) v.currentTime = v.duration * f; }, muted: () => v.muted, toggleMute: () => { v.muted = !v.muted; }, setVol: (x) => { try { v.volume = Math.max(0, Math.min(1, x)); } catch (e) {} }, loopable: true, loop: () => v.loop, toggleLoop: () => { v.loop = !v.loop; } }; }
function ytCtl(h) { return { play: () => h.play(), pause: () => h.pause(), paused: () => h.paused(), time: () => h.time(), dur: () => h.duration(), seek: (f) => h.seek(f), muted: () => h.muted(), toggleMute: () => { h.muted() ? h.unmute() : h.mute(); }, setVol: (x) => { try { h.setVolume && h.setVolume(x * 100); } catch (e) {} }, loopable: false, loop: () => false, toggleLoop: () => {} }; }
// controlador da CAMADA de vídeo selecionada (modelo "tudo é camada"): mexe nos DOIS gêmeos (preview + program) em sincronia
// controlador de UM gêmeo do vídeo da camada: which='prev' (monitor PREVIEW) ou 'air' (PROGRAM)
function overlayVidCtl(o, which) {
  const v = (which === 'air') ? (o.el && o.el.querySelector('video')) : (o.elv && o.elv.querySelector('video'));
  if (!v) return null;
  const G = window.Graphics;
  return {
    play: () => { if (which === 'air') { G && G.setAirPlay && G.setAirPlay(o.id, true); } else { G && G.setPrevPlay && G.setPrevPlay(o.id, true); } v.play && v.play().catch(() => {}); },
    pause: () => { if (which === 'air') { G && G.setAirPlay && G.setAirPlay(o.id, false); } else { G && G.setPrevPlay && G.setPrevPlay(o.id, false); } try { v.pause(); } catch (e) {} },
    paused: () => v.paused,
    time: () => v.currentTime || 0,
    dur: () => (isFinite(v.duration) ? v.duration : 0),
    seek: (f) => { if (isFinite(v.duration)) { try { v.currentTime = v.duration * f; } catch (e) {} } },
    muted: () => v.muted, toggleMute: () => { v.muted = !v.muted; },
    setVol: (x) => { try { v.volume = Math.max(0, Math.min(1, x)); } catch (e) {} },
    loopable: true, loop: () => v.loop, toggleLoop: () => { v.loop = !v.loop; },
    isOverlay: true
  };
}
function bindMediaBar() {
  if (!$('mediaBar')) return;
  const ic = (n) => (window.kicon ? window.kicon(n) : '');
  $('mStandby').innerHTML = ic('skip-back'); $('mBack').innerHTML = ic('rewind'); $('mFwd').innerHTML = ic('forward'); $('mMute').innerHTML = ic('volume');
  const seekSec = (s) => { if (!mediaCur) return; const d = mediaCur.dur(); if (d > 0) mediaCur.seek(Math.max(0, Math.min(1, s / d))); };
  $('mPlay').onclick = () => { if (mediaCur) (mediaCur.paused() ? mediaCur.play() : mediaCur.pause()); };
  $('mStandby').onclick = () => { if (mediaCur) { mediaCur.seek(0); mediaCur.pause(); toast('Em espera — pronto pra ir.'); } };   // volta ao início + pausa
  $('mBack').onclick = () => { if (mediaCur) seekSec(mediaCur.time() - 10); };
  $('mFwd').onclick = () => { if (mediaCur) seekSec(mediaCur.time() + 10); };
  $('mMute').onclick = () => { if (mediaCur) { mediaCur.toggleMute(); $('mMute').innerHTML = ic(mediaCur.muted() ? 'volume-x' : 'volume'); } };
  $('mVol') && $('mVol').addEventListener('input', () => { if (mediaCur && mediaCur.setVol) mediaCur.setVol($('mVol').value / 100); });
  $('mModePrev') && ($('mModePrev').onclick = () => { mediaMode = 'prev'; updateMediaBar(); });
  $('mModeAir') && ($('mModeAir').onclick = () => { mediaMode = 'air'; updateMediaBar(); });
  const seek = $('mSeek');
  if (seek) {
    const seekTo = (x) => { if (!mediaCur) return; const r = seek.getBoundingClientRect(); mediaCur.seek(Math.max(0, Math.min(1, (x - r.left) / r.width))); };
    seek.addEventListener('pointerdown', e => { mediaSeeking = true; try { seek.setPointerCapture(e.pointerId); } catch (er) {} seekTo(e.clientX); });
    seek.addEventListener('pointermove', e => { if (mediaSeeking) seekTo(e.clientX); });
    seek.addEventListener('pointerup', () => { mediaSeeking = false; });
    seek.addEventListener('pointercancel', () => { mediaSeeking = false; });
  }
  setInterval(() => {
    if (!mediaCur) return;
    const d = mediaCur.dur(), c = mediaCur.time();
    if (!mediaSeeking && $('mFill')) $('mFill').style.width = (d ? (c / d * 100) : 0) + '%';
    if ($('mTime')) $('mTime').textContent = fmtT(c) + ' / ' + fmtT(d);
    if ($('mPlay')) $('mPlay').innerHTML = ic(mediaCur.paused() ? 'play' : 'pause');
  }, 250);
}
function updateMediaBar() {
  const bar = $('mediaBar'); if (!bar) return;
  let o = null, name = '', onAir = false, srcCtl = null;
  try {                                                                     // a CAMADA de vídeo selecionada
    const G = window.Graphics, sel = G && G.selected ? G.selected() : null;
    const ov = (sel != null && G.get) ? G.get(sel) : null;
    if (ov && ov.type === 'video') { o = ov; name = (ov.data && ov.data.label) || 'Vídeo'; onAir = !!(ov.data && ov.data.onPgm); }
  } catch (e) {}
  if (!o) {                                                                 // nenhum vídeo selecionado: se tiver VÍDEO NO AR, mostra o player dele (modo AO VIVO)
    try {
      const G = window.Graphics, list = (G && G.list) ? G.list() : [];
      const air = list.find(x => x.type === 'video' && x.data && x.data.onPgm && x.visible !== false);
      if (air) { o = air; name = (air.data && air.data.label) || 'Vídeo'; onAir = true; mediaMode = 'air'; }
    } catch (e) {}
  }
  if (!o) {                                                                 // fonte de vídeo/YouTube direto no PREVIEW (legado)
    const e = previewId && sources.get(previewId);
    if (e && e.kind === 'youtube' && e.yt) { srcCtl = ytCtl(e.yt); name = e.label; }
    else if (e && e.mediaEl) { srcCtl = videoCtl(e.mediaEl); name = e.label; }
  }
  if (!o && !srcCtl) { bar.classList.add('is-hidden'); mediaCur = null; return; }
  const airBtn = $('mModeAir'); if (airBtn) airBtn.style.display = (o && onAir) ? '' : 'none';   // tab AO VIVO só quando a camada está no ar
  if (!(o && onAir) && mediaMode === 'air') mediaMode = 'prev';
  mediaCur = o ? overlayVidCtl(o, mediaMode === 'air' ? 'air' : 'prev') : srcCtl;
  $('mModePrev') && $('mModePrev').classList.toggle('on', mediaMode !== 'air');
  $('mModeAir') && $('mModeAir').classList.toggle('on', mediaMode === 'air');
  bar.classList.remove('is-hidden');
  $('mName').textContent = name;
  if (mediaCur && $('mMute')) $('mMute').innerHTML = (window.kicon ? window.kicon(mediaCur.muted() ? 'volume-x' : 'volume') : '');
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
  kprompt('Cole o link (YouTube, ou link direto de vídeo .mp4):', '', { placeholder: 'https://…' }).then(function (url) {
    if (!url) return;
    if (/youtube\.com|youtu\.be/i.test(url)) return addYouTube(url);
    if (/instagram\.com/i.test(url)) return toast('Instagram: use Adicionar fonte > Tela/aba (captura).');
    addVideoUrl(url);
  });
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
  openComposer, sendComposerToLive: ensureComposerOverlay, hideComposerOverlay,
  mediaElFor: (id) => { const e = sources.get(id); return e ? e.mediaEl : null; },
  sourceKind: (id) => { const e = sources.get(id); return e ? e.kind : null; },
  state: () => ({ program: programId, preview: previewId }),
  sourcesInfo: () => ({ preview: previewId, program: programId, list: [...sources.values()].map(e => ({ id: e.id, label: e.label, kind: e.kind, stream: e.stream, url: e.url || '', hotkey: e.hotkey || 0 })) }),
};

// renumera os cards (1,2,3...) = numero da tecla de atalho
function renumber() {
  let i = 0;
  for (const [, e] of sources) { i++; const num = e.tile.querySelector('.num'); if (!num) continue; num.textContent = e.hotkey ? e.hotkey : '#'; num.className = 'num c' + (((i - 1) % 6) + 1) + (e.hotkey ? ' set' : ''); }
}
// marcar o NÚMERO da fonte (#) — clique cicla 1-9, único entre tudo (pads/cenas/logos). Recall pelo pad/tecla.
function cycleSourceHotkey(id) {
  const e = sources.get(id); if (!e) return;
  e.hotkey = (window.Pads && window.Pads.nextFreeNumber) ? window.Pads.nextFreeNumber(e.hotkey, 'source', id) : (((+e.hotkey || 0) + 1) % 10);
  const num = e.tile && e.tile.querySelector('.num'); if (num) { num.textContent = e.hotkey ? e.hotkey : '#'; num.classList.toggle('set', !!e.hotkey); }
  if (window.Pads && window.Pads.refresh) window.Pads.refresh();
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
    const n = +e.key;
    // vMix: o número faz "recall" do slot n. Sem Shift = AO VIVO (PROGRAM) · com Shift = PREVIEW.
    if (window.Pads) { if (e.shiftKey ? window.Pads.firePrev(n) : window.Pads.fireAir(n)) return; }
    const i = n - 1; if (ids[i]) setProgram(ids[i]); // senão, corta direto pra fonte N (legado)
  } else if (e.key === 'c' || e.key === 'C') {   // C = cortar a camada selecionada (estilo Photoshop)
    const sel = window.Graphics && window.Graphics.selected && window.Graphics.selected();
    if (sel != null && window.Biblioteca && window.Biblioteca.crop) { e.preventDefault(); window.Biblioteca.crop(sel); }
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
