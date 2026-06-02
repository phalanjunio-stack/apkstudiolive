# SeteLagoas Live — Checklist para entregar 100%

Legenda: ✅ pronto · 🟡 parcial · ⬜ a fazer

---

> **Cenário do usuário:** 1–3 celulares + 1–2 câmeras USB · destinos YouTube + Instagram (depois) · áudio: mic USB, mesa/interface, áudio do PC · quer **TODO tipo de entrada de vídeo/áudio** (mesmo sem usar na hora, dá pra adicionar) + **música de fundo** (playlist, áudio-only, não aparece na tela).

## 1. Núcleo de vídeo / Fontes
- ✅ Celular como câmera por WebRTC (sem app, via QR) — estável
- ✅ Várias câmeras + reconexão automática · Multiview · cards de FONTES
- ✅ Switcher PREVIEW/PROGRAM com **CUT/TAKE** (corte seco)
- ✅ **Formato da live**: 16:9, 9:16 (Stories/Reels), 1:1, 4:5
- ✅ **Adicionar qualquer fonte de vídeo**: câmera USB/webcam, **tela do PC/janela**, **vídeo (MP4)**, **imagem** — entram como fonte selecionável
- 🟡 Enquadramento no formato (hoje *crop* central) → ⬜ reframe/zoom/posição por fonte
- ✅ Transição **FADE / AUTO** (crossfade 0,6s) + **FTB** (fade to black) · ⬜ stinger + cena de espera
- ⬜ Slides/PDF como fonte · placa de captura (aparece como câmera USB ✅)
- ✅ **Grid inteligente**: cada fonte segue seu formato real (16:9 / 9:16 / 1:1)
- ⬜ Compositing real em canvas (gerar o PROGRAM como 1 vídeo único)

## 1b. Gráficos / overlays (sobre o PROGRAM)
- ✅ **Logo / imagem** posicionável (arrasta no PROGRAM) + ajuste de tamanho
- ✅ **Propaganda** (mesma ferramenta de imagem; mostra/oculta/remove)
- ✅ **Placar de futebol**: nomes, placar +/− e **cronômetro** (iniciar/pausar/zerar)
- ✅ **Rodapé animado** (ticker) com texto e velocidade
- ✅ Painel flutuante de Gráficos (edita com o PROGRAM visível) + persiste no navegador
- ⬜ Overlays entram no **stream/gravação** quando a saída/compositing existir
- ⬜ Replay (depois) · temas/cores do placar · cronômetro regressivo · logo em slide/carrossel

## 2. Áudio
- ✅ **Seleção de fonte de áudio**: microfone / linha / **interface/mesa** / **áudio do computador** (picker + medidor)
- ✅ **Música de fundo (playlist)** — áudio-only; entra no mixer como canal (+ Música)
- ⬜ Áudio das câmeras (hoje o celular envia só vídeo) → ligar a faixa
- ✅ **Mixer real**: faders, **M/S (mute/solo)**, **fone/PFL** (monitorar só no fone), VU por canal + MASTER · **+ Mic / + Áudio PC / + Música**
- ⬜ Roteamento do áudio escolhido pro PROGRAM/gravação/stream
- ⬜ Ganho, redução de ruído, ducking (abaixar a música quando fala), sync A/V

## 3. Saída (gravar e transmitir)
- ⬜ **Gravar MP4** local (sempre, como segurança)
- ⬜ **GO LIVE — RTMP** pra YouTube / Facebook / Instagram (via MediaMTX)
- ⬜ Campo de **chave de transmissão (stream key)** por destino
- ⬜ Controle de **bitrate / resolução / FPS** de saída
- ⬜ Multi-destino (transmitir pra vários ao mesmo tempo)
- ⬜ **SAFE MODE**: failover automático se uma câmera cair

## 4. Menus / páginas
- ✅ Navegação entre menus (router) + estado ativo
- ✅ **Configurações** (tema, som, formato, fonte de áudio)
- 🟡 **Dispositivos** (lista + QR) · **Áudio** (picker)
- ⬜ Produção (rundown/roteiro) · Fontes · Gráficos · Transições · Multiview (tela cheia) · Gravações · Stream — *hoje navegam, conteúdo em construção*

## 5. UI / UX
- ✅ Dashboard no estilo do mockup (premium)
- ✅ Tema claro / escuro / automático
- ✅ Smoke-glow + ripple + sons de UI + animações suaves
- ✅ Coluna direita refinada (premium/compacta)
- ✅ Botão "Conectar celular" no topo (modal QR)
- ⬜ Logo real da marca (me enviar PNG/SVG)
- ⬜ CPU/GPU reais no topo (helper no servidor — CPU fácil; GPU precisa de agente nativo)

## 6. App do celular (APK)
- ⬜ APK via Capacitor (reaproveita a câmera web) — build na nuvem (GitHub Actions)
- ⬜ Tally "NO AR", trava de foco/exposição, lanterna, conectar por QR

## 7. Robustez / infra
- ⬜ Rodar como app (Electron) com 1 clique, sem terminal
- ⬜ Iniciar com o Windows / atalho na área de trabalho
- ⬜ Tratamento de erros + logs + reconexão de tudo
- ⬜ Funcionar sem internet (LAN) e com internet (stream)

---

## O que eu preciso de você (pra cravar)
1. **Specs do PC** (CPU / GPU / RAM) — define resolução/FPS e quantas câmeras.
2. **Logo** da marca (PNG ou SVG) pra colocar o real.
3. **Destinos de stream** que usa (YouTube? Instagram? Facebook?) e se já tem as chaves RTMP.
4. **Áudio**: qual entrada usa hoje (mic USB? mesa/interface? áudio do PC?).
5. Prioridade da próxima fatia: **Áudio das câmeras+mixer**, **Gravar+GO LIVE**, ou **APK**.

> Atualizo este arquivo conforme a gente fecha cada item.
