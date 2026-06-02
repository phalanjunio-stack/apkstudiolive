# SeteLagoas Live

Motor proprio de transmissao ao vivo (sem OBS / sem vMix). Em vez de NDI sobre
WiFi (que trava), a camera do celular chega por **WebRTC** — feito justamente
para redes instaveis (buffer de jitter, correcao de erro e bitrate adaptativo).

> **Estado:** Fatia 2 — varias cameras (ate 6) por celular, multiview, e
> switcher PREVIEW/PROGRAM com CUT/TAKE (corte seco). Clique numa fonte pra
> coloca-la no PREVIEW e use TAKE pra mandar pro PROGRAM. Proximas fatias:
> transicao FADE/AUTO, gravacao MP4 + RTMP, mixer de audio, graficos, e o
> APK da camera (build na nuvem via GitHub Actions).

## Arquitetura (visao geral)

```
Celular (navegador, camera)  ──WebRTC─direto─►  PC / Studio (navegador)
        │                                              ▲
        └──────── sinaleiro (WebSocket) ───────────────┘
                  Node so apresenta os dois; o video NAO passa pelo servidor.
```

## Como rodar

```powershell
npm install
npm start
```

O terminal mostra 3 enderecos. No **PC** abra o **Studio**; no **celular**
escaneie o **QR** que aparece no Studio (tem que estar na **mesma rede WiFi**).

- Studio (PC):   `https://localhost:8443/studio`
- Camera (cel):  `https://SEU-IP:8443/phone`

### Importante na 1ª vez

1. **Certificado:** como o HTTPS e self-signed, o navegador mostra um aviso de
   seguranca nos dois lados. Clique em *Avancado → Prosseguir*. (Sem HTTPS o
   celular nao libera a camera.)
2. **Firewall do Windows:** ao iniciar, o Windows pode perguntar se libera o
   Node na rede. **Permita em "Redes privadas"** — senao o celular nao alcanca
   o PC.
3. **Mesma rede, sem isolamento:** use a mesma WiFi (nao rede de visitante).
   Algumas redes tem "isolamento de clientes" que bloqueia PC↔celular.

## Dicas de estabilidade (ja embutidas)

- Reconexao automatica nos dois lados se a rede oscilar.
- A tela do celular fica acordada (wake lock) durante a transmissao.
- O Studio mostra a saude do sinal em tempo real.

## Estrutura

```
src/
  server/
    index.js   servidor HTTPS + signaling WebRTC + QR
    cert.js    gera/reusa o certificado self-signed
  public/
    index.html landing
    studio.html / js/studio.js   monitor (recebe o video + stats)
    phone.html  / js/phone.js     camera (envia o video)
    css/app.css
```

## Config

- Porta: variavel de ambiente `PORT` (padrao `8443`).
- Trocou de rede e o aviso de cert mudou? Apague a pasta `.cert/` e rode de novo.
