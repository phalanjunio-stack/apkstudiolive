// Kivo Studio — servidor (WebRTC + sinalizacao).
// Faz tres coisas: (1) serve as paginas (studio/celular), (2) gera o QR de conexao,
// (3) e o "sinaleiro" (signaling) WebRTC que apresenta o celular ao estudio.
// O video em si NAO passa por aqui: ele vai direto celular -> PC (peer-to-peer),
// que e o que deixa tudo leve e estavel.
import https from 'node:https';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import qrcode from 'qrcode';
import { loadOrCreateCert } from './cert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT ?? 8443);

// Descobre o IP da maquina na rede local (pra montar o link/QR do celular).
function getLanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const lanIp = getLanIp();
const { key, cert } = loadOrCreateCert(lanIp);

const app = express();
app.use(express.json({ limit: '256kb' }));

// DEV: nunca cachear — CSS/JS/HTML sempre frescos (mudanças aparecem na hora, sem Ctrl+Shift+R)
const NO_CACHE = { etag: false, lastModified: false, cacheControl: false };
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// ---- Ponte (proxy) pro servidor de licencas — evita mixed-content e esconde a URL do cliente.
// Configure o destino com a variavel de ambiente LICENSE_SERVER (ex.: https://licencas.seudominio.com)
const LICENSE_SERVER = (process.env.LICENSE_SERVER || 'http://localhost:4010').replace(/\/+$/, '');
async function licProxy(req, res, endpoint) {
  try {
    const r = await fetch(LICENSE_SERVER + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body || {}) });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(502).json({ ok: false, error: 'Servidor de licença indisponível' }); }
}
app.post('/api/lic/activate', (req, res) => licProxy(req, res, '/api/activate'));
app.post('/api/lic/check', (req, res) => licProxy(req, res, '/api/check'));

// ---- ffmpeg (encoder de transmissao) ----
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
function ffmpegOk() { try { return spawnSync(FFMPEG, ['-version'], { stdio: 'ignore' }).status === 0; } catch { return false; } }
app.get('/api/stream/status', (req, res) => res.json({ ffmpeg: ffmpegOk() }));

app.get('/api/info', (req, res) => {
  // Se houver túnel (PUBLIC_URL), o QR aponta pra ele (HTTPS confiável -> câmera abre sem aviso)
  const pub = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/+$/, '') : null;
  const base = pub || `https://${lanIp}:${PORT}`;
  res.json({ lanIp, port: PORT, public: pub, studioUrl: base + '/studio', phoneUrl: base + '/phone', controlUrl: base + '/control' });
});

app.get('/qr', async (req, res) => {
  const text = String(req.query.text ?? '');
  if (!text) return res.status(400).send('missing text');
  const svg = await qrcode.toString(text, { type: 'svg', margin: 1, width: 240 });
  res.type('image/svg+xml').send(svg);
});

app.get('/studio', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'studio.html'), NO_CACHE));
app.get('/phone', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'phone.html'), NO_CACHE));
app.get('/control', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'control.html'), NO_CACHE));
app.get('/multiview', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'multiview.html'), NO_CACHE));
app.get('/futebol', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'modo-futebol.html'), NO_CACHE));
app.use(express.static(PUBLIC_DIR, NO_CACHE));

const server = https.createServer({ key, cert }, app);

// ---------------------------------------------------------------------------
// Signaling WebRTC. Cada "sala" tem 1 estudio + ate MAX_SOURCES cameras (celulares).
// Cada camera ganha um id (cam1, cam2, ...). O estudio mantem uma conexao
// separada por camera. Toda mensagem de offer/answer/ice carrega o "source"
// pra sabermos de qual camera estamos falando. O video nunca passa pelo servidor.
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });
const streamWss = new WebSocketServer({ noServer: true, maxPayload: 12 * 1024 * 1024 });
server.on('upgrade', (req, socket, head) => {
  let pathname = '/';
  try { pathname = new URL(req.url, 'http://x').pathname; } catch {}
  if (pathname === '/ws') wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  else if (pathname === '/stream') streamWss.handleUpgrade(req, socket, head, (ws) => streamWss.emit('connection', ws, req));
  else socket.destroy();
});

// ---- INGEST de transmissao: recebe o PROGRAM (webm) -> ffmpeg -> RTMP (varios destinos) ----
streamWss.on('connection', (ws) => {
  let ff = null;
  const sj = (obj) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };
  const stop = () => { if (ff) { try { ff.stdin.end(); } catch {} try { ff.kill('SIGKILL'); } catch {} ff = null; } };
  ws.on('message', (data, isBinary) => {
    if (isBinary) { if (ff && ff.stdin.writable) { try { ff.stdin.write(data); } catch {} } return; }
    let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.type === 'start') {
      stop();
      const dests = (msg.dests || []).filter(d => d && d.url && d.key);
      if (!dests.length) return sj({ type: 'error', error: 'Nenhum destino ligado.' });
      const bv = (msg.bitrate || 4500) + 'k';
      const tee = dests.map(d => '[f=flv:onfail=ignore]' + d.url.replace(/\/+$/, '') + '/' + d.key).join('|');
      const args = ['-fflags', '+genpts', '-i', 'pipe:0',
        '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
        '-g', '60', '-keyint_min', '60', '-b:v', bv, '-maxrate', bv, '-bufsize', (parseInt(bv) * 2) + 'k',
        '-c:a', 'aac', '-ar', '44100', '-b:a', '160k',
        '-f', 'tee', '-map', '0:v:0', '-map', '0:a:0?', tee];
      try {
        ff = spawn(FFMPEG, args);
        let lastErr = '';
        ff.on('error', (e) => { sj({ type: 'error', error: 'ffmpeg não encontrado (' + e.code + ')' }); ff = null; });
        ff.stderr.on('data', (d) => { const s = d.toString(); lastErr = (lastErr + s).slice(-600); process.stdout.write('[ffmpeg] ' + s); });
        ff.on('close', (code) => { sj({ type: 'ended', code, error: code ? lastErr.trim() : '' }); console.log('[ffmpeg] saiu code=' + code); ff = null; });
        sj({ type: 'live', dests: dests.length });
        console.log('[stream] ffmpeg iniciado para ' + dests.length + ' destino(s)');
      } catch (e) { sj({ type: 'error', error: String(e.message || e) }); }
    } else if (msg.type === 'stop') { stop(); sj({ type: 'ended' }); }
  });
  ws.on('close', stop);
});

