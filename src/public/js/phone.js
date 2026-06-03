// Kivo Câmera — app do celular. Vira câmera profissional do Studio (WebRTC).
const params = new URLSearchParams(location.search);
const room = params.get('room') || 'cam1';
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const $ = (id) => document.getElementById(id);

const QMAP = { hd: { w: 1280, h: 720 }, fhd: { w: 1920, h: 1080 }, '4k': { w: 3840, h: 2160 } };
const QBITRATE = { hd: 2500000, fhd: 6000000, '4k': 12000000 };
const QLABEL = { hd: 'HD', fhd: 'Full HD', '4k': '4K' };

let ws, pc, localStream, wakeLock = null, batteryObj = null;
let facing = 'environment', quality = 'fhd', live = false, mySource = params.get('source') || null;
let startTime = 0, statsTimer = 0, durTimer = 0, metaTimer = 0;
let lastBytes = 0, lastTs = 0;

// ---------------- navegação ----------------
function go(name) {
  document.querySelectorAll('.scr').forEach(s => { s.hidden = s.id !== 'scr-' + name; });
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.go === name));
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('backBtn').onclick = () => go('camera');

// ---------------- bateria ----------------
async function initBattery() {
  if (!navigator.getBattery) return;
  try {
    batteryObj = await navigator.getBattery();
    const upd = () => { sendMeta(); paintBattery(); };
    batteryObj.addEventListener('levelchange', upd);
    batteryObj.addEventListener('chargingchange', upd);
    paintBattery();
  } catch {}
}
function paintBattery() { if (batteryObj) $('iBat').textContent = (batteryObj.charging ? '⚡' : '') + Math.round(batteryObj.level * 100) + '%'; }
function sendMeta() { if (ws && ws.readyState === ws.OPEN && batteryObj) ws.send(JSON.stringify({ type: 'meta', battery: Math.round(batteryObj.level * 100), charging: batteryObj.charging })); }

async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && live) keepAwake(); });

// ---------------- mídia ----------------
function showErr(msg) {
  const ce = $('camEmpty'); ce.hidden = false;
  ce.innerHTML = '<div class="ce-ic">&#9888;</div><p>' + msg + '</p>';
  live = false; $('startStop').classList.remove('live');
}
function getStream() {
  const q = QMAP[quality];
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: 30 } },
    audio: true,
  });
}
function applyMicState() { const a = localStream?.getAudioTracks()[0]; if (a) a.enabled = $('micSw').checked; }
function applySenderBitrate() {
  const s = pc?.getSenders().find(x => x.track?.kind === 'video'); if (!s) return;
  const p = s.getParameters(); if (!p.encodings) p.encodings = [{}];
  p.encodings[0].maxBitrate = QBITRATE[quality];
  s.setParameters(p).catch(() => {});
}

async function start() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return showErr('Câmera bloqueada pelo navegador. É preciso abrir por HTTPS e aceitar o aviso do certificado (cadeado). No iPhone, use o Safari (não o Chrome).');
  }
  try { localStream = await getStream(); }
  catch (e) {
    try { localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false }); }
    catch (e2) { return showErr('Não liberou a câmera (' + (e2.name || 'erro') + '): ' + e2.message + '. Toque em "Permitir" quando o navegador pedir — ou libere a câmera nas permissões do site.'); }
  }
  $('preview').srcObject = localStream;
  $('preview').play?.().catch(() => {});
  $('camEmpty').hidden = true;
  applyMicState();
  live = true;
  $('startStop').classList.add('live');
  $('recBadge').hidden = false; $('liveBadge').hidden = false; $('timer').hidden = false;
  startTime = Date.now();
  keepAwake(); initBattery();
  metaTimer = setInterval(sendMeta, 60000);
  durTimer = setInterval(updateDuration, 1000);
  statsTimer = setInterval(updateStats, 1000);
  connect();
}
function stop() {
  live = false;
  $('startStop').classList.remove('live');
  $('recBadge').hidden = true; $('liveBadge').hidden = true; $('timer').hidden = true;
  $('camEmpty').hidden = false;
  [metaTimer, durTimer, statsTimer].forEach(clearInterval); metaTimer = durTimer = statsTimer = 0;
  if (pc) { pc.close(); pc = null; }
  if (ws) { ws.close(); ws = null; }
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  $('preview').srcObject = null;
  $('stTitle').textContent = 'Transmissão encerrada'; $('connTitle').textContent = 'Desconectado';
  wakeLock?.release?.(); wakeLock = null;
}

// ---------------- sinalização ----------------
function connect() {
  ws = new WebSocket(`wss://${location.host}/ws`);
  ws.onopen = () => { ws.send(JSON.stringify({ type: 'join', role: 'phone', room, source: mySource })); };
  ws.onmessage = async ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.type === 'assigned') { mySource = msg.source; $('cCam').textContent = camLabel(mySource); sendMeta(); }
    else if (msg.type === 'full') { alert('Sem vaga: já há 6 câmeras conectadas.'); stop(); }
    else if (msg.type === 'ready') startOffer();
    else if (msg.type === 'answer') { try { await pc.setRemoteDescription(msg.sdp); } catch {} }
    else if (msg.type === 'ice' && msg.candidate) { try { await pc.addIceCandidate(msg.candidate); } catch {} }
  };
  ws.onclose = () => { if (live) { setConn(false, 'Reconectando…'); setTimeout(connect, 1000); } };
}
async function startOffer() {
  if (pc) pc.close();
  pc = new RTCPeerConnection(ICE);
  for (const t of localStream.getTracks()) pc.addTrack(t, localStream);
  pc.onicecandidate = (e) => { if (e.candidate) ws.send(JSON.stringify({ type: 'ice', candidate: e.candidate })); };
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'connected') { setConn(true); applySenderBitrate(); sendMeta(); }
    else if (s === 'disconnected' || s === 'failed') { setConn(false, 'Sinal instável…'); if (s === 'failed') startOffer(); }
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
}

