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
  function applyFormat(fmt) {
    if (!FMT_HINT[fmt]) fmt = '16:9';
    dash.dataset.format = fmt;
    localStorage.setItem('sl-format', fmt);
    document.querySelectorAll('#fmtSeg button').forEach(b => b.classList.toggle('active', b.dataset.fmt === fmt));
    const h = document.getElementById('fmtHint'); if (h) h.textContent = FMT_HINT[fmt];
  }
  document.getElementById('fmtSeg')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-fmt]'); if (b) applyFormat(b.dataset.fmt);
  });
  applyFormat(localStorage.getItem('sl-format') || '16:9');

  // ---------------- ROUTER ----------------
  const PAGES = {
    producao: { t: 'Producao', d: 'Roteiro/rundown da live: ordem de cenas, blocos e cronometro.' },
    fontes: { t: 'Fontes', render: renderFontes },
    graficos: { t: 'Graficos', render: renderGraficos },
    transicoes: { t: 'Transicoes', d: 'FADE, AUTO, stinger e duracao das transicoes.' },
    multiview: { t: 'Multiview', d: 'Grade de todas as fontes em tela cheia, para um monitor secundario.' },
    gravacoes: { t: 'Gravacoes', d: 'Arquivos MP4 gravados, com play e exportacao.' },
    stream: { t: 'Stream', d: 'Destinos (YouTube/Facebook/Instagram), chave RTMP, bitrate e resolucao.' },
    dispositivos: { t: 'Dispositivos', render: renderDispositivos },
    audio: { t: 'Audio', render: renderAudio },
    configuracoes: { t: 'Configuracoes', render: renderConfig },
  };
  function go(route) {
    if (pageCleanup) { pageCleanup(); pageCleanup = null; }
    closeGfxDock();
    document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    if (route === 'graficos') { openGfxDock(); mainEl.classList.remove('is-hidden'); pageEl.classList.add('is-hidden'); pageEl.innerHTML = ''; return; }
    if (route === 'dashboard' || !PAGES[route]) {
      mainEl.classList.remove('is-hidden'); pageEl.classList.add('is-hidden'); pageEl.innerHTML = '';
      return;
    }
    const p = PAGES[route];
    pageEl.innerHTML = '';
    const head = el('div', 'page-head'); head.innerHTML = `<h1>${p.t}</h1>`;
    pageEl.appendChild(head);
    pageEl.appendChild(p.render ? p.render() : soonCard(p));
    mainEl.classList.add('is-hidden'); pageEl.classList.remove('is-hidden');
    pageEl.scrollTop = 0;
  }
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.route); });
  });
  document.querySelector('.dtop-right [title="Configuracoes"]')?.addEventListener('click', () => go('configuracoes'));

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
    const audio = new Audio(); let list = [], idx = -1, cb = null;
    const state = () => ({ list, idx, paused: audio.paused, current: list[idx] || null });
    const emit = () => cb && cb(state());
    function playAt(i) { if (i < 0 || i >= list.length) return; idx = i; audio.src = list[i].url; audio.play().catch(() => {}); emit(); }
    function next() { if (list.length) playAt((idx + 1) % list.length); }
    audio.addEventListener('ended', next); audio.addEventListener('play', emit); audio.addEventListener('pause', emit);
    return {
      add(files) { [...files].forEach(f => list.push({ name: f.name, url: URL.createObjectURL(f) })); emit(); },
      playAt, next,
      prev() { if (list.length) playAt((idx - 1 + list.length) % list.length); },
      toggle() { if (idx < 0 && list.length) return playAt(0); audio.paused ? audio.play().catch(() => {}) : audio.pause(); emit(); },
      state, onUpdate(f) { cb = f; }, audio,
    };
  })();
  window.BgMusic = BgMusic;
  function renderBgMusic() {
    const w = el('div', 'bgm');
    w.innerHTML = `<button class="btn-soft bgm-add" id="bgmAdd">Adicionar musicas</button>
      <ul class="bgm-list" id="bgmList"></ul>
      <div class="bgm-bar"><button id="bgmPrev">&#9198;</button><button class="play" id="bgmPlay">&#9654;</button><button id="bgmNext">&#9197;</button><span class="bgm-now" id="bgmNow">&mdash;</span></div>
      <p class="hint">Toca em segundo plano (audio-only, nao aparece na tela). Quando a gravacao/stream entrar, vai pro mix do PROGRAM com ducking opcional.</p>`;
    const listEl = w.querySelector('#bgmList'), now = w.querySelector('#bgmNow'), play = w.querySelector('#bgmPlay');
    w.querySelector('#bgmAdd').onclick = () => pickFiles('audio/*', true, files => BgMusic.add(files));
    play.onclick = () => BgMusic.toggle();
    w.querySelector('#bgmNext').onclick = () => BgMusic.next();
    w.querySelector('#bgmPrev').onclick = () => BgMusic.prev();
    function paint(s) {
      listEl.innerHTML = s.list.map((t, i) => `<li class="bgm-track ${i === s.idx ? 'playing' : ''}" data-i="${i}"><span class="tx">${i === s.idx && !s.paused ? '&#9834;' : '&#9654;'}</span><span class="tnm">${t.name}</span></li>`).join('') || '<li class="hint">Nenhuma musica ainda.</li>';
      listEl.querySelectorAll('.bgm-track').forEach(li => li.onclick = () => BgMusic.playAt(+li.dataset.i));
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
     ['+ Rodape animado', () => window.Graphics.add('ticker')],
     ['+ Logos em slide', () => window.Graphics.add('slideshow')]].forEach(([l, fn]) => { const b = el('button', 'btn-soft'); b.textContent = l; b.onclick = fn; add.appendChild(b); });
    c.appendChild(add);
    const listWrap = el('div', 'ov-list'); c.appendChild(listWrap);
    const hint = el('p', 'hint'); hint.textContent = 'Arraste cada elemento direto no monitor PROGRAM pra posicionar. Por enquanto aparecem no PROGRAM; vao pro stream/gravacao na fatia de saida.'; c.appendChild(hint);
    function repaint() {
      listWrap.innerHTML = '';
      const ovs = window.Graphics.list();
      if (!ovs.length) { const e = el('p', 'hint'); e.textContent = 'Nenhum grafico ainda. Adicione acima.'; listWrap.appendChild(e); return; }
      ovs.forEach(o => listWrap.appendChild(ovControls(o)));
    }
    window.Graphics.onChange(repaint); repaint();
    return c;
  }
  function ovControls(o) {
    const w = el('div', 'ov-ctrl');
    const title = o.type === 'image' ? 'Logo / Imagem' : o.type === 'scoreboard' ? 'Placar' : o.type === 'slideshow' ? 'Logos em slide' : 'Rodape animado';
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
      const sel = el('select'); ['modern', 'classic', 'minimal'].forEach(v => { const op = el('option'); op.value = v; op.textContent = v; if (o.data.design === v) op.selected = true; sel.appendChild(op); });
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