const MAX_SOURCES = 6;
const rooms = new Map(); // roomId -> { studio: ws|null, sources: Map(sourceId -> ws) }

const getRoom = (id) => {
  if (!rooms.has(id)) rooms.set(id, { studio: null, sources: new Map(), controls: new Set() });
  return rooms.get(id);
};
const send = (ws, obj) => {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
};
const nextFreeSource = (room) => {
  for (let i = 1; i <= MAX_SOURCES; i++) {
    const id = 'cam' + i;
    if (!room.sources.has(id)) return id;
  }
  return null;
};

wss.on('connection', (ws) => {
  ws.role = null;
  ws.room = null;
  ws.source = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    // ---- entrar na sala ----
    if (msg.type === 'join') {
      ws.room = msg.room || 'cam1';
      const room = getRoom(ws.room);

      if (msg.role === 'studio') {
        ws.role = 'studio';
        room.studio = ws;
        // informa as cameras ja conectadas e pede que cada uma (re)oferte
        send(ws, { type: 'sources', list: [...room.sources.keys()] });
        for (const phone of room.sources.values()) send(phone, { type: 'ready' });
        return;
      }

      // role = control (celular controlando a live): trocar câmera, transição, música
      if (msg.role === 'control') {
        ws.role = 'control';
        room.controls.add(ws);
        send(room.studio, { type: 'control-join' }); // pede ao estúdio o estado atual
        return;
      }

      // role = phone (camera): tenta reusar a vaga pedida, senao pega a proxima livre
      const requested = msg.source;
      const id = requested && !room.sources.has(requested) ? requested : nextFreeSource(room);
      if (!id) { send(ws, { type: 'full' }); return; }
      ws.role = 'phone';
      ws.source = id;
      room.sources.set(id, ws);
      send(ws, { type: 'assigned', source: id });
      send(room.studio, { type: 'source-joined', source: id });
      if (room.studio) send(ws, { type: 'ready' });
      return;
    }

    if (!ws.room) return;
    const room = getRoom(ws.room);

    // ---- repasse, sempre identificando a camera (source) ----
    if (ws.role === 'phone') {
      if (msg.type === 'offer') send(room.studio, { type: 'offer', source: ws.source, sdp: msg.sdp });
      else if (msg.type === 'ice') send(room.studio, { type: 'ice', source: ws.source, candidate: msg.candidate });
      else if (msg.type === 'meta') send(room.studio, { type: 'meta', source: ws.source, battery: msg.battery, charging: msg.charging });
    } else if (ws.role === 'studio') {
      if (msg.type === 'state') { for (const c of room.controls) send(c, msg); return; } // estado -> controles
      const phone = room.sources.get(msg.source);
      if (msg.type === 'answer') send(phone, { type: 'answer', sdp: msg.sdp });
      else if (msg.type === 'ice') send(phone, { type: 'ice', candidate: msg.candidate });
    } else if (ws.role === 'control') {
      if (msg.type === 'cmd') send(room.studio, msg); // comando -> estúdio
    }
  });

  ws.on('close', () => {
    if (!ws.room) return;
    const room = getRoom(ws.room);
    if (ws.role === 'studio' && room.studio === ws) {
      room.studio = null;
    } else if (ws.role === 'phone' && ws.source && room.sources.get(ws.source) === ws) {
      room.sources.delete(ws.source);
      send(room.studio, { type: 'source-left', source: ws.source });
    } else if (ws.role === 'control') {
      room.controls.delete(ws);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const line = '-'.repeat(52);
  console.log(`\n${line}`);
  console.log('  Kivo Studio  -  motor de transmissao ao vivo (WebRTC)');
  console.log(line);
  console.log(`  Studio (neste PC):   https://localhost:${PORT}/studio`);
  console.log(`  Studio (pela rede):  https://${lanIp}:${PORT}/studio`);
  console.log(`  Camera (celular):    https://${lanIp}:${PORT}/phone`);
  console.log(line);
  console.log('  Abra o Studio no PC e escaneie o QR pra conectar o celular.');
  console.log('  (Aceite o aviso de seguranca do certificado nos dois lados.)\n');
});

// DEV: HTTP local só pra preview (http://localhost é secure context → sem erro de cert).
http.createServer(app).listen(8080, '127.0.0.1', () => console.log('  Preview (HTTP local): http://localhost:8080/studio'));