// ---------------- controles ----------------
async function flip() {
  facing = facing === 'environment' ? 'user' : 'environment';
  $('camVal').textContent = (facing === 'environment' ? 'Traseira' : 'Frontal') + ' ⌄';
  await swapVideo();
}
async function setQuality(q) {
  quality = q;
  document.querySelectorAll('#qualitySeg button').forEach(b => b.classList.toggle('on', b.dataset.q === q));
  if (live) await swapVideo(); applySenderBitrate();
}
async function swapVideo() {
  if (!live || !localStream) return;
  try {
    const old = localStream.getVideoTracks()[0];
    const ns = await getStream();
    const nt = ns.getVideoTracks()[0];
    const sender = pc?.getSenders().find(s => s.track?.kind === 'video');
    if (sender) await sender.replaceTrack(nt);
    if (old) { localStream.removeTrack(old); old.stop(); }
    localStream.addTrack(nt);
    ns.getAudioTracks().forEach(t => t.stop());
    $('preview').srcObject = localStream;
    applySenderBitrate();
  } catch (e) { /* ignora */ }
}
function setGrid(mode) {
  $('gridOv').dataset.grid = mode;
  document.querySelectorAll('#gridSeg button').forEach(b => b.classList.toggle('on', b.dataset.grid === mode));
}
function toggleFlash() {
  const v = localStream?.getVideoTracks()[0]; if (!v) return;
  v.applyConstraints({ advanced: [{ torch: $('flashSw').checked }] }).catch(() => { $('flashSw').checked = false; });
}
function toggleStab() {
  const v = localStream?.getVideoTracks()[0]; if (!v) return;
  try { v.applyConstraints({ advanced: [{ videoStabilizationMode: $('stabSw').checked ? 'standard' : 'off' }] }).catch(() => {}); } catch {}
}

// ---------------- stats / status ----------------
function updateDuration() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const t = [s / 3600, (s % 3600) / 60, s % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':');
  $('timer').textContent = t; $('iDur').textContent = t;
}
async function updateStats() {
  if (!pc) return;
  const stats = await pc.getStats(); let out, pair, rem; const codecs = {};
  stats.forEach(r => {
    if (r.type === 'outbound-rtp' && r.kind === 'video') out = r;
    if (r.type === 'candidate-pair' && r.nominated) pair = r;
    if (r.type === 'remote-inbound-rtp' && r.kind === 'video') rem = r;
    if (r.type === 'codec') codecs[r.id] = r;
  });
  if (out) {
    const res = (out.frameWidth || 0) + '×' + (out.frameHeight || 0);
    const fps = Math.round(out.framesPerSecond || 0);
    const now = out.timestamp, bytes = out.bytesSent || 0;
    let kbps = 0; if (lastTs) kbps = Math.max(0, Math.round((bytes - lastBytes) * 8 / (now - lastTs)));
    lastBytes = bytes; lastTs = now;
    const mbps = (kbps / 1000).toFixed(1) + ' Mbps';
    $('sRes').textContent = res; $('sFps').textContent = fps; $('sBitrate').textContent = mbps;
    $('iRes').textContent = (out.frameWidth ? res + ' (' + QLABEL[quality] + ')' : '—');
    $('iFps').textContent = fps; $('iBitrate').textContent = mbps;
    const cod = codecs[out.codecId]; $('iCodec').textContent = cod ? cod.mimeType.replace('video/', '') : '—';
  }
  const rtt = pair?.currentRoundTripTime;
  const sig = rtt == null ? '—' : rtt < 0.1 ? 'Excelente' : rtt < 0.3 ? 'Bom' : 'Fraco';
  $('sSignal').textContent = sig; $('iSignal').textContent = sig;
}
function setConn(ok, msg) {
  $('stCard').classList.toggle('ok', !ok);
  if (ok) {
    $('stTitle').textContent = 'Transmitindo ao Studio'; $('stSub').textContent = 'Studio: SETELAGOAS-STUDIO';
    $('connTitle').textContent = 'Conectado ao Studio'; $('connSub').textContent = camLabel(mySource);
  } else {
    $('stTitle').textContent = msg || 'Conectando…'; $('connTitle').textContent = msg || 'Conectando…';
  }
}
const camLabel = (id) => (id ? id.replace('cam', 'Câmera ') : '—');

// ---------------- wiring ----------------
$('startStop').onclick = () => (live ? stop() : start());
$('flipBtn').onclick = flip; $('micBtn2').onclick = () => { $('micSw').checked = !$('micSw').checked; applyMicState(); $('micBtn2').classList.toggle('on', $('micSw').checked); };
$('endBtn').onclick = stop;
$('reconBtn').onclick = () => { if (live) { ws?.close(); } };
$('camRow').onclick = flip;
document.querySelectorAll('#qualitySeg button').forEach(b => b.onclick = () => setQuality(b.dataset.q));
document.querySelectorAll('#gridSeg button').forEach(b => b.onclick = () => setGrid(b.dataset.grid));
$('flashSw').onchange = toggleFlash;
$('micSw').onchange = applyMicState;
$('stabSw').onchange = toggleStab;

(async function initInfo() {
  try { const info = await fetch('/api/info').then(r => r.json()); $('cIp').textContent = info.lanIp; } catch {}
  $('cCam').textContent = camLabel(mySource);
})();
