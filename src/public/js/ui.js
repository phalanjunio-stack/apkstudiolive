/* ============================================
   UI — router dos menus + formato da live + Configuracoes (tema/som/audio)
   ============================================ */
(function () {
  const dash = document.querySelector('.dash');
  const mainEl = document.querySelector('.main');
  const pageEl = document.getElementById('viewPage');
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  let pageCleanup = null;

  // ---------------- FORMATO DA LIVE ----------------
  const FMT_HINT = {
    '16:9': 'Horizontal — YouTube, Facebook (padrao)',
    '9:16': 'Vertical — Stories / Reels / TikTok',
    '1:1': 'Quadrado — Feed do Instagram',
    '4:5': 'Retrato — Feed alto do Instagram',
  };
  function applyFormat(fmt, ratio) {
    const fc = document.getElementById('fmtCustom');
    if (fmt === 'custom') {
      ratio = ratio || localStorage.getItem('sl-format-custom') || '9/16';
      dash.dataset.format = 'custom'; dash.style.setProperty('--fmt', ratio);
      localStorage.setItem('sl-format', 'custom'); localStorage.setItem('sl-format-custom', ratio);
      document.querySelectorAll('#fmtSeg button').forEach(b => b.classList.toggle('active', b.dataset.fmt === 'custom'));
      const h = document.getElementById('fmtHint'); if (h) h.textContent = 'Personalizado — ' + ratio.replace('/', ' : ');
      if (fc) fc.hidden = false;
      return;
    }
    if (!FMT_HINT[fmt]) fmt = '16:9';
    dash.dataset.format = fmt; dash.style.removeProperty('--fmt');
    localStorage.setItem('sl-format', fmt);
    document.querySelectorAll('#fmtSeg button').forEach(b => b.classList.toggle('active', b.dataset.fmt === fmt));
    const h = document.getElementById('fmtHint'); if (h) h.textContent = FMT_HINT[fmt];
    if (fc) fc.hidden = true;
  }
  document.getElementById('fmtSeg')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-fmt]'); if (b) applyFormat(b.dataset.fmt);
  });
  document.getElementById('fmtApply')?.addEventListener('click', () => {
    const w = +document.getElementById('fmtW').value, h = +document.getElementById('fmtH').value;
    if (w > 0 && h > 0) applyFormat('custom', w + '/' + h);
  });
  (function initFmt() {
    const cr = (localStorage.getItem('sl-format-custom') || '9/16').split('/');
    const w = document.getElementById('fmtW'), h = document.getElementById('fmtH');
    if (w && cr[0]) w.value = cr[0]; if (h && cr[1]) h.value = cr[1];
    applyFormat(localStorage.getItem('sl-format') || '16:9');
  })();

  // ---------------- ROUTER ----------------
  const PAGES = {
    producao: { t: 'Produção', d: 'Roteiro/rundown da live: ordem de cenas, blocos e cronômetro.' },
    fontes: { t: 'Fontes', render: renderFontes },
    graficos: { t: 'Gráficos', render: renderGraficos },
    futebol: { t: 'Futebol', render: () => { const w = el('div', 'fb-page-wrap'); if (window.FutSetup) w.appendChild(window.FutSetup.render()); if (window.Futebol) w.appendChild(window.Futebol.renderPage()); return w; } },
    modelos: { t: 'Modelos', render: () => (window.Modelos ? window.Modelos.renderPage() : document.createElement('div')) },
    transicoes: { t: 'Transições', d: 'FADE, AUTO, stinger e duração das transições.' },
    multiview: { t: 'Multiview', render: renderMultiview },
    gravacoes: { t: 'Gravações', d: 'Arquivos MP4 gravados, com play e exportação.' },
    stream: { t: 'Stream', render: renderStream },
    dispositivos: { t: 'Dispositivos', render: renderDispositivos },
    audio: { t: 'Áudio', render: renderAudio },
    configuracoes: { t: 'Configurações', render: renderConfig },
  };
  // aplica a transição de entrada (fade+slide+blur+glow+stagger) num container
  function animateIn(elm) {
    if (!elm) return;
    elm.classList.remove('fx-enter');
    void elm.offsetWidth; // reinicia a animação
    elm.classList.add('fx-enter');
    elm.addEventListener('animationend', function done(ev) {
      if (ev.target !== elm) return; // só o container, não os filhos
      elm.classList.remove('fx-enter');
      elm.removeEventListener('animationend', done);
    });
  }
  function go(route, opts) {
    if (pageCleanup) { pageCleanup(); pageCleanup = null; }
    closeGfxDock();
    if (!opts?.silent) window.SoundFX?.navigate?.();
    if (route === 'stream') { openStreamModal(); return; } // Stream = modal glow
    if (route === 'fontes') { openGlowModal('Fontes · adicionar', renderFontes()); return; }
    if (route === 'audio') { openGlowModal('Áudio', renderAudio()); return; }
    if (route === 'multiview') { openGlowModal('Multiview · 2ª tela', renderMultiview()); return; }
    if (route === 'dispositivos') { openConnectModal('camera', 'camera'); return; } // só câmera (controle fica na barra de cima)
    if (route === 'configuracoes') { openGlowModal('Configurações', renderConfig()); return; }
    document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    if (route === 'graficos') { openGfxDock(); mainEl.classList.remove('is-hidden'); pageEl.classList.add('is-hidden'); pageEl.innerHTML = ''; return; }
    if (route === 'dashboard' || !PAGES[route]) {
      mainEl.classList.remove('is-hidden'); pageEl.classList.add('is-hidden'); pageEl.innerHTML = '';
      animateIn(mainEl);
      return;
    }
    const p = PAGES[route];
    pageEl.innerHTML = '';
    const head = el('div', 'page-head'); head.innerHTML = `<h1>${p.t}</h1>`;
    pageEl.appendChild(head);
    pageEl.appendChild(p.render ? p.render() : soonCard(p));
    mainEl.classList.add('is-hidden'); pageEl.classList.remove('is-hidden');
    pageEl.scrollTop = 0;
    animateIn(pageEl);
  }
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.route); });
  });
  document.querySelector('.dtop-right [title="Configurações"]')?.addEventListener('click', () => go('configuracoes'));
  document.getElementById('btnPlaylist')?.addEventListener('click', () => openPlaylistModal('audio'));

  // Graficos = painel flutuante (mantem o PROGRAM visivel pra arrastar/ver ao vivo)
  function closeGfxDock() { document.getElementById('gfxDock')?.remove(); }
  function openGfxDock() {
    closeGfxDock();
    const d = el('div', 'gfx-dock'); d.id = 'gfxDock';
    const head = el('div', 'gfx-dock-head'); head.innerHTML = '<b>GRAFICOS</b>';
    const x = el('button', 'modal-close'); x.innerHTML = '&times;'; x.style.position = 'static'; x.onclick = () => go('dashboard');
    head.appendChild(x); d.appendChild(head);
    const body = el('div', 'gfx-dock-body'); body.appendChild(renderGraficos()); d.appendChild(body);
    document.body.appendChild(d);
  }

  function soonCard(p) {
    const c = el('div', 'page-card');
    c.innerHTML = `<div class="soon-pill">Em construcao</div><p>${p.d}</p>
      <p class="hint">Esta secao esta no checklist do projeto (CHECKLIST.md). Quer que eu priorize? E so pedir.</p>`;
    return c;
  }

  // ---------------- paginas funcionais ----------------
  // ---------------- STREAM (destinos RTMP) ----------------
  const STREAM_PRESETS = {
    youtube: { label: 'YouTube', url: 'rtmp://a.rtmp.youtube.com/live2' },
    facebook: { label: 'Facebook', url: 'rtmps://live-api-s.facebook.com:443/rtmp/' },
    twitch: { label: 'Twitch', url: 'rtmp://live.twitch.tv/app' },
    kick: { label: 'Kick', url: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app' },
    custom: { label: 'Outro (RTMP/RTMPS)', url: '' },
  };
  const sDests = () => { try { return JSON.parse(localStorage.getItem('sl-stream-dests') || '[]'); } catch { return []; } };
  const sSave = d => localStorage.setItem('sl-stream-dests', JSON.stringify(d));
  function renderStream() {
    const c = el('div', 'page-card'); c.classList.add('stream-page');
    const intro = el('p', 'hint');
    intro.innerHTML = 'Cadastre os destinos. <b>YouTube</b> e <b>Facebook</b> transmitem por <b>RTMP</b> (URL + chave). <b>Instagram não tem RTMP oficial</b> — só pelo app do celular. A saída ao vivo usa o <b>encoder do servidor</b> (em construção: envia o PROGRAM pra todos os destinos ligados ao mesmo tempo).';
    c.appendChild(intro);
    const plat = el('select'); Object.entries(STREAM_PRESETS).forEach(([k, v]) => { const o = document.createElement('option'); o.value = k; o.textContent = v.label; plat.appendChild(o); });
    const url = el('input'); url.type = 'text'; url.placeholder = 'rtmp://...'; url.value = STREAM_PRESETS.youtube.url;
    const key = el('input'); key.type = 'text'; key.placeholder = 'Chave de transmissão (stream key)';
    plat.onchange = () => { url.value = STREAM_PRESETS[plat.value].url; };
    c.appendChild(block('Plataforma', plat));
    c.appendChild(block('URL RTMP', url));
    c.appendChild(block('Chave', key));
    const addB = el('button', 'btn-soft'); addB.textContent = '+ Adicionar destino';
    const listWrap = el('div', 'stream-list');
    function renderList() {
      listWrap.innerHTML = '';
      const d = sDests();
      if (!d.length) { const e0 = el('p', 'hint'); e0.textContent = 'Nenhum destino cadastrado ainda.'; listWrap.appendChild(e0); return; }
      d.forEach(x => {
        const row = el('div', 'stream-row');
        row.innerHTML = `<span class="sr-plat">${x.label}</span><span class="sr-url" title="${x.url}">${x.url}</span>`;
        const tg = el('button', 'sr-toggle' + (x.on ? ' on' : '')); tg.textContent = x.on ? 'LIGADO' : 'desligado';
        tg.onclick = () => { const dd = sDests(); const i = dd.findIndex(y => y.id === x.id); if (i >= 0) { dd[i].on = !dd[i].on; sSave(dd); renderList(); } };
        const del = el('button', 'sr-x'); del.textContent = '×'; del.onclick = () => { sSave(sDests().filter(y => y.id !== x.id)); renderList(); };
        row.append(tg, del); listWrap.appendChild(row);
      });
    }
    addB.onclick = () => { if (!url.value.trim() || !key.value.trim()) return; const d = sDests(); d.push({ id: 's' + Date.now(), platform: plat.value, label: STREAM_PRESETS[plat.value].label, url: url.value.trim(), key: key.value.trim(), on: true }); sSave(d); key.value = ''; renderList(); };
    c.appendChild(addB);
    const stt = el('div', 'set-title'); stt.textContent = 'Destinos cadastrados'; c.appendChild(stt);
    c.appendChild(listWrap);
    renderList();
    return c;
  }

  // ---------------- MODAL com borda glow azul/roxo (estilo sitelocal) ----------------
  function escGlowClose(e) { if (e.key === 'Escape') closeGlowModal(); }
  function closeGlowModal() { document.getElementById('glowModal')?.remove(); document.removeEventListener('keydown', escGlowClose); }
  function openGlowModal(title, contentNode, opts) {
    closeGlowModal();
    const ov = el('div', 'modal-overlay glow-overlay'); ov.id = 'glowModal';
    const shell = el('div', 'glow-shell'); if (opts && opts.wide) shell.classList.add('glow-wide');
    const card = el('div', 'glow-modal');
    const head = el('div', 'gm-head'); const h = el('h2'); h.textContent = title; head.appendChild(h);
    const x = el('button', 'modal-close'); x.innerHTML = '&times;'; x.style.position = 'static'; x.onclick = closeGlowModal; head.appendChild(x);
    const body = el('div', 'gm-body'); if (contentNode) body.appendChild(contentNode);
    card.append(head, body); shell.appendChild(card); ov.appendChild(shell);
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeGlowModal(); });
    document.addEventListener('keydown', escGlowClose);
    try { window.SoundFX?.open?.(); } catch {}
    return { overlay: ov, body };
  }
  function openStreamModal() { openGlowModal('Transmissão · destinos', renderStream()); }

  // ---------------- MODAL de PLAYLIST (escolhe Áudio ou Vídeo) ----------------
  function openPlaylistModal(which) {
    const wrap = el('div', 'pl-wrap');
    const tabs = el('div', 'pl-tabs');
    const tA = el('button', 'pl-tab'); tA.innerHTML = '&#127925; Áudio';
    const tV = el('button', 'pl-tab'); tV.innerHTML = '&#127916; Vídeo';
    tabs.append(tA, tV);
    const content = el('div', 'pl-content');
    function show(tab) {
      tA.classList.toggle('on', tab === 'audio'); tV.classList.toggle('on', tab === 'video');
      content.innerHTML = '';
      content.appendChild(tab === 'video' ? renderVideoTab() : renderBgMusic());
    }
    tA.onclick = () => show('audio'); tV.onclick = () => show('video');
    wrap.append(tabs, content);
    openGlowModal('Playlist', wrap, { wide: true });
    show(which === 'video' ? 'video' : 'audio');
  }
  window.openPlaylistModal = openPlaylistModal;

  // ---------------- MODAL "Conectar celular" (Câmera / Controle) ----------------
  function qrBox(url, note) {
    const wrap = el('div', 'qr-connect');
    const img = el('img', 'qr-big'); img.alt = 'QR'; img.src = '/qr?text=' + encodeURIComponent(url);
    const a = el('a', 'phone-url'); a.target = '_blank'; a.rel = 'noopener'; a.textContent = url; a.href = url;
    const p = el('p', 'hint'); p.textContent = note;
    wrap.append(img, a, p); return wrap;
  }
  async function openConnectModal(which, only) {
    const room = new URLSearchParams(location.search).get('room') || 'cam1';
    let info = {}; try { info = await fetch('/api/info').then(r => r.json()); } catch {}
    const base = info.public || ('https://' + location.hostname + ':' + (info.port || location.port));
    const camUrl = (info.phoneUrl || (base + '/phone')) + '?room=' + encodeURIComponent(room);
    const ctlUrl = (info.controlUrl || (base + '/control')) + '?room=' + encodeURIComponent(room);
    if (only === 'camera') { // Adicionar fonte / Dispositivos: só CÂMERA
      openGlowModal('Conectar câmera', qrBox(camUrl, 'Vira uma CÂMERA: escaneie com a câmera do celular. Mesma rede WiFi · aceite o aviso do certificado.'));
      return;
    }
    if (only === 'control') { // barra de cima: só CONTROLE
      openGlowModal('Conectar controle', qrBox(ctlUrl, 'Vira o CONTROLE: troca de câmera, transição suave (FUNDIDO) e música — mesma rede WiFi.'));
      return;
    }
    const wrap = el('div', 'pl-wrap');
    const tabs = el('div', 'pl-tabs');
    const tC = el('button', 'pl-tab'); tC.innerHTML = '📷 Câmera';
    const tR = el('button', 'pl-tab'); tR.innerHTML = '🎛 Controle';
    tabs.append(tC, tR);
    const content = el('div', 'pl-content');
    function show(t) {
      tC.classList.toggle('on', t === 'cam'); tR.classList.toggle('on', t === 'ctl');
      content.innerHTML = '';
      content.appendChild(t === 'ctl'
        ? qrBox(ctlUrl, 'Vira um CONTROLE: troca de câmera, transição suave (FUNDIDO) e música — mesma rede WiFi.')
        : qrBox(camUrl, 'Vira uma CÂMERA: escaneie com a câmera do celular. Mesma rede WiFi · aceite o aviso do certificado.'));
    }
    tC.onclick = () => show('cam'); tR.onclick = () => show('ctl');
    wrap.append(tabs, content);
    openGlowModal('Conectar celular', wrap);
    show(which === 'control' ? 'ctl' : 'cam');
  }
  window.openConnectModal = openConnectModal;

  // ---------------- PRÉ-VISUALIZAR (assistir/ouvir local — NÃO vai pro ar) ----------------
  function openAudition(url, name, isVideo) {
    if (!url) return;
    document.getElementById('auditionModal')?.remove();
    const ov = el('div', 'modal-overlay glow-overlay'); ov.id = 'auditionModal'; ov.style.zIndex = '9500';
    const shell = el('div', 'glow-shell'); const card = el('div', 'glow-modal');
    const head = el('div', 'gm-head'); const h = el('h2'); h.textContent = 'Pré-visualizar · ' + (name || ''); head.appendChild(h);
    const x = el('button', 'modal-close'); x.innerHTML = '&times;'; x.style.position = 'static';
    const close = () => { try { med.pause(); } catch {} ov.remove(); };
    x.onclick = close; head.appendChild(x);
    const body = el('div', 'gm-body');
    const med = document.createElement(isVideo ? 'video' : 'audio');
    med.src = url; med.controls = true; med.autoplay = true; med.className = 'audi-media'; if (isVideo) med.playsInline = true;
    const note = el('p', 'hint'); note.textContent = 'Só você vê/ouve aqui (sai no seu fone/alto-falante). NÃO vai pro ar.';
    body.append(med, note); card.append(head, body); shell.appendChild(card); ov.appendChild(shell);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    document.body.appendChild(ov);
  }
  window.openAudition = openAudition;

  // lista de VÍDEOS dentro do modal (tocar/reordenar/remover/adicionar)
  function renderVideoTab() {
    const c = el('div', 'vtab');
    const addB = el('button', 'btn-soft vtab-add'); addB.textContent = '+ Adicionar vídeos';
    addB.onclick = () => pickFiles('video/*', true, files => {
      if (window.VideoPlaylist) window.VideoPlaylist.add(files);
      else if (window.Studio && window.Studio.addVideoPlaylist) window.Studio.addVideoPlaylist(files);
      setTimeout(() => { bindV(); repaint(); }, 90);
    });
    c.appendChild(addB);
    const bar = el('div', 'vtab-bar');
    const mk = (html, cls) => { const b = el('button', cls || null); b.innerHTML = html; return b; };
    const prev = mk('&#9198;'), play = mk('&#9654;', 'play'), next = mk('&#9197;');
    const auto = el('button', 'vtab-t'); auto.textContent = 'Auto';
    const loop = el('button', 'vtab-t'); loop.textContent = 'Loop';
    const pre = el('button', 'vtab-pre'); pre.textContent = 'Pré';
    const air = el('button', 'vtab-air'); air.textContent = 'No ar';
    prev.onclick = () => window.VideoPlaylist && window.VideoPlaylist.prev();
    play.onclick = () => window.VideoPlaylist && window.VideoPlaylist.toggle();
    next.onclick = () => window.VideoPlaylist && window.VideoPlaylist.next();
    auto.onclick = () => { const v = window.VideoPlaylist; if (v) v.setAuto(!v.auto()); };
    loop.onclick = () => { const v = window.VideoPlaylist; if (v) v.setLoopAll(!v.loopAll()); };
    pre.onclick = () => { const v = window.VideoPlaylist; if (!v || !window.Studio) return; const st = window.Studio.state(); if (st.preview === v.sourceId) window.Studio.clearPreview(); else window.Studio.setPreview(v.sourceId); };
    air.onclick = () => { const v = window.VideoPlaylist; if (!v || !window.Studio) return; const st = window.Studio.state(); if (st.program === v.sourceId) window.Studio.clearProgram(); else v.commitAir(); };
    bar.append(prev, play, next, auto, loop, pre, air);
    c.appendChild(bar);
    const listEl = el('ul', 'vtab-list'); c.appendChild(listEl);
    const vhint = el('p', 'hint'); vhint.textContent = 'Arraste pra reordenar · clique pra tocar · × remove. O áudio do vídeo cai no MIXER.'; c.appendChild(vhint);
    let dragIdx = null, boundV = null;
    function repaint() {
      if (!listEl.isConnected) return;
      const v = window.VideoPlaylist;
      play.innerHTML = (v && v.playing()) ? '&#9208;' : '&#9654;';
      auto.classList.toggle('on', !!(v && v.auto()));
      loop.classList.toggle('on', !!(v && v.loopAll()));
      let st = {}; try { st = window.Studio ? window.Studio.state() : {}; } catch {}
      pre.classList.toggle('act', !!(v && st.preview === v.sourceId));
      air.classList.toggle('act', !!(v && st.program === v.sourceId));
      listEl.innerHTML = '';
      if (!v || !v.list().length) { const li0 = el('li', 'hint'); li0.textContent = 'Nenhum vídeo ainda. Use "+ Adicionar vídeos".'; listEl.appendChild(li0); return; }
      const cur = v.current();
      v.list().forEach((it, i) => {
        const li = el('li', 'vtab-row' + (i === cur ? ' cur' : '')); li.draggable = true;
        li.innerHTML = `<span class="vt-grip">&#8942;&#8942;</span><span class="vt-n">${i + 1}</span><span class="vt-name"></span><span class="vt-go">${i === cur ? '&#9654;' : ''}</span><button class="vt-audi" title="Assistir antes do ar (só no fone)">&#128065;</button><button class="vt-rm" title="Remover">&times;</button>`;
        li.querySelector('.vt-name').textContent = it.name; li.title = it.name;
        li.onclick = e => { if (e.target.closest('.vt-rm, .vt-audi')) return; v.playAt(i); };
        li.querySelector('.vt-audi').onclick = e => { e.stopPropagation(); if (window.openAudition) window.openAudition(it.url, it.name, true); };
        li.querySelector('.vt-rm').onclick = e => { e.stopPropagation(); v.removeAt(i); repaint(); };
        li.addEventListener('dragstart', e => { dragIdx = i; li.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch {} });
        li.addEventListener('dragend', () => { dragIdx = null; li.classList.remove('dragging'); listEl.querySelectorAll('.vtab-row').forEach(r => r.classList.remove('drop-tp', 'drop-bt')); });
        li.addEventListener('dragover', e => { if (dragIdx == null || dragIdx === i) return; e.preventDefault(); const r = li.getBoundingClientRect(), af = (e.clientY - r.top) > r.height / 2; li.classList.toggle('drop-bt', af); li.classList.toggle('drop-tp', !af); });
        li.addEventListener('dragleave', () => li.classList.remove('drop-tp', 'drop-bt'));
        li.addEventListener('drop', e => { e.preventDefault(); li.classList.remove('drop-tp', 'drop-bt'); if (dragIdx == null || dragIdx === i) return; const r = li.getBoundingClientRect(), af = (e.clientY - r.top) > r.height / 2; let to = af ? i + 1 : i; if (dragIdx < to) to--; const from = dragIdx; dragIdx = null; v.move(from, to); repaint(); });
        listEl.appendChild(li);
      });
    }
    function bindV() { const v = window.VideoPlaylist; if (v && v !== boundV) { boundV = v; v.onUpdate(repaint); } }
    bindV(); repaint();
    return c;
  }

  function renderMultiview() {
    const c = el('div', 'page-card');
    const p = el('p'); p.innerHTML = 'Abre uma janela com <b>todas as fontes em grade</b> (PREVIEW verde · PROGRAM vermelho). Arraste pro segundo monitor e aperte <b>F11</b> pra tela cheia. Atualiza sozinho conforme você conecta câmeras e troca o que está no ar.';
    c.appendChild(p);
    const b = el('button', 'btn-soft fb-prim'); b.textContent = 'Abrir Multiview (2ª tela)';
    b.onclick = () => { const w = window.open('/multiview', 'kivo-multiview', 'width=1280,height=720'); if (!w) alert('O navegador bloqueou a janela. Permita pop-ups para este site.'); };
    c.appendChild(b);
    return c;
  }
  function renderDispositivos() {
    const c = el('div', 'page-card');
    c.innerHTML = `<p>Conecte cameras escaneando o QR (mesma rede WiFi). Cada celular vira uma camera (ate 6).</p>
      <img id="qrPage" class="qr" alt="QR"/>
      <a id="qrPageUrl" class="phone-url" target="_blank" rel="noopener"></a>
      <p class="hint">As cameras conectadas aparecem no painel "Dispositivos moveis" do Dashboard.</p>`;
    loadQR(c.querySelector('#qrPage'), c.querySelector('#qrPageUrl'));
    return c;
  }
  function renderAudio() {
    const c = el('div', 'page-card');
    c.appendChild(block('Fonte de audio (mic / interface / PC)', audioPicker()));
    c.appendChild(block('Musica de fundo (playlist)', renderBgMusic()));
    return c;
  }
  function renderFontes() {
    const c = el('div', 'page-card');
    const p = el('p'); p.textContent = 'Adicione qualquer fonte de video. Ela aparece em FONTES e pode ir pro PREVIEW/PROGRAM.'; c.appendChild(p);
    const row = el('div', 'set-actions');
    [['Camera USB / webcam', () => window.Studio?.addWebcam(null, 'Camera USB')],
     ['Tela / janela / aba (jogo, YouTube...)', () => window.Studio?.addScreen()],
     ['Video (arquivo)', () => window.Studio?.pickFile('video/*', f => window.Studio.addVideoFile(f))],
     ['Link (YouTube / video)', () => window.Studio?.addLink()],
     ['Imagem', () => window.Studio?.pickFile('image/*', f => window.Studio.addImageFile(f))]].forEach(([l, fn]) => {
      const b = el('button', 'btn-soft'); b.textContent = l; b.onclick = fn; row.appendChild(b);
    });
    c.appendChild(row);
    const h = el('p', 'hint'); h.textContent = 'As fontes ficam no Dashboard (painel FONTES). Cameras de celular entram pelo QR.'; c.appendChild(h);
    return c;
  }

  // ---------------- MUSICA DE FUNDO (singleton: continua tocando ao navegar) ----------------
  const BgMusic = (function () {
    // 2 "decks" (estilo DJ) pra fazer CROSSFADE: uma faixa baixa enquanto a outra sobe
    const deckA = new Audio(), deckB = new Audio();
    let list = [], idx = -1, subs = [], active = 0, xfade = true, xfadeSec = 3, xfTimer = null;
    const cur = () => active === 0 ? deckA : deckB;
    const idle = () => active === 0 ? deckB : deckA;
    const state = () => ({ list, idx, paused: cur().paused, current: list[idx] || null, xfade, xfadeSec });
    const emit = () => subs.forEach(f => { try { f(state()); } catch {} });
    const route = () => { try { window.Mixer && window.Mixer.ensureMusic && window.Mixer.ensureMusic(); } catch {} };
    const stopXf = () => { if (xfTimer) { clearInterval(xfTimer); xfTimer = null; } };
    function playAt(i, allowXf) {
      if (i < 0 || i >= list.length) return;
      route();
      const playing = idx >= 0 && !cur().paused;
      if (xfade && allowXf !== false && playing && xfadeSec > 0 && list.length > 1) {
        const out = cur(), d = idle();
        d.src = list[i].url; d.volume = 0; d.play().catch(() => {});
        active = active === 0 ? 1 : 0; idx = i; emit();
        const steps = 30, stepMs = Math.max(20, (xfadeSec * 1000) / steps); let k = 0;
        stopXf();
        xfTimer = setInterval(() => {
          k++; const t = k / steps;
          try { out.volume = Math.max(0, 1 - t); d.volume = Math.min(1, t); } catch {}
          if (k >= steps) { stopXf(); try { out.pause(); out.volume = 1; } catch {} }
        }, stepMs);
      } else {
        stopXf(); try { idle().pause(); } catch {}
        const d = cur(); d.src = list[i].url; d.volume = 1; d.play().catch(() => {});
        idx = i; emit();
      }
    }
    function next() { if (list.length) playAt((idx + 1) % list.length); }
    function checkAuto(deck, who) { // começa o crossfade ~xfadeSec antes de acabar (auto-avanço suave)
      if (who !== active || !xfade || xfadeSec <= 0 || xfTimer || idx < 0 || list.length < 2) return;
      if (deck.duration && (deck.duration - deck.currentTime) <= xfadeSec) playAt((idx + 1) % list.length);
    }
    deckA.addEventListener('ended', () => { if (active === 0) next(); });
    deckB.addEventListener('ended', () => { if (active === 1) next(); });
    deckA.addEventListener('timeupdate', () => checkAuto(deckA, 0));
    deckB.addEventListener('timeupdate', () => checkAuto(deckB, 1));
    [deckA, deckB].forEach(d => { d.addEventListener('play', emit); d.addEventListener('pause', emit); });
    return {
      add(files) { [...files].forEach(f => list.push({ name: f.name, url: URL.createObjectURL(f) })); emit(); },
      playAt: (i) => playAt(i), next,
      prev() { if (list.length) playAt((idx - 1 + list.length) % list.length); },
      toggle() { if (idx < 0 && list.length) return playAt(0, false); const d = cur(); if (d.paused) { d.play().catch(() => {}); route(); } else d.pause(); emit(); },
      state, onUpdate(f) { subs.push(f); try { f(state()); } catch {} },
      decks: () => [deckA, deckB],
      setXfade(b) { xfade = !!b; emit(); }, setXfadeSec(s) { xfadeSec = Math.max(0, Math.min(12, s | 0)); emit(); },
      get audio() { return cur(); },
    };
  })();
  window.BgMusic = BgMusic;
  function renderBgMusic() {
    const w = el('div', 'bgm');
    w.innerHTML = `<button class="btn-soft bgm-add" id="bgmAdd">Adicionar musicas</button>
      <ul class="bgm-list" id="bgmList"></ul>
      <div class="bgm-bar"><button id="bgmPrev">&#9198;</button><button class="play" id="bgmPlay">&#9654;</button><button id="bgmNext">&#9197;</button><span class="bgm-now" id="bgmNow">&mdash;</span></div>
      <div class="bgm-xf"><label class="bgm-xf-tg"><input type="checkbox" id="bgmXf"/> <b>Crossfade</b> <span>(transição DJ)</span></label><input type="range" id="bgmXfSec" min="0" max="10" step="1"/><span class="bgm-xf-lbl" id="bgmXfLbl">3s</span></div>
      <p class="hint">Toca pela mesa (MASTER) — você ouve só o master. Com <b>Crossfade</b>, ao trocar de faixa (ou no fim) uma baixa enquanto a outra sobe.</p>`;
    const listEl = w.querySelector('#bgmList'), now = w.querySelector('#bgmNow'), play = w.querySelector('#bgmPlay');
    const xf = w.querySelector('#bgmXf'), xfSec = w.querySelector('#bgmXfSec'), xfLbl = w.querySelector('#bgmXfLbl');
    w.querySelector('#bgmAdd').onclick = () => pickFiles('audio/*', true, files => BgMusic.add(files));
    play.onclick = () => BgMusic.toggle();
    w.querySelector('#bgmNext').onclick = () => BgMusic.next();
    w.querySelector('#bgmPrev').onclick = () => BgMusic.prev();
    xf.onchange = () => BgMusic.setXfade(xf.checked);
    xfSec.oninput = () => { BgMusic.setXfadeSec(+xfSec.value); xfLbl.textContent = xfSec.value + 's'; };
    function paint(s) {
      if (document.activeElement !== xf) xf.checked = !!s.xfade;
      if (document.activeElement !== xfSec) { xfSec.value = s.xfadeSec; xfLbl.textContent = s.xfadeSec + 's'; }
      listEl.innerHTML = s.list.map((t, i) => `<li class="bgm-track ${i === s.idx ? 'playing' : ''}" data-i="${i}"><span class="tx">${i === s.idx && !s.paused ? '&#9834;' : '&#9654;'}</span><span class="tnm">${t.name}</span><button class="bgm-audi" data-i="${i}" title="Ouvir antes do ar (só no fone)">&#128065;</button></li>`).join('') || '<li class="hint">Nenhuma musica ainda.</li>';
      listEl.querySelectorAll('.bgm-track').forEach(li => li.onclick = (e) => { if (e.target.closest('.bgm-audi')) return; BgMusic.playAt(+li.dataset.i); });
      listEl.querySelectorAll('.bgm-audi').forEach(b => b.onclick = (e) => { e.stopPropagation(); const t = s.list[+b.dataset.i]; if (t && window.openAudition) window.openAudition(t.url, t.name, false); });
      now.textContent = s.current ? s.current.name : '—';
      play.innerHTML = s.paused ? '&#9654;' : '&#9208;';
    }
    BgMusic.onUpdate(paint); paint(BgMusic.state());
    return w;
  }
  function pickFiles(accept, multiple, cb) { const i = el('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple; i.onchange = () => { if (i.files.length) cb(i.files); }; i.click(); }

  // ---------------- GRAFICOS (overlays do PROGRAM) ----------------
  function renderGraficos() {
    const c = el('div', 'page-card');
    const add = el('div', 'set-actions');
    [['+ Logo / Imagem', () => { const o = window.Graphics.add('image'); pickImageFor(o.id); }],
     ['+ Placar (futebol)', () => window.Graphics.add('scoreboard')],
     ['+ Rodapé animado', () => window.Graphics.add('ticker')],
     ['+ Logos em slide', () => window.Graphics.add('slideshow')]].forEach(([l, fn]) => { const b = el('button', 'btn-soft'); b.textContent = l; b.onclick = fn; add.appendChild(b); });
    c.appendChild(add);
    const listWrap = el('div', 'ov-list'); c.appendChild(listWrap);
    const hint = el('p', 'hint'); hint.textContent = 'Arraste cada elemento direto no monitor PROGRAM para posicionar e use a alça do canto para redimensionar.'; c.appendChild(hint);
    function repaint() {
      listWrap.innerHTML = '';
      const ovs = window.Graphics.list();
      if (!ovs.length) { const e = el('p', 'hint'); e.textContent = 'Nenhum gráfico ainda. Adicione um acima.'; listWrap.appendChild(e); return; }
      ovs.forEach(o => listWrap.appendChild(ovControls(o)));
    }
    window.Graphics.onChange(repaint); repaint();
    return c;
  }
  function ovControls(o) {
    const w = el('div', 'ov-ctrl');
    const title = o.type === 'image' ? 'Logo / Imagem' : o.type === 'scoreboard' ? 'Placar' : o.type === 'slideshow' ? 'Logos em slide' : 'Rodapé animado';
    const head = el('div', 'ov-ctrl-head'); head.innerHTML = `<b>${title}</b>`;
    const tools = el('div', 'ov-tools');
    const vis = el('button', 'btn-soft'); vis.textContent = o.visible ? 'Ocultar' : 'Mostrar'; vis.onclick = () => window.Graphics.setVisible(o.id, !o.visible);
    const del = el('button', 'btn-soft'); del.textContent = 'Remover'; del.onclick = () => window.Graphics.remove(o.id);
    tools.append(vis, del); head.appendChild(tools); w.appendChild(head);
    if (o.type === 'image') {
      const r = el('div', 'set-row'); r.innerHTML = '<label>Imagem</label>'; const b = el('button', 'btn-soft'); b.textContent = 'Escolher arquivo'; b.onclick = () => pickImageFor(o.id); r.appendChild(b); w.appendChild(r);
      const r2 = el('div', 'set-row'); r2.innerHTML = '<label>Tamanho</label>'; const rg = el('input'); rg.type = 'range'; rg.min = 5; rg.max = 60; rg.value = o.w; rg.oninput = () => window.Graphics.setWidth(o.id, +rg.value); r2.appendChild(rg); w.appendChild(r2);
    } else if (o.type === 'scoreboard') {
      const names = el('div', 'set-row');
      const ih = el('input'); ih.placeholder = 'Casa'; ih.value = o.data.home; ih.oninput = () => window.Graphics.update(o.id, { home: ih.value });
      const ia = el('input'); ia.placeholder = 'Visitante'; ia.value = o.data.away; ia.oninput = () => window.Graphics.update(o.id, { away: ia.value });
      names.append(ih, ia); w.appendChild(names);
      const row2 = el('div', 'sb-row');
      const hLogo = el('button', 'btn-soft'); hLogo.textContent = 'Escudo casa'; hLogo.onclick = () => pickLogo(o.id, 'homeLogo');
      const hCol = el('input'); hCol.type = 'color'; hCol.value = o.data.ch; hCol.oninput = () => window.Graphics.update(o.id, { ch: hCol.value });
      const aCol = el('input'); aCol.type = 'color'; aCol.value = o.data.ca; aCol.oninput = () => window.Graphics.update(o.id, { ca: aCol.value });
      const aLogo = el('button', 'btn-soft'); aLogo.textContent = 'Escudo visit.'; aLogo.onclick = () => pickLogo(o.id, 'awayLogo');
      row2.append(hLogo, hCol, aCol, aLogo); w.appendChild(row2);
      const dz = el('div', 'set-row'); dz.innerHTML = '<label>Design</label>';
      const sel = el('select'); [['modern', 'Moderno'], ['lateral', 'Lateral Clean'], ['central', 'Central'], ['transparent', 'Transparente'], ['premium', 'Premium'], ['vertical', 'Vertical'], ['esportivo', 'Esportivo'], ['classico', 'Clássico']].forEach(([v, lab]) => { const op = el('option'); op.value = v; op.textContent = lab; if (o.data.design === v) op.selected = true; sel.appendChild(op); });
      sel.onchange = () => window.Graphics.update(o.id, { design: sel.value }); dz.appendChild(sel); w.appendChild(dz);
      const sc = el('div', 'sb-ctrl');
      sc.innerHTML = '<button data-s="h" data-d="-1">&minus;</button><span>Casa</span><button data-s="h" data-d="1">+</button><button data-s="a" data-d="-1">&minus;</button><span>Vis.</span><button data-s="a" data-d="1">+</button>';
      sc.querySelectorAll('button').forEach(b => b.onclick = () => window.Graphics.score(o.id, b.dataset.s, +b.dataset.d));
      w.appendChild(sc);
      const clk = el('div', 'set-actions');
      const t = el('button', 'btn-soft'); t.textContent = 'Iniciar / Pausar tempo'; t.onclick = () => window.Graphics.clockCtl(o.id, 'toggle');
      const rs = el('button', 'btn-soft'); rs.textContent = 'Zerar'; rs.onclick = () => window.Graphics.clockCtl(o.id, 'reset');
      clk.append(t, rs); w.appendChild(clk);
      w.appendChild(gamesSection(o));
    } else if (o.type === 'ticker') {
      const r = el('div', 'set-row'); r.innerHTML = '<label>Texto</label>'; const inp = el('input'); inp.value = o.data.text; inp.oninput = () => window.Graphics.update(o.id, { text: inp.value }); r.appendChild(inp); w.appendChild(r);
      const r2 = el('div', 'set-row'); r2.innerHTML = '<label>Velocidade</label>'; const rg = el('input'); rg.type = 'range'; rg.min = 6; rg.max = 40; rg.value = o.data.speed; rg.oninput = () => window.Graphics.update(o.id, { speed: +rg.value }); r2.appendChild(rg); w.appendChild(r2);
    } else if (o.type === 'slideshow') {
      const r = el('div', 'set-row'); r.innerHTML = '<label>Imagens</label>'; const b = el('button', 'btn-soft'); b.textContent = 'Adicionar logos'; b.onclick = () => addSlideImages(o.id); r.appendChild(b); w.appendChild(r);
      const ri = el('div', 'set-row'); ri.innerHTML = '<label>Tempo (s)</label>'; const rg = el('input'); rg.type = 'range'; rg.min = 2; rg.max = 20; rg.value = o.data.interval; rg.oninput = () => window.Graphics.update(o.id, { interval: +rg.value }); ri.appendChild(rg); w.appendChild(ri);
      const rt = el('div', 'set-row'); rt.innerHTML = '<label>Transição</label>'; const sel = el('select'); [['fade', 'Fade'], ['none', 'Corte']].forEach(([v, l]) => { const op = el('option'); op.value = v; op.textContent = l; if (o.data.transition === v) op.selected = true; sel.appendChild(op); }); sel.onchange = () => window.Graphics.update(o.id, { transition: sel.value }); rt.appendChild(sel); w.appendChild(rt);
      const list = el('div', 'ss-list'); w.appendChild(list);
      o._paintList = () => { list.innerHTML = ''; (o.data.images || []).forEach((src, i) => { const row = el('div', 'ss-item'); const im = el('img'); im.src = src; const x = el('button', 'game-x'); x.textContent = '×'; x.onclick = () => { o.data.images.splice(i, 1); window.Graphics.update(o.id, {}); o._paintList(); }; row.append(im, x); list.appendChild(row); }); };
      o._paintList();
    }
    return w;
  }
  function pickImageFor(id) { pickFiles('image/*', false, files => { const r = new FileReader(); r.onload = () => window.Graphics.update(id, { src: r.result }); r.readAsDataURL(files[0]); }); }
  function pickLogo(id, key) { pickFiles('image/*', false, files => { const r = new FileReader(); r.onload = () => window.Graphics.update(id, { [key]: r.result }); r.readAsDataURL(files[0]); }); }
  function addSlideImages(id) { pickFiles('image/*', true, files => { const o = window.Graphics.get(id); if (!o) return; [...files].forEach(f => { const rd = new FileReader(); rd.onload = () => { o.data.images.push(rd.result); window.Graphics.update(id, {}); if (o._paintList) o._paintList(); }; rd.readAsDataURL(f); }); }); }
  const Games = {
    list() { try { return JSON.parse(localStorage.getItem('sl-games') || '[]'); } catch { return []; } },
    save(g) { const l = this.list(); g.id = 'g' + Date.now(); l.push(g); localStorage.setItem('sl-games', JSON.stringify(l)); },
    remove(id) { localStorage.setItem('sl-games', JSON.stringify(this.list().filter(x => x.id !== id))); },
  };
  function pickGameData(d) { return { home: d.home, away: d.away, homeLogo: d.homeLogo, awayLogo: d.awayLogo, ch: d.ch, ca: d.ca, design: d.design }; }
  function gamesSection(o) {
    const s = el('div', 'set-block');
    const h = el('div', 'set-title'); h.textContent = 'Jogos pré-definidos (do dia)'; s.appendChild(h);
    const addRow = el('div', 'set-row');
    const nm = el('input'); nm.placeholder = 'Nome (ex: Time A x Time B)';
    const sv = el('button', 'btn-soft'); sv.textContent = 'Salvar';
    sv.onclick = () => { if (!nm.value.trim()) return; Games.save({ name: nm.value.trim(), data: pickGameData(o.data) }); nm.value = ''; paint(); };
    addRow.append(nm, sv); s.appendChild(addRow);
    const list = el('div', 'games-list'); s.appendChild(list);
    function paint() {
      list.innerHTML = '';
      const gs = Games.list();
      if (!gs.length) { const e = el('p', 'hint'); e.textContent = 'Salve os jogos do dia aqui pra trocar num clique.'; list.appendChild(e); return; }
      gs.forEach(g => {
        const row = el('div', 'game-row');
        const b = el('button', 'btn-soft'); b.textContent = g.name;
        b.onclick = () => { window.Graphics.update(o.id, g.data); window.Graphics.update(o.id, { hs: 0, as: 0 }); window.Graphics.clockCtl(o.id, 'reset'); };
        const x = el('button', 'game-x'); x.textContent = '×'; x.onclick = () => { Games.remove(g.id); paint(); };
        row.append(b, x); list.appendChild(row);
      });
    }
    paint();
    return s;
  }
  function renderConfig() {
    const c = el('div', 'page-card');
    c.appendChild(block('Formato da live', fmtMirror()));
    c.appendChild(block('Tema', themeButtons()));
    c.appendChild(block('Som da interface', soundControls()));
    c.appendChild(block('Fonte de audio', audioPicker()));
    return c;
  }

  function block(title, node) {
    const s = el('div', 'set-block'); const h = el('div', 'set-title'); h.textContent = title;
    s.appendChild(h); s.appendChild(node); return s;
  }
  function fmtMirror() {
    const w = el('div', 'fmt-seg');
    ['16:9', '9:16', '1:1', '4:5'].forEach(f => {
      const b = el('button'); b.dataset.fmt = f; b.textContent = f;
      if (dash.dataset.format === f) b.classList.add('active');
      b.onclick = () => { applyFormat(f); w.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.fmt === f)); };
      w.appendChild(b);
    });
    return w;
  }
  function themeButtons() {
    const w = el('div', 'seg-row');
    [['dark', 'Escuro'], ['light', 'Claro'], ['auto', 'Auto']].forEach(([v, l]) => {
      const b = el('button'); b.textContent = l; b.onclick = () => window.Theme?.set(v); w.appendChild(b);
    });
    return w;
  }
  function soundControls() {
    const w = el('div', 'set-row');
    w.innerHTML = '<label>Volume</label><input type="range" id="sfxVol" min="0" max="1" step="0.05">';
    const r = w.querySelector('#sfxVol'); r.value = localStorage.getItem('sl-sfx-vol') ?? '0.32';
    r.oninput = () => { localStorage.setItem('sl-sfx-vol', r.value); window.SoundFX?.hover(); };
    return w;
  }

  // ---------------- AUDIO PICKER (real) ----------------
  function audioPicker() {
    const wrap = el('div', 'audio-pick');
    wrap.innerHTML = `
      <div class="set-row"><label>Dispositivo</label>
        <select id="audSel"><option value="">— clique em Listar —</option></select></div>
      <div class="set-actions">
        <button class="btn-soft" id="audList">Listar dispositivos</button>
        <button class="btn-soft" id="audDesk">Audio do computador</button>
      </div>
      <div class="meter-wrap"><div class="meter-bar" id="audMeter"></div></div>
      <div class="hint" id="audStatus">Permita o microfone pra ver microfones, entrada de linha e interfaces. "Audio do computador" pede pra compartilhar a tela com audio.</div>`;
    let stream = null, raf = 0, ac = null;
    const sel = wrap.querySelector('#audSel'), meter = wrap.querySelector('#audMeter'), status = wrap.querySelector('#audStatus');
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; if (ac) { ac.close().catch(() => {}); ac = null; } meter.style.width = '0%'; }
    function meterFrom(s) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(s), an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
      const data = new Uint8Array(an.fftSize);
      (function loop() {
        an.getByteTimeDomainData(data);
        let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        meter.style.width = Math.min(100, Math.round(Math.sqrt(sum / data.length) * 220)) + '%';
        raf = requestAnimationFrame(loop);
      })();
    }
    async function listDevices() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop());
        const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
        sel.innerHTML = '<option value="">— selecione —</option>' + devs.map(d => `<option value="${d.deviceId}">${d.label || 'Entrada de audio'}</option>`).join('');
        status.textContent = `${devs.length} entradas encontradas (microfones, linha, interfaces).`;
      } catch (e) { status.textContent = 'Permissao de microfone negada: ' + e.message; }
    }
    async function useDevice(id) {
      stop(); if (!id) return;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id } } }); meterFrom(stream); localStorage.setItem('sl-audio-device', id); status.textContent = 'Capturando — fale/toque pra ver o nivel.'; }
      catch (e) { status.textContent = 'Erro: ' + e.message; }
    }
    async function useDesktop() {
      stop();
      try {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        s.getVideoTracks().forEach(t => t.stop());
        if (!s.getAudioTracks().length) { status.textContent = 'Marque "compartilhar audio" na janela de compartilhamento.'; return; }
        stream = new MediaStream(s.getAudioTracks()); meterFrom(stream);
        localStorage.setItem('sl-audio-device', 'desktop'); status.textContent = 'Audio do computador capturado.';
      } catch (e) { status.textContent = 'Cancelado: ' + e.message; }
    }
    wrap.querySelector('#audList').onclick = listDevices;
    wrap.querySelector('#audDesk').onclick = useDesktop;
    sel.onchange = () => useDevice(sel.value);
    pageCleanup = stop; // para a captura ao trocar de pagina
    return wrap;
  }

  async function loadQR(img, a) {
    try {
      const room = new URLSearchParams(location.search).get('room') || 'cam1';
      const info = await fetch('/api/info').then(r => r.json());
      const url = info.phoneUrl + '?room=' + encodeURIComponent(room);
      img.src = '/qr?text=' + encodeURIComponent(url);
      if (a) { a.textContent = url; a.href = url; }
    } catch {}
  }

  go('dashboard');
})();
