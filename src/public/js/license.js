/* ============================================
   LICENÇA — trava de ativação do Kivo Studio.
   Gera um ID da máquina (fingerprint), valida a chave
   no servidor de licenças (via ponte /api/lic no próprio
   servidor do Studio), guarda em cache e re-checa com
   tolerância offline. Bloqueia sem licença válida.
   ============================================ */
const KivoLicense = (function () {
  const DKEY = 'kivo-device-id', LKEY = 'kivo-license';
  const GRACE = 7 * 864e5; // 7 dias offline com cache válido

  function deviceId() {
    let id = localStorage.getItem(DKEY);
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2))); localStorage.setItem(DKEY, id); }
    return id;
  }
  const cache = () => { try { return JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch { return null; } };
  const setCache = c => localStorage.setItem(LKEY, JSON.stringify(c));
  const devName = () => ((navigator.platform || 'PC') + ' · ' + (navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/) || ['App'])[0]);

  async function post(path, body) {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    try { const r = await fetch('/api/lic' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }); return await r.json(); }
    finally { clearTimeout(to); }
  }
  async function activate(key) {
    key = (key || '').trim().toUpperCase();
    const j = await post('/activate', { key, deviceId: deviceId(), deviceName: devName() });
    if (j && j.ok) setCache({ key, plan: j.plan, features: j.features, name: j.name, expires_at: j.expires_at, ts: Date.now(), ok: true });
    return j || { ok: false, error: 'Sem resposta' };
  }
  async function check() {
    const c = cache(); if (!c || !c.key) return { ok: false, need: true };
    try {
      const j = await post('/check', { key: c.key, deviceId: deviceId() });
      if (j && j.ok) { setCache(Object.assign({}, c, { plan: j.plan, features: j.features, expires_at: j.expires_at, ts: Date.now(), ok: true })); return { ok: true }; }
      setCache(Object.assign({}, c, { ok: false })); return { ok: false, revoked: true, error: (j && j.error) || 'Licença inválida' };
    } catch (e) {
      if (c.ok && (Date.now() - c.ts) < GRACE) return { ok: true, offline: true };
      return { ok: false, offline: true, error: 'Servidor de licença indisponível' };
    }
  }
  const features = () => { const c = cache(); return (c && c.ok) ? (c.features || {}) : {}; };
  const info = () => cache();
  const signOut = () => localStorage.removeItem(LKEY);
  return { activate, check, features, info, deviceId, signOut };
})();
window.KivoLicense = KivoLicense;

