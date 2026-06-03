/* ============================================================
   MODO FUTEBOL — deck operacional dentro do MESMO app (Studio).
   Topbar troca Modo Estúdio | Modo Futebol. No modo futebol o
   miolo abaixo dos monitores vira a central da partida, ligada
   no PLACAR REAL (overlay scoreboard do Graphics / módulo Futebol).
   ============================================================ */
(function () {
  const MKEY = 'kivo-mode';
  let deck = null, built = false;

  /* ---------- ícones ---------- */
  const I = {
    ball:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18M3 12h18M7 6l5 3 5-3M7 18l5-3 5 3"/>',
    card:'<rect x="6" y="3" width="12" height="18" rx="2"/>',
    swap:'<path d="M16 3l4 4-4 4"/><path d="M20 7H8a4 4 0 0 0-4 4"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h12a4 4 0 0 0 4-4"/>',
    pen:'<path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z"/>',
    flag:'<path d="M4 21V4M4 4c3-2 7 2 10 0s5-1 6-1v9c-1 0-3-1-6 1s-7-2-10 0"/>',
    whistle:'<circle cx="9" cy="14" r="5"/><path d="M14 11l8-3v3l-7 2M9 9V6h4"/>',
    glove:'<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V6a1.5 1.5 0 0 1 3 0v6c0 4-2 7-6 7s-6-3-6-6v-2a1.5 1.5 0 0 1 3 0"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    audio:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M16 9a3 3 0 0 1 0 6"/>',
    play:'<polygon points="6 4 20 12 6 20 6 4"/>',
    pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    dots:'<circle cx="12" cy="6" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18" r="1.4"/>',
    undo:'<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    stat:'<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="13" y="7" width="3" height="10"/>',
    reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    air:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    grip:'<circle cx="9" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
  };
  const svg = (p, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const svgf = (p, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="currentColor">${p}</svg>`;

  /* ---------- ponte com o PLACAR REAL (Graphics) ---------- */
  const G = () => window.Graphics;
  const sbOv = () => { const g = G(); return g ? (g.list().find(o => o.type === 'scoreboard') || null) : null; };
  function ensureSb() { if (window.Futebol && window.Futebol.ensure) return window.Futebol.ensure(); const g = G(); if (!g) return null; let o = sbOv(); if (!o) o = g.add('scoreboard'); return o; }
  const sbId = () => { const o = sbOv(); return o ? o.id : null; };
  const D = () => { const o = sbOv(); return o ? o.data : {}; };
  function up(patch) { const g = G(), id = sbId(); if (g && id != null) g.update(id, patch); }
  const initials = s => (String(s || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'TM');

  /* ---------- toast local ---------- */
  let tT = null;
  function toast(msg) {
    let t = document.getElementById('fmToast');
    if (!t) { t = document.createElement('div'); t.id = 'fmToast'; t.style.cssText = 'position:fixed;bottom:54px;left:50%;transform:translateX(-50%) translateY(16px);z-index:9999;opacity:0;transition:.25s;pointer-events:none'; document.body.appendChild(t); }
    t.innerHTML = `<div style="display:flex;align-items:center;gap:9px;padding:10px 16px;border-radius:11px;background:#0c1726f2;border:1px solid var(--line2);box-shadow:var(--shadow-pop);font:700 12.5px Plus Jakarta Sans,Inter,sans-serif;color:#eaf1ff;backdrop-filter:blur(10px)"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent2);box-shadow:0 0 8px var(--accent2)"></span>${msg}</div>`;
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(tT); tT = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(16px)'; }, 1800);
  }

  /* ---------- dados das listas ---------- */
  const EVENTS = [
    ['Gol', 'gol', I.ball, 1], ['Amarelo', 'amarelo', I.card, 1], ['Vermelho', 'vermelho', I.card, 1],
    ['Substituição', 'sub', I.swap, 0], ['Pênalti', 'penalti', I.pen, 1], ['Escanteio', 'escanteio', I.flag, 0],
    ['Falta', 'falta', I.whistle, 0], ['Defesa', 'defesa', I.glove, 0], ['Fim de Tempo', 'fim', I.clock, 0],
  ];
  const AUDIO = ['Música de gol (Casa)', 'Música de gol (Visitante)', 'Torcida', 'Grito de gol', 'Vinheta de abertura', 'Vinheta de intervalo', 'Vinheta fim de jogo', 'Apito'];
  const SPOTS = [['Patrocinador do gol', 1], ['Patrocinador do placar', 1], ['Patrocinador do replay', 1], ['Comercial 15s', 1], ['Oferecimento intervalo', 0]];
  const OVER = ['Placar compacto', 'Placar completo', 'Card de gol', 'Cartão amarelo', 'Cartão vermelho', 'Substituição', 'Estatísticas', 'Pré-jogo', 'Intervalo', 'Fim de jogo', 'Pênaltis', 'Patrocinador'];
  const OVICO = [I.stat, I.grid, I.ball, I.card, I.card, I.swap, I.stat, I.flag, I.clock, I.whistle, I.pen, I.pen];
  const GAMES = [['CAM', 'Atlético FC', '2 x 1', 'União Esporte', 'AO VIVO', 'l'], ['CRU', 'Cruzeiro', '1 x 0', 'América MG', 'AGENDADO', 'a'], ['MEC', 'Mineiro EC', 'x', 'Democrata GV', '20:00', 't'], ['VN', 'Villa Nova', 'x', 'Caldense', 'AMANHÃ', 't']];

  let side = 'h';                 // time atual dos eventos
  let hist = [];                  // histórico da partida (local)
  const fmt = s => { s = Math.max(0, s | 0); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const minute = () => Math.floor((D().clock || 0) / 60) + 1;

  /* ---------- monta o deck ---------- */
  function build() {
    if (built) return; built = true;
    const main = document.querySelector('.dash .main'); if (!main) return;
    deck = document.createElement('div'); deck.id = 'futDeck';
    deck.innerHTML =
      '<div class="fm-row3">' +
        // PLACAR & TIMES
        '<section class="fm-card"><div class="fm-sec"><h3>Placar &amp; Times</h3><span class="sp"></span><button class="fm-squad-btn" id="fmSquadBtn">' + svg(I.people, 13) + ' Elenco</button></div>' +
          '<div class="fm-teams">' +
            '<div class="fm-tc"><div class="lab">CASA</div>' +
              '<div class="fm-th home"><span class="fm-crest home" id="fmCH">CAM</span>' +
                '<div class="fm-name"><input id="fmInH" value="Atlético FC"/><span class="pen">' + svg(I.pen, 13) + '</span></div></div>' +
              '<div class="fm-scbig"><div class="fm-scnum" id="fmBigH">0</div></div>' +
              '<div class="fm-step"><button class="minus" data-sc="h-">−</button><button data-sc="h+">+</button></div>' +
              '<div class="fm-colr"><span class="cl">COR CASA</span><label class="fm-swatch" style="background:#1f8bff"><input type="color" value="#1f8bff" data-col="home"/></label></div></div>' +
            '<div class="fm-x">×</div>' +
            '<div class="fm-tc"><div class="lab">VISITANTE</div>' +
              '<div class="fm-th away"><span class="fm-crest away" id="fmCA">UE</span>' +
                '<div class="fm-name"><span class="pen">' + svg(I.pen, 13) + '</span><input id="fmInA" value="União Esporte"/></div></div>' +
              '<div class="fm-scbig"><div class="fm-scnum" id="fmBigA">0</div></div>' +
              '<div class="fm-step"><button class="minus" data-sc="a-">−</button><button data-sc="a+">+</button></div>' +
              '<div class="fm-colr"><span class="cl">COR VISIT.</span><label class="fm-swatch" style="background:#ff4d4f"><input type="color" value="#ff4d4f" data-col="away"/></label></div></div>' +
          '</div>' +
          '<div class="fm-meta"><div class="fm-chip"><div class="l">COMPETIÇÃO</div><input id="fmComp" value="Campeonato Mineiro"/></div>' +
            '<div class="fm-chip"><div class="l">RODADA</div><input value="5ª Rodada"/></div>' +
            '<div class="fm-chip"><div class="l">ESTÁDIO</div><input value="Arena MRV"/></div></div>' +
          '<button class="fm-air" id="fmAir">' + svg(I.air, 16) + ' MOSTRAR NO AR</button>' +
        '</section>' +

        // CRONÔMETRO
        '<section class="fm-card"><div class="fm-sec"><h3>Cronômetro</h3><span class="sp"></span><span class="fm-count" id="fmPerTag">1º TEMPO</span></div>' +
          '<div class="fm-clockw"><div class="fm-clock" id="fmClock">00:00</div><div class="fm-add" id="fmAdd">+0 ACRÉSCIMOS</div>' +
            '<div class="fm-pers">' +
              '<button class="fm-per active" data-per="1º TEMPO" data-clk="0">1º Tempo</button>' +
              '<button class="fm-per" data-per="INTERVALO" data-clk="-1">Intervalo</button>' +
              '<button class="fm-per" data-per="2º TEMPO" data-clk="2700">2º Tempo</button>' +
              '<button class="fm-per" data-per="PRORROGAÇÃO" data-clk="-1">Prorrogação</button>' +
              '<button class="fm-per" data-per="PÊNALTIS" data-clk="-1">Pênaltis</button></div>' +
            '<div class="fm-cc-row"><button class="fm-cc go" id="fmGo">' + svgf(I.play, 14) + '<span id="fmGoTx">Iniciar</span></button>' +
              '<button class="fm-cc pause" id="fmPause">' + svgf(I.pause, 14) + 'Pausar</button>' +
              '<button class="fm-cc reset" id="fmReset">' + svg(I.reset, 15) + 'Zerar</button></div>' +
            '<div class="fm-adds"><span class="l">ACRÉSCIMOS</span>' +
              '<button class="fm-addb" data-add="1">+1</button><button class="fm-addb" data-add="2">+2</button>' +
              '<button class="fm-addb" data-add="3">+3</button><button class="fm-addb" data-add="4">+4</button>' +
              '<button class="fm-addb" data-add="5">+5</button><button class="fm-end" id="fmEnd">ENCERRADO</button></div>' +
          '</div></section>' +

        // EVENTOS
        '<section class="fm-card"><div class="fm-sec"><h3>Eventos Rápidos</h3></div>' +
          '<div class="fm-side"><button data-side="h" class="on">CASA</button><button data-side="a">VISITANTE</button></div>' +
          '<div class="fm-events" id="fmEvents"></div>' +
          '<div class="fm-comem"><span class="cb">' + svg(I.ball, 16) + '</span><span class="ct">ÁUDIO / COMEMORAÇÃO</span>' +
            '<button class="fm-pm" id="fmComemPlay">' + svgf(I.play, 13) + '</button>' +
            '<div class="fm-vol" data-vol><div class="fill"></div><div class="knob"></div></div><span class="st">● ON</span></div>' +
          '<div class="fm-golctl"><span class="fm-golctl-l">⚡ GOOOL · velocidade</span>' +
            '<input type="range" id="fmGolSpeed" min="0" max="100" value="50" title="Tempo da animação (rápido ↔ lento)">' +
            '<span class="fm-golctl-v" id="fmGolSpeedV">normal</span>' +
            '<button class="fm-golctl-test" id="fmGolTest" title="Testar o efeito">' + svgf(I.play, 11) + '</button></div>' +
        '</section>' +
      '</div>' +

      '<div class="fm-row5">' +
        '<section class="fm-card"><div class="fm-sec"><h3>Áudio &amp; Vinhetas</h3></div><div class="fm-list" id="fmAudio"></div><button class="fm-addrow" data-toast="Adicionar áudio">+ Adicionar áudio</button></section>' +
        '<section class="fm-card"><div class="fm-sec"><h3>Propagandas / Spots</h3></div><div class="fm-list" id="fmSpots"></div><button class="fm-addrow" data-toast="Novo spot">+ Novo spot</button></section>' +
        '<section class="fm-card fm-card-ovl"><div class="fm-sec"><h3>Overlays Esportivos</h3></div><div class="fm-ovg" id="fmOver"></div><button class="fm-addrow" style="margin-top:9px" data-toast="Mais overlays">+ Mais overlays</button></section>' +
      '</div>';
    // insere logo após os monitores (eles continuam visíveis no topo)
    const monitors = main.querySelector('.monitors');
    if (monitors && monitors.nextSibling) main.insertBefore(deck, monitors.nextSibling);
    else main.appendChild(deck);
    fillLists(); wire(); makeCollapsible();
  }

  // cada bloco do deck ganha um botão de recolher (estado salvo)
  function makeCollapsible() {
    let st = {}; try { st = JSON.parse(localStorage.getItem('kivo-fut-collap') || '{}'); } catch {}
    const save = () => { try { localStorage.setItem('kivo-fut-collap', JSON.stringify(st)); } catch {} };
    deck.querySelectorAll('.fm-card').forEach(card => {
      const sec = card.querySelector('.fm-sec'); if (!sec || sec.querySelector('.fm-collap')) return;
      const h = sec.querySelector('h3'); const key = (h ? h.textContent : '').trim();
      const btn = document.createElement('button'); btn.className = 'fm-collap'; btn.title = 'Recolher / abrir bloco';
      btn.innerHTML = svg('<path d="M6 9l6 6 6-6"/>', 14);
      btn.onclick = () => { const c = card.classList.toggle('collapsed'); st[key] = c ? 1 : 0; save(); };
      sec.appendChild(btn);
      if (st[key]) card.classList.add('collapsed');
    });
  }

  const $f = sel => deck.querySelector(sel) || document.querySelector(sel);

  function fillLists() {
    $f('#fmEvents').innerHTML = EVENTS.map(([n, c, ic, au]) =>
      `<button class="fm-ev ${au ? 'has-au' : ''}" style="--c:var(--c-${c})" data-ev="${n}" data-c="${c}">
        <span class="fm-evic">${svg(ic, 18)}</span><span class="fm-evnm">${n.toUpperCase()}</span><span class="fm-evau">${svg(I.audio, 10)}</span></button>`).join('');
    $f('#fmAudio').innerHTML = AUDIO.map((n, i) =>
      `<div class="fm-li"><button class="fm-play" data-play>${svgf(I.play, 13)}</button><span class="nm">${n}</span>
        <div class="fm-vol" data-vol><div class="fill" style="width:${60 + ((i * 7) % 30)}%"></div><div class="knob" style="left:${60 + ((i * 7) % 30)}%"></div></div>
        <button class="fm-ics">${svg(I.audio, 14)}</button><button class="fm-ics">${svg(I.dots, 14)}</button></div>`).join('');
    $f('#fmSpots').innerHTML = SPOTS.map(([n, now]) =>
      `<div class="fm-spot"><span class="nm">${n}</span>${now ? `<button class="fm-now" data-toast="Tocando: ${n}">Tocar agora</button>` : `<button class="fm-sch" data-toast="Agendar: ${n}">Agendar</button>`}</div>`).join('');
    renderOverlays(false);
    $f('#fmGames').innerHTML = GAMES.map(([c, h, s, a, st, cl]) =>
      `<div class="fm-game ${cl === 'l' ? 'live' : ''}" data-toast="Abrir: ${h} ${s} ${a}"><span class="gc">${c}</span><span class="gn"><b>${h}</b> ${s} ${a}</span><span class="fm-gs ${cl}">${st}</span></div>`).join('');
    renderHist();
  }

  function renderHist() {
    $f('#fmHist').innerHTML = hist.map((h, i) =>
      `<div class="fm-he" style="--c:var(--c-${h.ck})"><span class="min">${h.min}'</span><span class="hic">${svg(h.ico, 14)}</span>
        <div class="htx"><div class="et">${h.name}</div><div class="ed">${h.detail}</div></div><button class="undo" data-undo="${i}">${svg(I.undo, 13)}</button></div>`).join('');
    $f('#fmHistCount').textContent = hist.length;
  }

  /* ---------- ações ---------- */
  function setScore(s, d) { const g = G(), id = sbId(); if (g && id != null) g.score(id, s, d); }
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[m]));
  const teamNameOf = s => { const d = D(); return (s === 'h' ? d.home : d.away) || (s === 'h' ? 'Casa' : 'Visitante'); };

  // ---- elenco (da biblioteca de times) p/ escolher jogador no ar ----
  const teamsLib = () => { try { return JSON.parse(localStorage.getItem('kivo-fut-teams') || '[]'); } catch { return []; } };
  const matchCfg = () => { try { return JSON.parse(localStorage.getItem('kivo-fut-match') || '{}'); } catch { return {}; } };
  function squadFor(s) { const t = teamObjFor(s); return t ? (t.squad || []) : []; }
  const pLabel = p => ((p.n ? p.n + '. ' : '') + (p.name || '')).trim();
  const saveTeamsLib = ts => { try { localStorage.setItem('kivo-fut-teams', JSON.stringify(ts)); } catch {} };
  const saveMatchCfg = m => { try { localStorage.setItem('kivo-fut-match', JSON.stringify(m)); } catch {} };
  function teamObjFor(s) { const m = matchCfg(); const id = s === 'h' ? m.homeId : m.awayId; return teamsLib().find(x => x.id === id) || null; }
  // garante um time pra guardar o elenco (cria a partir do nome atual se ainda não houver)
  function ensureTeamFor(s) {
    let t = teamObjFor(s); if (t) return t;
    const d = D(), ts = teamsLib();
    t = { id: 't' + Math.random().toString(36).slice(2, 9), name: teamNameOf(s), abbr: '', c1: (s === 'h' ? d.ch : d.ca) || '#1f8bff', c2: '#0a2a55', logo: (s === 'h' ? d.homeLogo : d.awayLogo) || '', coach: '', squad: [] };
    ts.push(t); saveTeamsLib(ts);
    const m = matchCfg(); m[s === 'h' ? 'homeId' : 'awayId'] = t.id; saveMatchCfg(m);
    return t;
  }
  function commitTeam(t) { const ts = teamsLib(); const i = ts.findIndex(x => x.id === t.id); if (i >= 0) ts[i] = t; else ts.push(t); saveTeamsLib(ts); }
  // depois de uma substituição: quem entrou (reserva) vira titular, quem saiu vira reserva
  function applySubToSquad(s, outLabel, inLabel) {
    const t = teamObjFor(s); if (!t || !t.squad) return;
    const find = lbl => t.squad.find(p => pLabel(p) === lbl);
    const po = outLabel && find(outLabel), pi = inLabel && find(inLabel);
    if (po) po.role = 'r'; if (pi) pi.role = 't';
    if (po || pi) commitTeam(t);
  }

  /* ---------- MODAL DE ELENCO (editar / adicionar jogador · puxar reserva) ---------- */
  function closeSquadModal() { const m = document.getElementById('fmSquadModal'); if (m) m.remove(); }
  function openSquadModal(initSide) {
    closeSquadModal();
    let cur = initSide || 'h';
    const ov = document.createElement('div'); ov.className = 'fm-modal-ov'; ov.id = 'fmSquadModal';
    ov.innerHTML =
      '<div class="fm-modal"><div class="fm-modal-h"><b>Elenco</b>' +
        '<div class="fm-modal-tabs"><button data-tab="h">Casa</button><button data-tab="a">Visitante</button></div>' +
        '<button class="fm-modal-x" data-close>&times;</button></div>' +
      '<div class="fm-modal-body" id="fmSqBody"></div></div>';
    document.body.appendChild(ov);
    const body = ov.querySelector('#fmSqBody');
    const mk = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

    function render() {
      const t = ensureTeamFor(cur);
      ov.querySelectorAll('.fm-modal-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === cur));
      const ti = t.squad.filter(p => p.role !== 'r'), re = t.squad.filter(p => p.role === 'r');
      body.innerHTML = '';
      const tn = mk('div', 'fm-sq-team'); tn.textContent = t.name || (cur === 'h' ? 'Casa' : 'Visitante'); body.appendChild(tn);
      const section = (label, arr, isRes) => {
        const sec = mk('div', 'fm-sq-sec'); sec.innerHTML = '<div class="fm-sq-lab">' + label + ' <span>' + arr.length + '</span></div>';
        if (!arr.length) { const e0 = mk('div', 'fm-sq-empty'); e0.textContent = isRes ? 'Sem reservas.' : 'Ninguém em campo.'; sec.appendChild(e0); }
        arr.forEach(p => {
          const row = mk('div', 'fm-sq-row');
          const n = mk('input', 'fm-sq-n'); n.value = p.n || ''; n.placeholder = 'Nº'; n.oninput = () => { p.n = n.value; commitTeam(t); };
          const nm = mk('input', 'fm-sq-name'); nm.value = p.name || ''; nm.placeholder = 'Nome'; nm.oninput = () => { p.name = nm.value; commitTeam(t); };
          const act = mk('button', 'fm-sq-act' + (isRes ? ' in' : '')); act.innerHTML = isRes ? '&#9650; Em campo' : '&#9660; Reserva';
          act.title = isRes ? 'Puxar da reserva pro jogo' : 'Mandar pra reserva';
          act.onclick = () => { p.role = isRes ? 't' : 'r'; commitTeam(t); render(); };
          const x = mk('button', 'fm-sq-x'); x.innerHTML = '&times;'; x.onclick = () => { t.squad.splice(t.squad.indexOf(p), 1); commitTeam(t); render(); };
          row.append(n, nm, act, x); sec.appendChild(row);
        });
        return sec;
      };
      body.appendChild(section('EM CAMPO', ti, false));
      body.appendChild(section('RESERVAS', re, true));
      const add = mk('div', 'fm-sq-add');
      const an = mk('input', 'fm-sq-n'); an.placeholder = 'Nº';
      const anm = mk('input', 'fm-sq-name'); anm.placeholder = 'Nome do jogador';
      const arole = mk('button', 'fm-sq-role'); arole.dataset.r = 't'; arole.textContent = 'Titular';
      arole.onclick = () => { const r = arole.dataset.r === 't' ? 'r' : 't'; arole.dataset.r = r; arole.textContent = r === 'r' ? 'Reserva' : 'Titular'; arole.classList.toggle('res', r === 'r'); };
      const ab = mk('button', 'fm-sq-addb'); ab.textContent = '+ Adicionar';
      const doAdd = () => { if (!an.value && !anm.value.trim()) return; t.squad.push({ n: an.value, name: anm.value.trim(), role: arole.dataset.r }); commitTeam(t); render(); };
      ab.onclick = doAdd; anm.onkeydown = e => { if (e.key === 'Enter') doAdd(); };
      add.append(an, anm, arole, ab); body.appendChild(add);
    }
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('[data-close]')) { closeSquadModal(); return; }
      const tb = e.target.closest('[data-tab]'); if (tb) { cur = tb.dataset.tab; render(); }
    });
    render();
  }

  function closePicker() { const m = document.getElementById('fmPicker'); if (m) { if (m._out) document.removeEventListener('pointerdown', m._out, true); m.remove(); } }
  function placePicker(m, anchor) {
    const r = anchor.getBoundingClientRect();
    m.style.left = Math.max(6, Math.min(innerWidth - m.offsetWidth - 6, r.left)) + 'px';
    let top = r.bottom + 6; if (top + m.offsetHeight > innerHeight - 6) top = Math.max(6, r.top - m.offsetHeight - 6);
    m.style.top = top + 'px';
  }
  function openPicker(html, anchor, onpick) {
    closePicker();
    const m = document.createElement('div'); m.className = 'fm-picker'; m.id = 'fmPicker'; m.innerHTML = html;
    document.body.appendChild(m); placePicker(m, anchor);
    m.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) { closePicker(); onpick(b); } });
    const out = e => { if (!m.contains(e.target) && e.target !== anchor) closePicker(); };
    m._out = out; setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
    return m;
  }
  // escolhe 1 jogador (gol/cartão). Sem elenco cadastrado → dispara direto.
  function withPlayer(s, anchor, title, cb) {
    const sq = squadFor(s);
    if (!sq.length || !anchor) { cb(''); return; }
    const ti = sq.filter(p => p.role !== 'r'), re = sq.filter(p => p.role === 'r');
    const rows = arr => arr.map(p => `<button class="fm-pk-row" data-pick data-n="${esc(pLabel(p))}"><span class="fm-pk-n">${esc(p.n || '–')}</span>${esc(p.name || '(sem nome)')}</button>`).join('');
    let h = `<div class="fm-pk-h">${title} · ${esc(teamNameOf(s))}</div><button class="fm-pk-row fm-pk-skip" data-pick data-n="">▸ Sem nome / direto</button>`;
    if (ti.length) h += `<div class="fm-pk-sec">Titulares</div>` + rows(ti);
    if (re.length) h += `<div class="fm-pk-sec">Reservas</div>` + rows(re);
    openPicker(h, anchor, b => cb(b.dataset.n || ''));
  }
  // substituição: sai + entra
  function pickSub(s, anchor, cb) {
    const sq = squadFor(s);
    if (!sq.length || !anchor) { cb('', ''); return; }
    const ti = sq.filter(p => p.role !== 'r'), re = sq.filter(p => p.role === 'r');
    const opt = arr => arr.map(p => `<option value="${esc(pLabel(p))}">${esc(pLabel(p) || '(sem nome)')}</option>`).join('');
    const h = `<div class="fm-pk-h">Substituição · ${esc(teamNameOf(s))}</div>` +
      `<label class="fm-pk-f"><span>Sai ▼</span><select data-out><option value="">—</option>${opt(ti)}${opt(re)}</select></label>` +
      `<label class="fm-pk-f"><span>Entra ▲</span><select data-in><option value="">—</option>${opt(re)}${opt(ti)}</select></label>` +
      `<button class="fm-pk-go" data-pick>Confirmar troca</button>`;
    const m = openPicker(h, anchor, () => cb(m.querySelector('[data-out]').value, m.querySelector('[data-in]').value));
  }

  function logHist(name, ck, detail, scored) {
    const ico = EVENTS.find(e => e[0] === name)[2];
    hist.unshift({ min: minute(), name, ck, ico, detail: detail || teamNameOf(side), side, scored: !!scored });
    renderHist();
    toast(name + ' · ' + (detail || teamNameOf(side)) + (EVENTS.find(e => e[0] === name)[3] ? ' · áudio ▶' : ''));
  }

  function fireEvent(name, ck, anchor) {
    const F = window.Futebol;
    if (name === 'Gol') { withPlayer(side, anchor, 'GOL', nm => { if (F && F.goal) F.goal(side, nm); else { setScore(side, 1); golFlash(); } logHist(name, ck, nm || teamNameOf(side), true); }); return; }
    if (name === 'Amarelo') { withPlayer(side, anchor, 'CARTÃO AMARELO', nm => { F && F.card && F.card(side, 'yellow', nm); logHist(name, ck, nm || teamNameOf(side)); }); return; }
    if (name === 'Vermelho') { withPlayer(side, anchor, 'CARTÃO VERMELHO', nm => { F && F.card && F.card(side, 'red', nm); logHist(name, ck, nm || teamNameOf(side)); }); return; }
    if (name === 'Substituição') { pickSub(side, anchor, (out, inn) => { F && F.sub && F.sub(side, out, inn); applySubToSquad(side, out, inn); logHist(name, ck, ((inn ? '▲ ' + inn : '') + (out ? '   ▼ ' + out : '')).trim() || teamNameOf(side)); }); return; }
    window.SoundFX && window.SoundFX.click && window.SoundFX.click();
    logHist(name, ck, teamNameOf(side));
  }
  function undoHist(i) {
    const h = hist[i]; if (!h) return;
    if (h.scored) setScore(h.side, -1);
    hist.splice(i, 1); renderHist(); toast('Evento desfeito');
  }

  // ---- ações reais dos OVERLAYS ESPORTIVOS ----
  const SCORE_OV = ['Placar compacto', 'Placar completo'];
  const TITLE_OV = ['Pré-jogo', 'Intervalo', 'Fim de jogo', 'Pênaltis', 'Estatísticas', 'Patrocinador'];
  function scoreboard(on, design) { const o = ensureSb(), g = G(); if (!o || !g) return; if (design) g.update(o.id, { design }); g.setVisible(o.id, on); const air = $f('#fmAir'); if (air) air.classList.toggle('on', on); }
  function flashOv(t) { t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 900); }
  function ovSetOff(names, except) { deck.querySelectorAll('.fm-ov').forEach(c => { if (c !== except && names.indexOf(c.dataset.ov) >= 0) c.classList.remove('on'); }); }
  function ovToggle(name, on, t) {
    const F = window.Futebol;
    if (SCORE_OV.indexOf(name) >= 0) { if (on) ovSetOff(SCORE_OV, t); scoreboard(on, name === 'Placar completo' ? 'central' : 'modern'); return; }
    if (TITLE_OV.indexOf(name) >= 0 && F && F.titleCard) {
      if (!on) { F.hideTitle(); return; }
      ovSetOff(TITLE_OV, t);
      const hs = D().hs || 0, as = D().as || 0, H = teamNameOf('h'), A = teamNameOf('a');
      if (name === 'Pré-jogo') F.titleCard('PRÉ-JOGO', H + '  x  ' + A);
      else if (name === 'Intervalo') F.titleCard('INTERVALO', H + ' ' + hs + ' x ' + as + ' ' + A, 'warn');
      else if (name === 'Fim de jogo') F.titleCard('FIM DE JOGO', H + ' ' + hs + ' x ' + as + ' ' + A, 'end');
      else if (name === 'Pênaltis') F.titleCard('DISPUTA DE PÊNALTIS', H + ' x ' + A, 'warn');
      else if (name === 'Estatísticas') F.titleCard('PLACAR', H + '  ' + hs + ' — ' + as + '  ' + A);
      else if (name === 'Patrocinador') F.titleCard('PATROCÍNIO OFICIAL', matchCfg().comp || '');
    }
  }

  // ---- prévia ao vivo + reordenar dos overlays ----
  const OV_KEY = 'kivo-fut-ov-order';
  function ovOrder() {
    try { const s = JSON.parse(localStorage.getItem(OV_KEY) || 'null'); if (Array.isArray(s)) { const v = s.filter(n => OVER.includes(n)); OVER.forEach(n => { if (!v.includes(n)) v.push(n); }); return v; } } catch {}
    return OVER.slice();
  }
  const saveOvOrder = a => { try { localStorage.setItem(OV_KEY, JSON.stringify(a)); } catch {} };
  function ovPreview(n) {
    const d = D(), hs = d.hs || 0, as = d.as || 0, H = initials(d.home) || 'CAS', A = initials(d.away) || 'VIS';
    if (n === 'Placar compacto' || n === 'Placar completo')
      return `<span class="ovp ovp-sb"><i style="--c:${d.ch || '#1f8bff'}">${esc(H)}</i><b class="ovp-hs">${hs}</b><s>×</s><b class="ovp-as">${as}</b><i style="--c:${d.ca || '#ff4d4f'}">${esc(A)}</i></span>`;
    if (n === 'Estatísticas') return `<span class="ovp ovp-sb sm"><b class="ovp-hs">${hs}</b><s>×</s><b class="ovp-as">${as}</b></span>`;
    if (n === 'Card de gol') return `<span class="ovp ovp-gol">GOOOL!</span>`;
    if (n === 'Cartão amarelo') return `<span class="ovp ovp-card y"></span>`;
    if (n === 'Cartão vermelho') return `<span class="ovp ovp-card r"></span>`;
    if (n === 'Substituição') return `<span class="ovp ovp-sub">⇄</span>`;
    if (n === 'Pré-jogo') return `<span class="ovp ovp-ti">VS</span>`;
    if (n === 'Intervalo') return `<span class="ovp ovp-ti warn">INT</span>`;
    if (n === 'Fim de jogo') return `<span class="ovp ovp-ti end">FIM</span>`;
    if (n === 'Pênaltis') return `<span class="ovp ovp-ti warn">PÊN</span>`;
    if (n === 'Patrocinador') return `<span class="ovp ovp-spon">★</span>`;
    return `<span class="ovp">${svg(I.grid, 18)}</span>`;
  }
  function renderOverlays(preserve) {
    const host = $f('#fmOver'); if (!host) return;
    const on = new Set(), locked = new Set();
    if (preserve) host.querySelectorAll('.fm-ov').forEach(c => { if (c.classList.contains('on')) on.add(c.dataset.ov); if (c.classList.contains('locked')) locked.add(c.dataset.ov); });
    host.innerHTML = ovOrder().map(n =>
      `<div class="fm-ov${on.has(n) ? ' on' : ''}${locked.has(n) ? ' locked' : ''}" data-ov="${esc(n)}" draggable="true">` +
        `<button class="fm-ov-lock" data-lock title="Travar (evita trocar sem querer)">${svg(I.lock, 12)}</button>` +
        `<span class="fm-ov-grip" title="Arraste pra reordenar">${svg(I.grip, 12)}</span>` +
        `<div class="ovp-wrap">${ovPreview(n)}</div>` +
        `<span class="bon">AO VIVO</span><span class="ovn">${esc(n)}</span></div>`).join('');
    bindOvDrag(host);
  }
  function bindOvDrag(host) {
    let dragN = null;
    host.querySelectorAll('.fm-ov').forEach(card => {
      card.addEventListener('dragstart', e => { dragN = card.dataset.ov; card.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragN); } catch {} });
      card.addEventListener('dragend', () => { dragN = null; host.querySelectorAll('.fm-ov').forEach(c => c.classList.remove('dragging', 'drop-l', 'drop-r')); });
      card.addEventListener('dragover', e => { if (dragN == null || card.dataset.ov === dragN) return; e.preventDefault(); const r = card.getBoundingClientRect(); const after = (e.clientX - r.left) > r.width / 2; card.classList.toggle('drop-r', after); card.classList.toggle('drop-l', !after); });
      card.addEventListener('dragleave', () => card.classList.remove('drop-l', 'drop-r'));
      card.addEventListener('drop', e => {
        e.preventDefault(); card.classList.remove('drop-l', 'drop-r');
        const from = dragN || (e.dataTransfer && e.dataTransfer.getData('text/plain')); if (!from || from === card.dataset.ov) return;
        const order = ovOrder(); order.splice(order.indexOf(from), 1);
        let ti = order.indexOf(card.dataset.ov); const r = card.getBoundingClientRect(); if ((e.clientX - r.left) > r.width / 2) ti++;
        order.splice(ti, 0, from); saveOvOrder(order); renderOverlays(true);
      });
    });
  }

  function wire() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-lock],[data-sc],[data-ev],[data-undo],[data-toast],[data-add],[data-side],[data-play],[data-ov],#fmAir,#fmGo,#fmPause,#fmReset,#fmEnd,#fmClearHist,.fm-per,#fmComemPlay');
      if (!t) return;
      if (t.dataset.lock != null) { const card = t.closest('.fm-ov'); if (card) { const lk = card.classList.toggle('locked'); toast(lk ? 'Overlay travado 🔒' : 'Overlay destravado'); } return; }
      if (t.dataset.toast != null) { toast(t.dataset.toast); return; }
      if (t.dataset.sc) { setScore(t.dataset.sc[0], t.dataset.sc[1] === '+' ? 1 : -1); return; }
      if (t.dataset.ev) { fireEvent(t.dataset.ev, t.dataset.c, t); return; }
      if (t.dataset.undo != null) { undoHist(+t.dataset.undo); return; }
      if (t.dataset.add) { up({ added: +t.dataset.add }); const b = $f('#fmAdd'); b.textContent = '+' + t.dataset.add + ' ACRÉSCIMOS'; b.classList.add('on'); toast('Acréscimos +' + t.dataset.add); return; }
      if (t.dataset.side) { side = t.dataset.side; deck.querySelectorAll('.fm-side button').forEach(b => b.classList.toggle('on', b === t)); return; }
      if (t.hasAttribute('data-play')) { togPlay(t); return; }
      if (t.dataset.ov != null) {
        if (t.classList.contains('locked')) { toast('Travado — destrave o cadeado 🔒'); return; }
        const name = t.dataset.ov, F = window.Futebol;
        // momentâneos: disparam e voltam (não ficam "no ar")
        if (name === 'Card de gol') { F && F.celebrate && F.celebrate(side); flashOv(t); toast('GOOOL! · ' + teamNameOf(side)); return; }
        if (name === 'Cartão amarelo') { F && F.card && F.card(side, 'yellow', ''); flashOv(t); toast('Cartão amarelo · ' + teamNameOf(side)); return; }
        if (name === 'Cartão vermelho') { F && F.card && F.card(side, 'red', ''); flashOv(t); toast('Cartão vermelho · ' + teamNameOf(side)); return; }
        if (name === 'Substituição') { flashOv(t); fireEvent('Substituição', 'sub', t); return; }
        // toggles: no ar ↔ oculta
        const on = t.classList.toggle('on');
        ovToggle(name, on, t);
        toast((on ? 'No ar: ' : 'Ocultado: ') + name);
        return;
      }
      if (t.id === 'fmComemPlay') { const on = t.classList.toggle('on'); t.innerHTML = on ? svgf(I.pause, 13) : svgf(I.play, 13); toast(on ? 'Comemoração ▶' : 'Comemoração ⏸'); return; }
      if (t.id === 'fmAir') { const o = ensureSb(); if (!o) { toast('Motor de gráficos indisponível'); return; } const g = G(); const vis = !o.visible; g.setVisible(o.id, vis); t.classList.toggle('on', vis); toast(vis ? 'Placar no ar' : 'Placar fora do ar'); return; }
      if (t.id === 'fmGo') { ensureSb(); const g = G(), id = sbId(); if (g && id != null) g.clockCtl(id, 'toggle'); return; }
      if (t.id === 'fmPause') { if (D().running) up({ running: false }); else toast('Já pausado'); return; }
      if (t.id === 'fmReset') { const g = G(), id = sbId(); if (g && id != null) g.clockCtl(id, 'reset'); $f('#fmAdd').classList.remove('on'); up({ added: 0 }); toast('Cronômetro zerado'); return; }
      if (t.id === 'fmEnd') { up({ stage: 'ENCERRADO', running: false }); toast('Partida encerrada'); return; }
      if (t.id === 'fmClearHist') { hist = []; renderHist(); toast('Histórico limpo'); return; }
      if (t.classList.contains('fm-per')) { deck.querySelectorAll('.fm-per').forEach(p => p.classList.remove('active')); t.classList.add('active'); const clk = +t.dataset.clk; up(clk >= 0 ? { stage: t.dataset.per, clock: clk } : { stage: t.dataset.per }); if (t.dataset.per === 'INTERVALO') up({ running: false }); toast(t.dataset.per); return; }
    });
    // inputs nomes/cor/competição → placar real
    $f('#fmInH').addEventListener('input', e => { up({ home: e.target.value }); paintCrest('#fmCH', D().homeLogo, e.target.value); });
    $f('#fmInA').addEventListener('input', e => { up({ away: e.target.value }); paintCrest('#fmCA', D().awayLogo, e.target.value); });
    // clicar no badge envia o ESCUDO (PNG) direto pelo deck
    [['#fmCH', 'homeLogo', 'home'], ['#fmCA', 'awayLogo', 'away']].forEach(([id, key, nmk]) => {
      const c = $f(id); if (!c) return; c.style.cursor = 'pointer'; c.title = 'Enviar escudo (PNG) · clique direito limpa';
      c.addEventListener('click', () => pickImg(src => { up({ [key]: src }); paintCrest(id, src, D()[nmk]); toast('Escudo atualizado'); }));
      c.addEventListener('contextmenu', e => { e.preventDefault(); up({ [key]: '' }); paintCrest(id, '', D()[nmk]); toast('Escudo removido'); });
    });
    const sqBtn = $f('#fmSquadBtn'); if (sqBtn) sqBtn.onclick = () => openSquadModal(side); // modal de elenco
    // controle de velocidade do GOOOL (tempo da animação)
    const gs = $f('#fmGolSpeed'), F0 = window.Futebol;
    if (gs) {
      const cfg = F0 && F0.golGet ? F0.golGet() : { speed: 50 }; gs.value = cfg.speed;
      const upd = () => { const lab = $f('#fmGolSpeedV'); if (lab) lab.textContent = (+gs.value < 33 ? 'rápido' : (+gs.value > 66 ? 'lento' : 'normal')); };
      upd();
      gs.addEventListener('input', () => { if (window.Futebol && window.Futebol.golSet) window.Futebol.golSet({ speed: +gs.value }); upd(); });
    }
    const gt = $f('#fmGolTest'); if (gt) gt.onclick = () => { const F = window.Futebol; if (F && F.celebrate) F.celebrate(side); };
    $f('#fmComp').addEventListener('input', e => up({ comp: e.target.value }));
    deck.querySelectorAll('[data-col]').forEach(inp => inp.addEventListener('input', e => {
      const which = inp.dataset.col, val = e.target.value;
      inp.parentElement.style.background = val;
      up(which === 'home' ? { ch: val } : { ca: val });
      deck.style.setProperty('--' + which, val);
    }));
    deck.querySelectorAll('[data-vol]').forEach(v => v.addEventListener('pointerdown', e => {
      const r = v.getBoundingClientRect(), p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      v.querySelector('.fill').style.width = (p * 100) + '%'; v.querySelector('.knob').style.left = (p * 100) + '%';
    }));
  }
  function togPlay(b) { const on = b.classList.toggle('on'); b.innerHTML = on ? svgf(I.pause, 13) : svgf(I.play, 13); toast(on ? 'Tocando' : 'Pausado'); }

  // flash "GOOOL!" sobre o PROGRAM (comemoração)
  function golFlash() {
    const host = document.getElementById('programMon') || document.getElementById('pgmOverlay');
    if (!host) return;
    let g = host.querySelector('.fb-golbig');
    if (!g) { g = document.createElement('div'); g.className = 'fb-golbig'; g.innerHTML = '<b>GOOOL!</b><i></i>'; host.appendChild(g); }
    g.classList.remove('on'); void g.offsetWidth; g.classList.add('on');
  }

  // mostra o ESCUDO (logo) no badge do deck; sem logo, cai nas iniciais
  function paintCrest(id, logo, nm) {
    const e = $f(id); if (!e) return;
    if (logo) { if (e._logo !== logo) { e._logo = logo; e.innerHTML = '<img src="' + logo + '" alt="">'; } }
    else { if (e._logo) { e._logo = ''; e.textContent = ''; } const t = initials(nm) || '—'; if (e.textContent !== t) e.textContent = t; }
  }
  function pickImg(cb) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f); }; i.click(); }

  function ovScore(sel, v) { const h = deck && deck.querySelector('#fmOver'); if (h) h.querySelectorAll(sel).forEach(e => { if (e.textContent != v) e.textContent = v; }); }

  /* ---------- sincroniza o deck com o placar REAL ---------- */
  let lastClk = -1, lastHs = -1, lastAs = -1;
  function sync() {
    if (!deck || !document.body.classList.contains('mode-fut')) return;
    const d = D();
    const total = (d.clock || 0);
    if (total !== lastClk) { lastClk = total; $f('#fmClock').textContent = fmt(total); }
    if ((d.hs || 0) !== lastHs) { lastHs = d.hs || 0; $f('#fmBigH').textContent = lastHs; ovScore('.ovp-hs', lastHs); }
    if ((d.as || 0) !== lastAs) { lastAs = d.as || 0; $f('#fmBigA').textContent = lastAs; ovScore('.ovp-as', lastAs); }
    paintCrest('#fmCH', d.homeLogo, d.home); paintCrest('#fmCA', d.awayLogo, d.away);
    const run = !!d.running;
    $f('#fmClock').classList.toggle('run', run);
    $f('#fmGoTx').textContent = run ? 'Correndo' : 'Iniciar';
    $f('#fmGo').style.opacity = run ? .72 : 1;
    const o = sbOv();
    $f('#fmAir').classList.toggle('on', !!(o && o.visible));
    const st = d.stage || '';
    if (st) { const tag = $f('#fmPerTag'); if (tag.textContent !== st) tag.textContent = st; }
  }

  /* ---------- modo ---------- */
  function setMode(m, silent) {
    const fut = m === 'fut';
    document.body.classList.toggle('mode-fut', fut);
    document.querySelectorAll('.kmode').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    try { localStorage.setItem(MKEY, m); } catch {}
    if (fut) {
      build();
      const had = !!sbOv(), o = ensureSb(), g = G();
      if (o && g && !had) { // placar criado agora: fica fora do ar + semeia com os valores do deck
        g.setVisible(o.id, false);
        g.update(o.id, { home: $f('#fmInH').value, away: $f('#fmInA').value, ch: '#1f8bff', ca: '#ff4d4f', comp: $f('#fmComp').value, hs: 0, as: 0 });
      }
      syncFromData();
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 60); // recalcula tamanho dos monitores
    if (!silent) { window.SoundFX && window.SoundFX.navigate && window.SoundFX.navigate(); toast(fut ? 'Modo Futebol' : 'Modo Estúdio'); }
  }
  // puxa nomes/cores que já estiverem no placar pro deck (ao entrar)
  function syncFromData() {
    if (!deck) return; const d = D();
    if (d.home) $f('#fmInH').value = d.home;
    if (d.away) $f('#fmInA').value = d.away;
    paintCrest('#fmCH', d.homeLogo, d.home); paintCrest('#fmCA', d.awayLogo, d.away);
    if (d.ch) { deck.style.setProperty('--home', d.ch); const s = deck.querySelector('[data-col="home"]'); if (s) { s.value = d.ch; s.parentElement.style.background = d.ch; } }
    if (d.ca) { deck.style.setProperty('--away', d.ca); const s = deck.querySelector('[data-col="away"]'); if (s) { s.value = d.ca; s.parentElement.style.background = d.ca; } }
    if (d.comp) $f('#fmComp').value = d.comp;
    lastClk = lastHs = lastAs = -1;
  }

  function wireModes() {
    document.querySelectorAll('.kmode').forEach(b => b.addEventListener('click', () => {
      // botão único de Futebol = liga/desliga (clicar de novo volta pro Estúdio normal)
      if (b.dataset.mode === 'fut' && document.body.classList.contains('mode-fut')) setMode('studio');
      else setMode(b.dataset.mode);
    }));
  }

  function init() {
    wireModes();
    const saved = (() => { try { return localStorage.getItem(MKEY); } catch { return null; } })();
    if (saved === 'fut') setMode('fut', true); else setMode('studio', true);
    setInterval(sync, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
