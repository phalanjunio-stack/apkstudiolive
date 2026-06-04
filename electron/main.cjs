// Kivo Studio — empacotador Electron.
// Sobe o servidor (src/server/index.js) usando o Node embutido do Electron,
// mostra um SPLASH 800x600 e, quando o servidor responde, abre a janela principal.
// O editor "Montar Cena" (window.open) vira uma JANELA nativa — arrastável pro 2o monitor.
const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

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
    width: 800, height: 600, frame: false, resizable: false, center: true,
    backgroundColor: '#03070d', show: false, skipTaskbar: false,
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.once('ready-to-show', () => splash.show());
}

function createMain() {
  mainWin = new BrowserWindow({
    width: 1440, height: 900, show: false, backgroundColor: '#03070d',
    title: 'Kivo Studio', autoHideMenuBar: true,
  });
  mainWin.maximize();
  mainWin.loadURL(STUDIO_URL);
  mainWin.webContents.once('did-finish-load', () => {
    mainWin.show();
    if (splash && !splash.isDestroyed()) splash.close();
    splash = null;
  });
  // window.open (editor Montar Cena, etc.) → janela nativa que dá pra arrastar pro 2o monitor
  mainWin.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: { width: 1320, height: 860, backgroundColor: '#03070d', autoHideMenuBar: true, title: 'Kivo Studio' },
  }));
}

app.whenReady().then(() => {
  createSplash();
  startServer();
  waitForPort(PORT, () => setTimeout(createMain, 400));
});

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0 && mainWin === null) createMain(); });
function killServer() { try { if (serverProc) serverProc.kill(); } catch (e) {} serverProc = null; }
app.on('before-quit', killServer);
app.on('window-all-closed', () => { killServer(); app.quit(); });