// ---------- TELA DE ATIVAÇÃO (gate) ----------
(function () {
  // Licença DESLIGADA por enquanto (venda/licenciamento ficou pra depois).
  // Pra religar a trava no futuro, troque para: const LICENSE_ON = true;
  const LICENSE_ON = false;

  const css = `
  #kivoGate{position:fixed;inset:0;z-index:90000;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(130% 100% at 50% 8%,#13294a,#070b14 62%);font-family:Plus Jakarta Sans,Inter,"Segoe UI",system-ui,Arial,sans-serif;opacity:0;transition:opacity .35s ease}
  #kivoGate.kg-show{opacity:1}#kivoGate.kg-hide{opacity:0;pointer-events:none}
  #kivoGate .kg-card{width:min(390px,90vw);text-align:center}
  #kivoGate .kg-logo{width:66px;height:66px;object-fit:contain;filter:drop-shadow(0 8px 26px rgba(31,139,255,.5))}
  #kivoGate .kg-name{margin-top:12px;font-size:25px;font-weight:800;color:#eaf1ff}#kivoGate .kg-name span{color:#36d1ff;font-weight:500;margin-left:6px}
  #kivoGate .kg-body{margin-top:22px}
  #kivoGate .kg-t{font-size:16px;font-weight:700;color:#dbe6ff}
  #kivoGate .kg-sub{font-size:12.5px;color:#8fa3c8;margin-top:6px;line-height:1.5}
  #kivoGate input{width:100%;margin-top:14px;padding:12px 13px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(120,165,255,.25);color:#eaf1ff;font-size:15px;text-align:center;letter-spacing:1px}
  #kivoGate input:focus{border-color:#2b8bff;outline:none}
  #kivoGate button{width:100%;margin-top:12px;padding:13px;border-radius:11px;border:0;background:linear-gradient(180deg,#2a97ff,#0a66d8);color:#fff;font-weight:800;font-size:14px;cursor:pointer}
  #kivoGate button:disabled{opacity:.6}#kivoGate button:not(:disabled):hover{filter:brightness(1.07)}
  #kivoGate .kg-err{color:#ff8a8a;font-size:12.5px;margin-top:10px;min-height:16px}
  #kivoGate .kg-foot{margin-top:16px;font-size:11px;color:#6f82a8}
  #kivoGate .kg-spin{width:34px;height:34px;border:3px solid rgba(255,255,255,.15);border-top-color:#36d1ff;border-radius:50%;margin:6px auto;animation:kg-spin 1s linear infinite}
  @keyframes kg-spin{to{transform:rotate(360deg)}}`;
  const st = document.createElement('style'); st.textContent = css + `
  #kivoGate{padding:22px;background:
    radial-gradient(720px 420px at 50% -12%,rgba(47,140,255,.20),transparent 68%),
    radial-gradient(540px 340px at 8% 110%,rgba(53,212,154,.09),transparent 68%),
    rgba(3,6,12,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
  #kivoGate .kg-card{width:min(420px,100%);padding:34px 32px 26px;border:1px solid rgba(178,198,230,.18);
    border-radius:18px;background:linear-gradient(180deg,rgba(16,23,34,.94),rgba(8,13,20,.92));
    box-shadow:0 34px 90px -32px rgba(0,0,0,.92),0 1px 0 rgba(255,255,255,.06) inset}
  #kivoGate .kg-logo{width:70px;height:70px;filter:drop-shadow(0 10px 28px rgba(47,140,255,.48))}
  #kivoGate,#kivoGate *{box-sizing:border-box}
  #kivoGate .kg-name{font-size:27px;letter-spacing:-.01em}
  #kivoGate .kg-body{margin-top:24px}
  #kivoGate .kg-sub{max-width:320px;margin:7px auto 0}
  #kivoGate input{height:50px;border-radius:11px;background:rgba(255,255,255,.045);
    border-color:rgba(120,165,255,.34);box-shadow:0 1px 0 rgba(255,255,255,.035) inset}
  #kivoGate input:focus{box-shadow:0 0 0 3px rgba(47,140,255,.14),0 1px 0 rgba(255,255,255,.045) inset}
  #kivoGate button{height:50px;border-radius:11px;background:linear-gradient(180deg,#37a0ff,#0964d8);
    box-shadow:0 14px 30px -16px rgba(47,140,255,.9),0 1px 0 rgba(255,255,255,.25) inset}
  #kivoGate .kg-foot{padding-top:4px}
  @media(max-width:480px){
    #kivoGate{padding:14px;overflow:hidden}
    #kivoGate .kg-card{width:326px !important;max-width:calc(100vw - 40px) !important;
      padding:28px 18px 22px;border-radius:14px}
    #kivoGate .kg-logo{width:58px;height:58px}
    #kivoGate .kg-name{font-size:24px}
    #kivoGate .kg-t{font-size:15px}
    #kivoGate .kg-sub{font-size:12px}
    #kivoGate input,#kivoGate button{max-width:100%}
    #kivoGate input{font-size:13px;letter-spacing:.08em}
  }`; document.head.appendChild(st);

  function done() { const ov = document.getElementById('kivoGate'); if (ov) { ov.classList.add('kg-hide'); setTimeout(() => ov.remove(), 420); } }
  function form(b, msg, blocked) {
    b.innerHTML =
      '<div class="kg-t">' + (blocked ? 'Licença inválida' : 'Ative seu Kivo Studio') + '</div>' +
      '<div class="kg-sub">' + (msg || 'Digite a chave de acesso que você recebeu na compra.') + '</div>' +
      '<input id="kgKey" placeholder="KIVO-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false">' +
      '<button id="kgGo">Ativar</button>' +
      '<div class="kg-err" id="kgErr"></div>' +
      '<div class="kg-foot">Esta máquina: <span style="color:#9fb4d8">' + KivoLicense.deviceId().slice(0, 10) + '…</span></div>';
    const key = b.querySelector('#kgKey'), go = b.querySelector('#kgGo'), err = b.querySelector('#kgErr');
    async function go2() {
      err.textContent = 'Ativando…'; go.disabled = true;
      try { const j = await KivoLicense.activate(key.value); if (j.ok) return done(); err.textContent = j.error || 'Falha na ativação'; }
      catch (e) { err.textContent = 'Servidor indisponível'; }
      go.disabled = false;
    }
    go.onclick = go2; key.addEventListener('keydown', e => { if (e.key === 'Enter') go2(); }); setTimeout(() => key.focus(), 50);
  }
  async function run() {
    if (!LICENSE_ON) return; // trava desligada — Studio abre direto
    const ov = document.createElement('div'); ov.id = 'kivoGate';
    ov.innerHTML = '<div class="kg-card"><img class="kg-logo" src="/img/kivo-icon.png" alt=""><div class="kg-name">Kivo<span>Studio</span></div><div class="kg-body" id="kgBody"></div></div>';
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('kg-show'));
    const b = ov.querySelector('#kgBody');
    b.innerHTML = '<div class="kg-spin"></div><div class="kg-sub">Verificando licença…</div>';
    let res; try { res = await KivoLicense.check(); } catch { res = { ok: false, need: true }; }
    if (res.ok) return done();
    form(b, res.revoked ? (res.error || 'Sua licença foi revogada.') : (res.need ? '' : (res.error || '')), res.revoked);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
