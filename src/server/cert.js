// Gera (ou reusa) um certificado HTTPS self-signed.
// HTTPS e obrigatorio: o navegador do celular so libera a camera (getUserMedia)
// em "secure context" (https). Em LAN nao temos um certificado valido, entao
// criamos um proprio e o celular aceita o aviso uma vez.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERT_DIR = path.join(__dirname, '..', '..', '.cert');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');

export function loadOrCreateCert(lanIp = '127.0.0.1') {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CERT_PATH) };
  }

  const altNames = [
    { type: 2, value: 'localhost' }, // type 2 = DNS
    { type: 7, ip: '127.0.0.1' },    // type 7 = IP
  ];
  if (lanIp && lanIp !== '127.0.0.1') altNames.push({ type: 7, ip: lanIp });

  const pems = selfsigned.generate([{ name: 'commonName', value: lanIp }], {
    days: 3650,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'subjectAltName', altNames },
    ],
  });

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, pems.private);
  fs.writeFileSync(CERT_PATH, pems.cert);
  return { key: pems.private, cert: pems.cert };
}
