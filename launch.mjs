// Launcher: abre o túnel HTTPS (cloudflared) + o servidor apontando o QR pra ele.
// Assim o celular conecta SEM aviso de certificado e a câmera abre direto.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8443);

console.log('\n  Abrindo túnel seguro (cloudflared)...');
const cf = spawn('cloudflared', ['tunnel', '--url', `https://localhost:${PORT}`, '--no-tls-verify'], { shell: true });

let url = null, server = null;
function scan(d) {
  const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !url) { url = m[0]; start(url); }
}
cf.stdout.on('data', scan);
cf.stderr.on('data', scan);

function start(pub) {
  const line = '='.repeat(54);
  console.log(`\n${line}`);
  console.log('  SeteLagoas Live — pronto!');
  console.log(line);
  console.log('  Studio (no PC):     https://localhost:' + PORT + '/studio');
  console.log('  Câmera (celular):   ' + pub + '/phone');
  console.log('  (escaneie o QR do Studio — abre sem aviso, câmera direto)');
  console.log(`${line}\n`);
  server = spawn(process.execPath, [path.join(__dirname, 'src', 'server', 'index.js')], {
    stdio: 'inherit', env: { ...process.env, PUBLIC_URL: pub },
  });
}

function bye() { try { cf.kill(); } catch {} try { server && server.kill(); } catch {} process.exit(0); }
process.on('SIGINT', bye);
process.on('SIGTERM', bye);
setTimeout(() => { if (!url) console.log('  (túnel demorando... verifique a internet)'); }, 15000);
