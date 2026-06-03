/* ============================================================
   KIVO LICENSE SERVER — SQLite + painel admin + API de ativacao
   - Banco: license.db (arquivo SQLite que VOCE controla/backup)
   - Painel: http://localhost:4010/  (senha em ADMIN_PASS)
   - API publica: /api/activate, /api/check (o app do cliente chama)
   Rodar:  npm install  &&  npm start
   ============================================================ */
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 4010;
const ADMIN_PASS = process.env.ADMIN_PASS || 'kivo-admin'; // TROQUE em producao (variavel de ambiente)
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'license.db');

// ---------- BANCO ----------
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, phone TEXT, notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    plan TEXT DEFAULT 'pro',
    features TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',          -- active | revoked | disabled
    max_devices INTEGER DEFAULT 1,
    expires_at TEXT,                       -- NULL = vitalicia
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    device_name TEXT, ip TEXT,
    activated_at TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now')),
    UNIQUE(license_id, device_id)
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT DEFAULT (datetime('now')),
    kind TEXT, detail TEXT
  );
`);

const log = (kind, detail) => { try { db.prepare('INSERT INTO logs (kind,detail) VALUES (?,?)').run(kind, typeof detail === 'string' ? detail : JSON.stringify(detail)); } catch {} };

// ---------- helpers ----------
function genKey() {
  const grp = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return 'KIVO-' + grp() + '-' + grp() + '-' + grp();
}
const ipOf = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
const expired = lic => lic.expires_at && new Date(lic.expires_at).getTime() < Date.now();

// ---------- app ----------
const app = express();
app.use(express.json({ limit: '256kb' }));

// CORS aberto so para a API publica (o app do cliente roda em outra origem)
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ===================== API PUBLICA (cliente) =====================
// ativa uma chave nesta maquina (deviceId = fingerprint do app)
app.post('/api/activate', (req, res) => {
  const { key, deviceId, deviceName } = req.body || {};
  if (!key || !deviceId) return res.json({ ok: false, error: 'Dados incompletos' });
  const lic = db.prepare('SELECT * FROM licenses WHERE key = ?').get(String(key).trim().toUpperCase());
  if (!lic) { log('activate_fail', { key, reason: 'invalida' }); return res.json({ ok: false, error: 'Chave inválida' }); }
  if (lic.status !== 'active') return res.json({ ok: false, error: 'Chave ' + (lic.status === 'revoked' ? 'revogada' : 'desativada') });
  if (expired(lic)) return res.json({ ok: false, error: 'Chave expirada' });

  const exist = db.prepare('SELECT * FROM activations WHERE license_id=? AND device_id=?').get(lic.id, deviceId);
  if (!exist) {
    const count = db.prepare('SELECT COUNT(*) c FROM activations WHERE license_id=?').get(lic.id).c;
    if (count >= lic.max_devices) { log('activate_fail', { key, reason: 'limite' }); return res.json({ ok: false, error: 'Limite de máquinas atingido (' + lic.max_devices + ')' }); }
    db.prepare('INSERT INTO activations (license_id, device_id, device_name, ip) VALUES (?,?,?,?)').run(lic.id, deviceId, (deviceName || '').slice(0, 80), ipOf(req));
    log('activate_ok', { key, deviceId });
  } else {
    db.prepare("UPDATE activations SET last_seen=datetime('now'), ip=?, device_name=? WHERE id=?").run(ipOf(req), (deviceName || exist.device_name || '').slice(0, 80), exist.id);
  }
  const cust = lic.customer_id ? db.prepare('SELECT name FROM customers WHERE id=?').get(lic.customer_id) : null;
  res.json({ ok: true, plan: lic.plan, features: safeJson(lic.features), name: cust ? cust.name : '', expires_at: lic.expires_at, key: lic.key });
});

// revalida (uso periodico / hibrido): confirma que a chave continua valida nesta maquina
app.post('/api/check', (req, res) => {
  const { key, deviceId } = req.body || {};
  const lic = db.prepare('SELECT * FROM licenses WHERE key=?').get(String(key || '').trim().toUpperCase());
  if (!lic || lic.status !== 'active' || expired(lic)) return res.json({ ok: false, error: 'Licença inválida' });
  const act = db.prepare('SELECT * FROM activations WHERE license_id=? AND device_id=?').get(lic.id, deviceId);
  if (!act) return res.json({ ok: false, error: 'Máquina não ativada' });
  db.prepare("UPDATE activations SET last_seen=datetime('now') WHERE id=?").run(act.id);
  res.json({ ok: true, plan: lic.plan, features: safeJson(lic.features), expires_at: lic.expires_at });
});

// ===================== ADMIN (painel) =====================
const sessions = new Set();
const newToken = () => crypto.randomBytes(24).toString('hex');
function adminAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!t || !sessions.has(t)) return res.status(401).json({ error: 'Não autorizado' });
  next();
}
app.post('/api/admin/login', (req, res) => {
  if ((req.body && req.body.password) !== ADMIN_PASS) { log('admin_login_fail', ipOf(req)); return res.status(401).json({ error: 'Senha incorreta' }); }
  const t = newToken(); sessions.add(t); res.json({ token: t });
});
app.post('/api/admin/logout', adminAuth, (req, res) => { sessions.delete((req.headers.authorization || '').replace(/^Bearer\s+/i, '')); res.json({ ok: true }); });

// visao geral: clientes + licencas (com cliente e nº de maquinas) + stats
app.get('/api/admin/overview', adminAuth, (req, res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
  const licenses = db.prepare(`
    SELECT l.*, c.name AS customer_name, c.email AS customer_email,
      (SELECT COUNT(*) FROM activations a WHERE a.license_id=l.id) AS devices
    FROM licenses l LEFT JOIN customers c ON c.id=l.customer_id ORDER BY l.id DESC`).all();
  const stats = {
    customers: customers.length,
    licenses: licenses.length,
    active: db.prepare("SELECT COUNT(*) c FROM licenses WHERE status='active'").get().c,
    devices: db.prepare('SELECT COUNT(*) c FROM activations').get().c,
  };
  res.json({ customers, licenses, stats });
});
app.get('/api/admin/license/:id/activations', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM activations WHERE license_id=? ORDER BY id DESC').all(+req.params.id));
});

// cria/edita cliente
app.post('/api/admin/customer', adminAuth, (req, res) => {
  const { id, name, email, phone, notes } = req.body || {};
  if (id) { db.prepare('UPDATE customers SET name=?, email=?, phone=?, notes=? WHERE id=?').run(name || '', email || '', phone || '', notes || '', id); return res.json({ ok: true, id }); }
  const r = db.prepare('INSERT INTO customers (name,email,phone,notes) VALUES (?,?,?,?)').run(name || '', email || '', phone || '', notes || '');
  res.json({ ok: true, id: r.lastInsertRowid });
});
app.delete('/api/admin/customer/:id', adminAuth, (req, res) => { db.prepare('UPDATE licenses SET customer_id=NULL WHERE customer_id=?').run(+req.params.id); db.prepare('DELETE FROM customers WHERE id=?').run(+req.params.id); res.json({ ok: true }); });

// cria licenca (gera a chave)
app.post('/api/admin/license', adminAuth, (req, res) => {
  let { customer_id, plan, features, max_devices, expires_at, key } = req.body || {};
  key = (key && String(key).trim().toUpperCase()) || genKey();
  if (db.prepare('SELECT 1 FROM licenses WHERE key=?').get(key)) return res.status(400).json({ error: 'Chave já existe' });
  const feat = typeof features === 'string' ? features : JSON.stringify(features || {});
  const r = db.prepare('INSERT INTO licenses (key, customer_id, plan, features, max_devices, expires_at) VALUES (?,?,?,?,?,?)')
    .run(key, customer_id || null, plan || 'pro', feat, max_devices || 1, expires_at || null);
  log('license_create', { key, plan });
  res.json({ ok: true, id: r.lastInsertRowid, key });
});
app.post('/api/admin/license/:id', adminAuth, (req, res) => {
  const { plan, features, max_devices, expires_at, customer_id, status } = req.body || {};
  const sets = [], vals = [];
  if (plan !== undefined) { sets.push('plan=?'); vals.push(plan); }
  if (features !== undefined) { sets.push('features=?'); vals.push(typeof features === 'string' ? features : JSON.stringify(features)); }
  if (max_devices !== undefined) { sets.push('max_devices=?'); vals.push(max_devices); }
  if (expires_at !== undefined) { sets.push('expires_at=?'); vals.push(expires_at || null); }
  if (customer_id !== undefined) { sets.push('customer_id=?'); vals.push(customer_id || null); }
  if (status !== undefined) { sets.push('status=?'); vals.push(status); }
  if (sets.length) { vals.push(+req.params.id); db.prepare('UPDATE licenses SET ' + sets.join(', ') + ' WHERE id=?').run(...vals); }
  res.json({ ok: true });
});
app.post('/api/admin/license/:id/revoke', adminAuth, (req, res) => { db.prepare("UPDATE licenses SET status='revoked' WHERE id=?").run(+req.params.id); log('license_revoke', req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/license/:id', adminAuth, (req, res) => { db.prepare('DELETE FROM activations WHERE license_id=?').run(+req.params.id); db.prepare('DELETE FROM licenses WHERE id=?').run(+req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/activation/:id', adminAuth, (req, res) => { db.prepare('DELETE FROM activations WHERE id=?').run(+req.params.id); res.json({ ok: true }); }); // libera uma maquina

function safeJson(s) { try { return JSON.parse(s || '{}'); } catch { return {}; } }

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log('\n================ KIVO LICENSE SERVER ================');
  console.log('  Painel admin:  http://localhost:' + PORT + '/');
  console.log('  Senha admin :  ' + (process.env.ADMIN_PASS ? '(via ADMIN_PASS)' : ADMIN_PASS + '  (troque em producao!)'));
  console.log('  Banco       :  ' + DB_FILE);
  console.log('  API cliente :  POST /api/activate  ·  POST /api/check');
  console.log('=====================================================\n');
});
