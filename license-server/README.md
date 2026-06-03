# Kivo · Servidor de Licenças (SQL + Painel Admin)

Banco **SQLite** (arquivo `license.db` — você controla e faz backup) + **painel administrativo** + **API de ativação** que o Kivo Studio chama na hora que o cliente coloca a chave.

## Rodar (local)
```bash
cd license-server
npm install         # compila o better-sqlite3 (igual ao sitelocal)
npm start
```
Abre o painel em **http://localhost:4010/**

- **Senha do admin:** padrão `kivo-admin`. Troque em produção:
  - Windows: `set ADMIN_PASS=suaSenhaForte && npm start`

## O que dá pra controlar (painel)
- **Criar chave** (gera `KIVO-XXXX-XXXX-XXXX`), com **plano**, **permissões** (Futebol / Modelos / Transmissão / nº de câmeras), **limite de máquinas** e **validade** (ou vitalícia).
- **Ver clientes, licenças, ativações** e estatísticas.
- **Revogar** chave pirateada (o app trava na próxima checagem).
- **Ver as máquinas** de cada chave (ID/fingerprint, IP, último acesso) e **liberar** uma máquina.

## Banco (tabelas SQL)
- `customers` — cadastros (nome, email, contato).
- `licenses` — chaves (key, plano, features JSON, status, max_devices, expira).
- `activations` — máquinas ativadas (license_id, device_id, ip, last_seen).
- `logs` — registros de ativação/admin.

> É SQLite puro: dá pra abrir o `license.db` em qualquer ferramenta SQL (DB Browser for SQLite) e rodar `SELECT * FROM licenses`.

## API que o app usa
- `POST /api/activate` `{ key, deviceId, deviceName }` → valida e registra a máquina; responde `{ ok, plan, features, name, expires_at }`.
- `POST /api/check` `{ key, deviceId }` → revalida (uso periódico / anti-pirataria).

## Hospedar (pra vender de verdade)
O painel você roda onde quiser. O **servidor precisa ficar online** pro app dos clientes alcançar. Opções fáceis/baratas:
- **Railway** ou **Render** (free/baixo custo) — sobe a pasta `license-server`, SQLite num volume persistente.
- Um **VPS** simples (qualquer um) com Node.

Depois eu ligo o **Kivo Studio** a este servidor (tela de ativação + checagem), usando a URL pública dele.
