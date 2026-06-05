// Kivo Studio — empacotador Electron.
// Sobe o servidor (src/server/index.js) usando o Node embutido do Electron,
// mostra um SPLASH 3:2 e, quando o servidor responde, abre a janela principal.
// O editor "Montar Cena" (window.open) vira uma JANELA nativa — arrastável pro 2o monitor.
const { app, BrowserWindow, ipcMain, screen, session, desktopCapturer } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

// O servidor é HTTPS com cert self-signed (necessário pros celulares). Como é o NOSSO
// servidor local, ignoramos o erro de autoridade do cert (mata o spam "handshake failed -202"
// e deixa o WebSocket/sinalização conectar). Vale só dentro do app desktop.
app.commandLine.appendSwitch('ignore-certificate-errors');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'src', 'server', 'index.js');
const PORT = Number(process.env.PORT || 8443);
const STUDIO_URL = `https://localhost:${PORT}/studio.html`;

let serverProc = null, splash = null, mainWin = null;

// cert self-signed do localhost (o servidor é HTTPS) — liberamos só o localhost
app.on('certificate-error', (e, wc, url, err, cert, cb) => {
  if (/^https:\/\/(localhost|127\.0\.0\.1)/.test(url)) { e.preventDefault(); cb(true); }
  else cb(false);
});

// Janela SEM moldura (frame:false): o Windows 11 arredonda os cantos sozinho e mantém a
// sombra. Os controles minimizar/maximizar/fechar vêm da própria UI (preload → kivoWin).
ipcMain.on('win-min', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.minimize(); });
ipcMain.on('win-max', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) (w.isMaximized() ? w.unmaximize() : w.maximize()); });
ipcMain.on('win-close', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.close(); });

// avisa o renderer quando (des)maximiza → ele alterna body.win-max (deixa os cantos retos)
app.on('browser-window-created', (e, win) => {
  const send = () => { try { win.webContents.send('win-max-state', win.isMaximized()); } catch (err) {} };
  win.on('maximize', send); win.on('unmaximize', send);
  win.on('enter-full-screen', send); win.on('leave-full-screen', send);
});

// ===== Multi-monitor: listar telas + enviar a janela pra uma tela escolhida =====
ipcMain.handle('win-displays', () => {
  try {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id, primary: d.id === primary.id,
      label: (d.label && d.label.trim()) ? d.label : ('Monitor ' + (i + 1)),
      w: d.size.width, h: d.size.height,
    }));
  } catch (e) { return []; }
});
ipcMain.on('win-to-display', (e, dispId) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  const d = screen.getAllDisplays().find(x => x.id === dispId) || screen.getPrimaryDisplay();
  const wa = d.workArea;
  try { if (w.isMaximized()) w.unmaximize(); } catch (err) {}
  w.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height }); w.focus();
});

function startServer() {
  serverProc = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(PORT) },
    stdio: 'inherit',
  });
  serverProc.on('error', (err) => console.error('[kivo] servidor falhou:', err));
}

function waitForPort(port, done, tries = 0) {
  const sock = net.connect(port, '127.0.0.1');
  sock.once('connect', () => { sock.destroy(); done(); });
  sock.once('error', () => { sock.destroy(); if (tries > 120) done(); else setTimeout(() => waitForPort(port, done, tries + 1), 150); });
}

function createSplash() {
  splash = new BrowserWindow({
    width: 720, height: 480, frame: false, resizable: false, center: true,
    backgroundColor: '#03070d', show: false, skipTaskbar: false,
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.once('ready-to-show', () => splash.show());
}

function createMain() {
  // abre GRANDE mas NÃO maximizado, pra mostrar os cantos arredondados (Win11)
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1600, Math.round(wa.width * 0.92));
  const height = Math.min(960, Math.round(wa.height * 0.92));
  mainWin = new BrowserWindow({
    width, height, minWidth: 1024, minHeight: 640, center: true, show: false,
    frame: false, backgroundColor: '#03070d', title: 'Kivo Studio', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  mainWin.loadURL(STUDIO_URL);
  mainWin.webContents.once('did-finish-load', () => {
    mainWin.show();
    if (splash && !splash.isDestroyed()) splash.close();
    splash = null;
  });
  // window.open (editor Montar Cena, etc.) → janela nativa FRAMELESS, arrastável pro 2o monitor
  mainWin.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: 1320, height: 860, minWidth: 900, minHeight: 560,
      frame: false, backgroundColor: '#03070d', autoHideMenuBar: true, title: 'Kivo Studio',
      webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
    },
  }));
}

app.whenReady().then(() => {
  // CAPTURA DE TELA: o Electron precisa de um handler pro getDisplayMedia (senão "Not supported").
  // Usa o seletor NATIVO do Windows quando dá; senão cai pro desktopCapturer (1ª tela) como reserva.
  try {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] })
        .then((sources) => callback(sources && sources.length ? { video: sources[0], audio: 'loopback' } : null))
        .catch(() => { try { callback(null); } catch (e) {} });
    }, { useSystemPicker: true });
  } catch (e) { console.error('[kivo] display media handler falhou:', e); }
  createSplash();
  startServer();
  waitForPort(PORT, () => setTimeout(createMain, 400));
  // monitor (des)conectado: traz janelas "perdidas" de volta pro principal (NUNCA somem) + avisa o renderer
  const onDisplays = () => {
    try {
      const displays = screen.getAllDisplays();
      for (const w of BrowserWindow.getAllWindows()) {
        const b = w.getBounds();
        const vis = displays.some(d => { const a = d.bounds; return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y; });
        if (!vis) { const p = screen.getPrimaryDisplay().workArea; w.setBounds({ x: p.x + 40, y: p.y + 40, width: Math.min(b.width, p.width - 80), height: Math.min(b.height, p.height - 80) }); }
        try { w.webContents.send('displays-changed'); } catch (e) {}
      }
    } catch (e) {}
  };
  screen.on('display-removed', onDisplays);
  screen.on('display-added', onDisplays);
});

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0 && mainWin === null) createMain(); });
function killServer() { try { if (serverProc) serverProc.kill(); } catch (e) {} serverProc = null; }
app.on('before-quit', killServer);
app.on('window-all-closed', () => { killServer(); app.quit(); });
