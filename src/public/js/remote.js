(function () {
  const room = new URLSearchParams(location.search).get('room') || 'cam1';
  let ws = null;
  let connected = false;
  let current = (location.hash || '').replace('#', '') || 'home';
  let goalSide = 'h';
  let toastTimer = 0;
  const state = {
    ip: location.hostname || '192.168.0.50',
    sources: [],
    preview: null,
    program: null,
    music: { has: false, playing: false, title: '' },
    football: { home: 'CASA', away: 'VISITANTE', hs: 2, as: 1, clock: 2700, stage: '1º Tempo', added: 0, running: false },
  };

  const screens = {};
  document.querySelectorAll('.kr-screen').forEach(s => { screens[s.dataset.screen] = s; });

  const icon = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
    devices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h4"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    control: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17h16"/><path d="M7 17V7"/><path d="M17 17V7"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/></svg>',
    score: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h2M14 9h2M8 15h2M14 15h2"/></svg>',
    event: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z"/></svg>',
    audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19 6a9 9 0 0 1 0 12"/></svg>',
    scenes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    broadcast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13a9 9 0 0 1 9 9"/><path d="M5 7a15 15 0 0 1 15 15"/><circle cx="5" cy="18" r="2"/></svg>',
    ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-2 5H9l-2-5z"/><path d="M12 7V3M7 10L3 8M16 10l4-2M9 15l-2 4M14 15l2 4"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(8 12 12)"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h14"/><path d="M14 3l4 4-4 4"/><path d="M20 17H6"/><path d="M10 13l-4 4 4 4"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></svg>',
    whistle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="14" r="5"/><path d="M13 10l7-4v5l-6 2"/><path d="M7 4h4"/></svg>',
    glove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 13V5a2 2 0 0 1 4 0v7"/><path d="M11 12V4a2 2 0 0 1 4 0v8"/><path d="M15 13V7a2 2 0 0 1 4 0v9a6 6 0 0 1-12 0"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v4"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5z"/><rect x="2" y="5" width="14" height="14" rx="2"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a5 5 0 0 1 0 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L15 3h-4l-.4 3.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1L11 21h4l.4-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4z"/></svg>',
  };

  const tones = {
    studio: '#1689ff', football: '#20d071', audio: '#a855ff', score: '#ff8b24',
    narrator: '#31d6ff', camera: '#8d9bb3', goal: '#20d071', yellow: '#ffd338',
    red: '#ff4456', sub: '#1689ff', penalty: '#a855ff', corner: '#ff8b24',
    foul: '#31d6ff', defense: '#1689ff', end: '#dbe6f5'
  };

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function fmtClock(sec) { sec = Math.max(0, sec | 0); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
  function connText() { return connected ? '<span class="kr-dot"></span>Conectado' : '<span class="kr-dot bad"></span>Reconectando'; }
  function top(title, opts = {}) {
    const back = opts.back ? `<button class="kr-back" data-go="${opts.back}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>` : '';
    const logo = opts.logo ? `<img class="kr-logo" src="/img/kivo-icon.png" alt="Kivo">` : '';
    const right = opts.plus ? `<button class="kr-iconbtn" data-action="add-audio">${icon.plus}</button>` : (opts.settings ? `<button class="kr-iconbtn">${icon.gear}</button>` : '');
    return `<header class="kr-top">${back}${logo}<div class="kr-title"><h1>${title}</h1><small>${connText()}${opts.mode ? `<span class="kr-mode">${opts.mode}</span>` : ''}</small></div>${right}</header>`;
  }
  function nav(items, active) {
    return `<nav class="bottom-nav cols${items.length}">${items.map(it => `<button class="nav-item ${it.cls || ''} ${it.id === active ? 'active' : ''}" data-go="${it.go || it.id}">${icon[it.icon || it.id] || icon.more}<span>${it.label}</span></button>`).join('')}</nav>`;
  }
  function toast(msg) {
    const t = document.getElementById('krToast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function cmd(obj, label) {
    obj.type = 'cmd';
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
      if (label) toast(label);
    } else {
      toast('Controle sem conexao com o Studio');
    }
  }

  const homeNav = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'devices', label: 'Dispositivos', icon: 'devices', go: 'studio' },
    { id: 'link', label: 'Conexões', icon: 'link', go: 'home' },
    { id: 'more', label: 'Mais', icon: 'more', go: 'audio' },
  ];
  const workNav = [
    { id: 'football', label: 'Controle', icon: 'control', go: 'football', cls: 'green' },
    { id: 'score', label: 'Placar', icon: 'score', go: 'football' },
    { id: 'events', label: 'Eventos', icon: 'event', go: 'events', cls: 'green' },
    { id: 'audio', label: 'Áudio', icon: 'audio', go: 'audio', cls: 'green' },
    { id: 'more', label: 'Mais', icon: 'more', go: 'home' },
  ];
  const studioNav = [
    { id: 'studio', label: 'Controle', icon: 'control', go: 'studio' },
    { id: 'scenes', label: 'Cenas', icon: 'scenes', go: 'studio' },
    { id: 'audio', label: 'Áudio', icon: 'audio', go: 'audio' },
    { id: 'broadcast', label: 'Transmissão', icon: 'broadcast', go: 'studio' },
    { id: 'more', label: 'Mais', icon: 'more', go: 'home' },
  ];

  const events = [
    { id: 'goal', label: 'Gol', tone: tones.goal, icon: icon.ball, audio: true, action: () => go('goal') },
    { id: 'yellow', label: 'Amarelo', tone: tones.yellow, icon: icon.card, audio: true, action: () => cmd({ cmd: 'football', action: 'card', side: 'h', kind: 'yellow' }, 'Cartao amarelo enviado') },
    { id: 'red', label: 'Vermelho', tone: tones.red, icon: icon.card, audio: true, action: () => cmd({ cmd: 'football', action: 'card', side: 'h', kind: 'red' }, 'Cartao vermelho enviado') },
    { id: 'sub', label: 'Substituição', tone: tones.sub, icon: icon.swap, audio: true, action: () => cmd({ cmd: 'football', action: 'sub', side: 'h' }, 'Substituição enviada') },
    { id: 'penalty', label: 'Pênalti', tone: tones.penalty, icon: icon.flag, audio: true, action: () => cmd({ cmd: 'football', action: 'event', event: 'penalty' }, 'Pênalti enviado') },
    { id: 'corner', label: 'Escanteio', tone: tones.corner, icon: icon.flag, audio: true, action: () => cmd({ cmd: 'football', action: 'event', event: 'corner' }, 'Escanteio enviado') },
    { id: 'foul', label: 'Falta', tone: tones.foul, icon: icon.whistle, audio: true, action: () => cmd({ cmd: 'football', action: 'event', event: 'foul' }, 'Falta enviada') },
    { id: 'defense', label: 'Defesa', tone: tones.defense, icon: icon.glove, audio: true, action: () => cmd({ cmd: 'football', action: 'event', event: 'defense' }, 'Defesa enviada') },
    { id: 'end', label: 'Fim de Tempo', tone: tones.end, icon: icon.clock, audio: false, action: () => cmd({ cmd: 'football', action: 'stage', stage: 'Intervalo' }, 'Fim de tempo') },
  ];

  function eventButton(ev, list) {
    return `<button class="event-btn" style="--tone:${ev.tone}" data-event="${ev.id}">
      <span class="event-ico">${ev.icon}</span><span>${ev.label}</span>${ev.audio ? `<span class="speaker">${icon.speaker}</span>` : ''}
    </button>`;
  }

  function renderHome() {
    const modes = [
      ['studio', 'Modo Estúdio', 'Cenas, câmeras e transmissão', icon.broadcast, 'studio'],
      ['football', 'Modo Futebol', 'Placar, tempo e eventos', icon.ball, 'football'],
      ['audio', 'Áudio', 'Músicas, vinhetas e efeitos', icon.audio, 'audio'],
      ['score', 'Placar', 'Controle de placar e cronômetro', icon.score, 'football'],
      ['narrator', 'Narrador', 'Informações de jogo e estatísticas', icon.mic, 'events'],
      ['camera', 'Câmera Mobile', 'Use este celular como câmera', icon.camera, 'home'],
    ];
    return `${top('Kivo Remote', { logo: true })}
      <div class="kr-scroll">
        <div class="kr-section-title">Escolha o modo de controle</div>
        <div class="mode-list">${modes.map(m => `<button class="mode-card" style="--tone:${tones[m[0]]}" data-go="${m[4]}">
          <span class="mode-ico">${m[3]}</span><span class="mode-copy"><b>${m[1]}</b><span>${m[2]}</span></span><span class="chev">›</span>
        </button>`).join('')}</div>
        <div class="status-foot">
          <div class="kr-card"><span class="wifi">${icon.link}</span><div><div class="kr-muted">Conectado em:</div><b>${h(state.ip || '192.168.0.50')}</b><div class="kr-muted">Kivo Studio</div></div></div>
          <button class="settings">${icon.gear}</button>
        </div>
      </div>${nav(homeNav, 'home')}`;
  }

  function renderScoreCard() {
    const f = state.football || {};
    return `<section class="kr-card score-card">
      <div class="score-top">
        <div class="team"><span>CASA</span><span class="shield">C</span></div>
        <div class="score-mid">
          <div class="scoreline"><span class="scorebox">${f.hs ?? 2}</span><span class="score-x">x</span><span class="scorebox">${f.as ?? 1}</span></div>
          <div class="clock">${fmtClock(f.clock ?? 2700)}</div>
          <div class="period">${h(f.stage || '1º Tempo')}</div>
        </div>
        <div class="team"><span>VISITANTE</span><span class="shield">V</span></div>
      </div>
    </section>`;
  }

  function renderFootball() {
    return `${top('Kivo Remote', { logo: true, mode: 'Modo Futebol' })}
      <div class="kr-scroll">
        ${renderScoreCard()}
        <div class="kr-section-title">Cronômetro</div>
        <section class="kr-card">
          <div class="btn-row">
            <button class="kr-btn primary" data-cmd="clock-start">${icon.play}Iniciar</button>
            <button class="kr-btn" data-cmd="clock-pause">Pausar</button>
            <button class="kr-btn" data-cmd="clock-reset">Zerar</button>
          </div>
          <div class="kr-section-title">Acréscimos</div>
          <div class="add-row">${[1,2,3,4,5].map(n => `<button class="kr-btn" data-add="${n}">+${n}</button>`).join('')}</div>
        </section>
        <div class="kr-section-title">Eventos rapidos</div>
        <section class="event-grid">${events.map(e => eventButton(e)).join('')}</section>
        <div class="kr-section-title">Áudio rápido</div>
        <section class="kr-card"><div class="chips">
          <button class="chip" data-audio="torcida">${icon.speaker}Torcida</button>
          <button class="chip" data-audio="gol">${icon.speaker}Grito de gol</button>
          <button class="chip" data-audio="apito">${icon.whistle}Apito</button>
        </div></section>
      </div>${nav(workNav, 'football')}`;
  }

  function renderEvents() {
    return `${top('Eventos Rápidos', { back: 'football', settings: true })}
      <div class="kr-scroll">
        <section class="event-list">${events.map(e => eventButton(e, true)).join('')}</section>
        <div class="kr-section-title">Áudio / Comemoração</div>
        <section class="kr-card">
          <div class="audio-name">Torcida Casa</div>
          <div class="range-row"><span>${icon.speaker}</span><div class="range" style="--pct:80%"></div><b>80%</b></div>
        </section>
      </div>${nav(workNav, 'events')}`;
  }

  function renderGoal() {
    return `${top('Gol', { back: 'events' })}
      <div class="kr-scroll">
        <div class="kr-section-title">Gol para quem?</div>
        <div class="choice">
          <button data-side="h" class="${goalSide === 'h' ? 'active' : ''}">Casa</button>
          <button data-side="a" class="${goalSide === 'a' ? 'active' : ''}">Visitante</button>
        </div>
        <div class="field"><label>Jogador</label><input id="goalPlayer" value="9. Hulk" /></div>
        <div class="kr-section-title">Ações</div>
        <section class="check-list">
          ${['Atualizar placar','Tocar comemoração','Mostrar card de gol no ar','Registrar no histórico','Tocar patrocinador depois'].map((t,i) => `<div class="check-row"><span class="box ${i < 4 ? 'on' : ''}">${i < 4 ? '&#10003;' : ''}</span>${t}</div>`).join('')}
        </section>
        <div class="kr-section-title">Comemoração</div>
        <section class="kr-card">
          <div class="selectish">Música de gol Casa</div>
          <div style="height:12px"></div>
          <div class="range-row"><span>${icon.speaker}</span><div class="range" style="--pct:80%"></div><b>80%</b></div>
        </section>
        <button class="kr-btn primary" data-confirm-goal style="width:100%;min-height:58px;margin-top:14px;font-size:15px">${icon.ball}Confirmar Gol</button>
      </div>${nav(workNav, 'events')}`;
  }

  const audioItems = [
    ['Música de gol Casa','80%'], ['Música de gol Visitante','80%'], ['Torcida','70%'], ['Grito de gol','80%'],
    ['Vinheta de abertura','70%'], ['Vinheta de intervalo','70%'], ['Vinheta fim de jogo','70%'], ['Apito','60%']
  ];
  function renderAudio() {
    return `${top('Áudio & Vinhetas', { back: 'home', plus: true })}
      <div class="kr-scroll">
        <div class="tabs"><button class="tabseg active">Áudios</button><button class="tabseg">Vinhetas</button></div>
        <section class="audio-list">${audioItems.map((a,i) => {
          const pct = parseInt(a[1], 10);
          return `<button class="audio-row" data-audio-row="${i}">
            <span class="play">${icon.play}</span>
            <span><div class="audio-name">${a[0]}</div><div class="range" style="--pct:${pct}%"></div></span>
            <span class="pct">${a[1]}<br>⋮</span>
          </button>`;
        }).join('')}</section>
        <button class="kr-btn blue" data-action="add-audio" style="width:100%;min-height:56px;margin-top:14px">${icon.plus}Adicionar Áudio</button>
      </div>${nav(workNav, 'audio')}`;
  }

  function renderStudio() {
    const scenes = ['Principal', 'Replay', 'Entrevista', 'Intervalo', 'Patrocinador'];
    return `${top('Modo Estúdio', { logo: true, settings: true })}
      <div class="kr-scroll">
        <section class="kr-card">
          <div class="studio-preview">
            <div class="mini-mon"><span>Preview</span></div>
            <div class="arrow-mid">⇄</div>
            <div class="mini-mon program"><span>Program</span></div>
          </div>
          <div class="studio-actions">
            <button class="kr-btn blue" data-studio="fade" style="min-height:58px;font-size:16px">TAKE</button>
            <button class="kr-btn" data-studio="take" style="min-height:58px;font-size:16px">CUT</button>
            <button class="kr-btn" data-studio="fade" style="min-height:58px;font-size:16px">AUTO</button>
          </div>
        </section>
        <div class="kr-section-title">Cenas <span class="kr-muted">Ver todas</span></div>
        <section class="scene-list">${scenes.map((s,i) => `<button class="scene-row ${i === 0 ? 'active' : ''}" data-scene="${s}"><span class="scene-no">${String(i+1).padStart(2,'0')}</span><span>${s}</span></button>`).join('')}</section>
        <div class="kr-section-title">Áudio rápido</div>
        <section class="audio-quick">
          <button class="mini-tile">${icon.mic}<span>Mic 1</span><span class="on">ON</span></button>
          <button class="mini-tile">${icon.mic}<span>Mic 2</span><span class="off">OFF</span></button>
          <button class="mini-tile">${icon.audio}<span>Música</span><span class="music">70%</span></button>
        </section>
        <button class="kr-btn gold" data-audio="vinheta" style="width:100%;margin-top:10px;min-height:52px">${icon.speaker}Tocar Vinheta</button>
      </div>${nav(studioNav, 'studio')}`;
  }

  function render() {
    screens.home.innerHTML = renderHome();
    screens.football.innerHTML = renderFootball();
    screens.events.innerHTML = renderEvents();
    screens.goal.innerHTML = renderGoal();
    screens.audio.innerHTML = renderAudio();
    screens.studio.innerHTML = renderStudio();
    Object.entries(screens).forEach(([name, el]) => el.classList.toggle('is-active', name === current));
  }

  function go(screen) {
    if (!screens[screen]) screen = 'home';
    current = screen;
    if (location.hash !== '#' + screen) history.replaceState(null, '', '#' + screen);
    render();
  }

  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const goBtn = e.target.closest('[data-go]');
      if (goBtn) { go(goBtn.dataset.go); return; }

      const eventBtn = e.target.closest('[data-event]');
      if (eventBtn) {
        const ev = events.find(x => x.id === eventBtn.dataset.event);
        if (ev) ev.action();
        return;
      }

      const side = e.target.closest('[data-side]');
      if (side) { goalSide = side.dataset.side; render(); setTimeout(() => document.getElementById('goalPlayer')?.focus(), 0); return; }

      if (e.target.closest('[data-confirm-goal]')) {
        const player = document.getElementById('goalPlayer')?.value || '';
        cmd({ cmd: 'football', action: 'goal', side: goalSide, player }, 'Gol confirmado');
        go('football');
        return;
      }

      const c = e.target.closest('[data-cmd]');
      if (c) {
        const map = { 'clock-start': ['clock', 'start'], 'clock-pause': ['clock', 'pause'], 'clock-reset': ['clock', 'reset'] };
        const m = map[c.dataset.cmd];
        if (m) cmd({ cmd: 'football', action: m[0], mode: m[1] }, c.textContent.trim());
        return;
      }

      const add = e.target.closest('[data-add]');
      if (add) { cmd({ cmd: 'football', action: 'added', minutes: +add.dataset.add }, '+' + add.dataset.add + ' acrescimo'); return; }

      const audio = e.target.closest('[data-audio], [data-audio-row]');
      if (audio) {
        const name = audio.dataset.audio || audio.textContent.trim();
        cmd({ cmd: 'music', action: name === 'next' ? 'next' : 'toggle' }, 'Áudio: ' + name);
        return;
      }

      const st = e.target.closest('[data-studio]');
      if (st) {
        cmd({ cmd: st.dataset.studio === 'take' ? 'take' : 'fade' }, st.textContent.trim());
        return;
      }

      const scene = e.target.closest('[data-scene]');
      if (scene) { toast('Cena pronta: ' + scene.dataset.scene); return; }

      if (e.target.closest('[data-action="add-audio"]')) { toast('Adicionar audio pelo Studio em breve'); }
    });
  }

  function connect() {
    try { ws && ws.close(); } catch {}
    ws = new WebSocket('wss://' + location.host + '/ws');
    ws.onopen = () => {
      connected = true;
      ws.send(JSON.stringify({ type: 'join', role: 'control', room }));
      render();
    };
    ws.onclose = () => {
      connected = false;
      render();
      setTimeout(connect, 1400);
    };
    ws.onmessage = ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'state') {
        state.sources = msg.sources || state.sources;
        state.preview = msg.preview || null;
        state.program = msg.program || null;
        state.music = msg.music || state.music;
        state.football = Object.assign({}, state.football, msg.football || {});
        render();
      }
    };
  }

  render();
  bindGlobal();
  connect();
})();
