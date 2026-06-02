// SeteLagoas Live — servidor da Fatia 1.
// Faz tres coisas: (1) serve as paginas (studio/celular), (2) gera o QR de conexao,
// (3) e o "sinaleiro" (signaling) WebRTC que apresenta o celular ao estudio.
// O video em si NAO passa por aqui: ele vai direto celular -> PC (peer-to-peer),
// que e o que deixa tudo leve e estavel.
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
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

app.get('/api/info', (req, res) => {
  // Se houver túnel (PUBLIC_URL), o QR aponta pra ele (HTTPS confiável -> câmera abre sem aviso)
  const pub = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/+$/, '') : null;
  const base = pub || `https://${lanIp}:${PORT}`;
  res.json({ lanIp, port: PORT, public: pub, studioUrl: base + '/studio', phoneUrl: base + '/phone' });
});

app.get('/qr', async (req, res) => {
  const text = String(req.query.text ?? '');
  if (!text) return res.status(400).send('missing text');
  const svg = await qrcode.toString(text, { type: 'svg', margin: 1, width: 240 });
  res.type('image/svg+xml').send(svg);
});

app.get('/studio', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'studio.html')));
app.get('/phone', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'phone.html')));
app.use(express.static(PUBLIC_DIR));

const server = https.createServer({ key, cert }, app);

// ---------------------------------------------------------------------------
// Signaling WebRTC. Cada "sala" tem 1 estudio + ate MAX_SOURCES cameras (celulares).
// Cada camera ganha um id (cam1, cam2, ...). O estudio mantem uma conexao
// separada por camera. Toda mensagem de offer/answer/ice carrega o "source"
// pra sabermos de qual camera estamos falando. O video nunca passa pelo servidor.
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });
const MAX_SOURCES = 6;
const rooms = new Map(); // roomId -> { studio: ws|null, sources: Map(sourceId -> ws) }

const getRoom = (id) => {
  if (!rooms.has(id)) rooms.set(id, { studio: null, sources: new Map() });
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
      const phone = room.sources.get(msg.source);
      if (msg.type === 'answer') send(phone, { type: 'answer', sdp: msg.sdp });
      else if (msg.type === 'ice') send(phone, { type: 'ice', candidate: msg.candidate });
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
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const line = '-'.repeat(52);
  console.log(`\n${line}`);
  console.log('  SeteLagoas Live  -  Fatia 1 (camera por WebRTC)');
  console.log(line);
  console.log(`  Studio (neste PC):   https://localhost:${PORT}/studio`);
  console.log(`  Studio (pela rede):  https://${lanIp}:${PORT}/studio`);
  console.log(`  Camera (celular):    https://${lanIp}:${PORT}/phone`);
  console.log(line);
  console.log('  Abra o Studio no PC e escaneie o QR pra conectar o celular.');
  console.log('  (Aceite o aviso de seguranca do certificado nos dois lados.)\n');
});
