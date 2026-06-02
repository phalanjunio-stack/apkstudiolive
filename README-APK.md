# Gerar o APK do app "SeteLagoas Câmera" (sem instalar nada no PC)

O app do celular é empacotado com **Capacitor** e compilado **na nuvem** pelo **GitHub Actions**.
Você não precisa instalar Android Studio nem SDK — só subir o projeto no GitHub.

## Passo a passo

1. **Crie uma conta no GitHub** (grátis) — github.com.
2. **Crie um repositório** novo (pode ser **privado**). Ex.: `setelagoas-live`.
3. **Suba esta pasta** pro repositório. Pelo terminal, dentro da pasta do projeto:
   ```bash
   git init
   git add .
   git commit -m "SeteLagoas Live"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
   git push -u origin main
   ```
   *(Se preferir sem terminal: instale o GitHub Desktop, "Add existing repository", e Publish.)*
4. No GitHub, abra a aba **Actions** → o build **"Build APK Android"** roda sozinho (ou clique **Run workflow**).
5. Quando terminar (uns 3–5 min), clique no run → em **Artifacts** baixe **`SeteLagoas-Camera-APK`**.
6. Descompacte → tem o **`app-debug.apk`**. Passe pro celular (WhatsApp, cabo, Drive) e **instale**
   (o Android vai pedir pra permitir "instalar apps de fontes desconhecidas" — autorize).

## Como usar o app

1. Abra o **SeteLagoas Câmera**.
2. **Escaneie o QR** que aparece no Studio (ou digite o endereço do túnel).
3. Permita **câmera e microfone** → pronto, o celular virou câmera do Studio.

> O app abre o endereço **seguro (HTTPS)** do Studio, então a câmera libera sem aviso de certificado.
> Como o endereço do túnel muda a cada vez, é só **escanear o QR de novo** quando reabrir.

## Atualizar o app depois
Qualquer mudança no código: `git add . && git commit -m "..." && git push` → o GitHub gera um APK novo.

## Build assinado (Play Store) — depois
Este é um **APK de teste (debug)**, ótimo pra instalar direto. Pra publicar na Play Store, depois a gente
gera um **AAB assinado** (precisa de uma chave de assinatura) — me avisa quando chegar essa hora.
