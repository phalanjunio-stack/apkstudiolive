// Launcher do APK: escaneia o QR do Studio (ou digita o endereço) e abre a câmera.
const $ = (id) => document.getElementById(id);
const setStatus = (m) => { $('status').textContent = m || ''; };

function gotoStudio(host, room) {
  host = String(host || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!host) return setStatus('Digite o endereço do Studio.');
  localStorage.setItem('sl-last-host', host);
  setStatus('Conectando…');
  location.href = 'https://' + host + '/phone?room=' + encodeURIComponent(room || 'cam1');
}
function parseQR(text) {
  try { const u = new URL(text); return { host: u.host, room: u.searchParams.get('room') || 'cam1' }; }
  catch { return null; }
}

let scanning = false, stream = null, raf = 0;
async function startScan() {
  if (scanning) return;
  if (!('BarcodeDetector' in window)) { setStatus('Sem leitor de QR nativo — digite o endereço abaixo.'); return; }
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
  catch (e) { setStatus('Não liberou a câmera (' + (e.name || '') + '): ' + e.message); return; }
  const v = $('scanvid'); v.srcObject = stream; $('scanbox').classList.add('on');
  $('scanBtn').textContent = 'Aponte pro QR do Studio…';
  scanning = true;
  const det = new BarcodeDetector({ formats: ['qr_code'] });
  const loop = async () => {
    if (!scanning) return;
    try { const codes = await det.detect(v); if (codes && codes.length) { const p = parseQR(codes[0].rawValue); if (p) { stopScan(); return gotoStudio(p.host, p.room); } } } catch {}
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
function stopScan() { scanning = false; if (raf) cancelAnimationFrame(raf); stream && stream.getTracks().forEach((t) => t.stop()); $('scanbox').classList.remove('on'); }

$('scanBtn').onclick = startScan;
$('goBtn').onclick = () => gotoStudio($('hostInput').value, 'cam1');
$('hostInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') gotoStudio($('hostInput').value, 'cam1'); });
const last = localStorage.getItem('sl-last-host'); if (last) $('hostInput').value = last;
