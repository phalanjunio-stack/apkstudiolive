/* ============================================================
   FUTEBOL · CONFIGURAÇÃO (prep antes do jogo)
   Biblioteca de times (sigla + 2 cores + escudo + elenco),
   escalação, partida atual e competição estruturada.
   Tudo salvo em localStorage e aplicado no PLACAR REAL (Graphics).
   Renderiza ACIMA do editor de camadas no menu "Futebol".
   ============================================================ */
const FutSetup = (function () {
  const TKEY = 'kivo-fut-teams', MKEY = 'kivo-fut-match';
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[m]));
  const uid = () => 't' + Math.random().toString(36).slice(2, 9);
  const initials = s => (String(s || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase());

  const teams = () => { try { return JSON.parse(localStorage.getItem(TKEY) || '[]'); } catch { return []; } };
  const saveTeams = t => { try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch {} };
  const match = () => { try { return JSON.parse(localStorage.getItem(MKEY) || '{}'); } catch { return {}; } };
  const saveMatch = m => { try { localStorage.setItem(MKEY, JSON.stringify(m)); } catch {} };

  /* ---- ponte com o placar real ---- */
  const G = () => window.Graphics;
  const sbOv = () => { const g = G(); return g ? (g.list().find(o => o.type === 'scoreboard') || null) : null; };
  function sbId() { let o = sbOv(); if (!o) { if (window.Futebol && window.Futebol.ensure) window.Futebol.ensure(); else if (G()) G().add('scoreboard'); o = sbOv(); } return o ? o.id : null; }
  function upSb(patch) { const g = G(), id = sbId(); if (g && id != null) g.update(id, patch); }
  const Dsb = () => { const o = sbOv(); return o ? o.data : {}; };

  function pickImg(cb) { const i = el('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f); }; i.click(); }
  function toast(m) { if (window.toast) return window.toast(m); const t = document.getElementById('slToast') || (() => { const x = el('div'); x.id = 'slToast'; x.style.cssText = 'position:fixed;bottom:54px;left:50%;transform:translateX(-50%);z-index:9999;background:#0c1726f2;border:1px solid var(--line2);padding:10px 16px;border-radius:11px;color:#eaf1ff;font:700 12.5px Plus Jakarta Sans,Inter,sans-serif;box-shadow:var(--shadow-pop);transition:.25s;opacity:0'; document.body.appendChild(x); return x; })(); t.textContent = m; t.style.opacity = '1'; clearTimeout(t._t); t._t = setTimeout(() => t.style.opacity = '0', 1700); }

  const blank = () => ({ id: uid(), name: '', abbr: '', c1: '#1f8bff', c2: '#0a2a55', logo: '', coach: '', squad: [] });

  /* aplica um time da biblioteca num lado do placar */
  function applyTeam(tm, side) {
    upSb(side === 'h'
      ? { home: tm.name, ch: tm.c1, homeLogo: tm.logo || '' }
      : { away: tm.name, ca: tm.c1, awayLogo: tm.logo || '' });
    const m = match(); m[side === 'h' ? 'homeId' : 'awayId'] = tm.id; saveMatch(m);
    toast((side === 'h' ? 'Casa' : 'Visitante') + ': ' + (tm.name || '—'));
  }
  function applyComp() {
    const m = match();
    const txt = [m.comp, m.round].filter(Boolean).join(' · ');
    upSb({ comp: txt });
  }

  /* =========================== RENDER =========================== */
  function render() {
    const root = el('div', 'fs-wrap');
    let editing = null; // time em edição (objeto) ou null

    /* ---------- CARD: PARTIDA ATUAL ---------- */
    const cMatch = card('PARTIDA ATUAL', ' <small>aplica direto no placar no ar</small>');
    const slots = el('div', 'fs-slots');
    function teamSlot(side) {
      const wrap = el('div', 'fs-slot');
      const d = Dsb(); const nm = side === 'h' ? d.home : d.away; const logo = side === 'h' ? d.homeLogo : d.awayLogo; const col = side === 'h' ? d.ch : d.ca;
      wrap.innerHTML = `<div class="fs-slot-lab">${side === 'h' ? 'CASA' : 'VISITANTE'}</div>`;
      const head = el('div', 'fs-slot-head');
      const crest = el('span', 'fs-crest'); crest.style.setProperty('--cc', col || '#28406b');
      if (logo) crest.innerHTML = `<img src="${logo}" alt="">`; else crest.textContent = initials(nm) || '—';
      const nmeta = el('div', 'fs-slot-meta', `<b>${esc(nm || '—')}</b>`);
      head.append(crest, nmeta); wrap.appendChild(head);
      const sel = el('select', 'fs-sel');
      sel.innerHTML = '<option value="">— escolher da biblioteca —</option>' + teams().map(t => `<option value="${t.id}">${esc(t.name)}${t.abbr ? ' (' + esc(t.abbr) + ')' : ''}</option>`).join('');
      sel.onchange = () => { const t = teams().find(x => x.id === sel.value); if (t) { applyTeam(t, side); paintSlots(); } };
      wrap.appendChild(sel);
      return wrap;
    }
    function paintSlots() { slots.innerHTML = ''; slots.append(teamSlot('h'), teamSlot('a')); }
    paintSlots();
    cMatch.appendChild(slots);

    // competição estruturada
    const comp = el('div', 'fs-comp');
    const m0 = match();
    const ci = (key, ph, val) => { const i = el('input'); i.type = 'text'; i.placeholder = ph; i.value = val || ''; i.oninput = () => { const m = match(); m[key] = i.value; saveMatch(m); applyComp(); }; return i; };
    const compLogo = el('button', 'btn-soft fs-complogo', m0.compLogo ? 'Trocar logo' : 'Logo da competição…');
    compLogo.onclick = () => pickImg(src => { const m = match(); m.compLogo = src; saveMatch(m); compLogo.textContent = 'Trocar logo'; toast('Logo da competição salvo'); });
    comp.append(
      field('Competição', ci('comp', 'Ex.: Campeonato Mineiro', m0.comp)),
      field('Rodada / fase', ci('round', 'Ex.: 5ª Rodada', m0.round)),
      field('Estádio', ci('stadium', 'Ex.: Arena MRV', m0.stadium)),
      field('Data / hora', ci('date', 'Ex.: 02/06 16:00', m0.date)),
      field('Logo', compLogo)
    );
    cMatch.appendChild(field('Competição & jogo', comp));
    root.appendChild(cMatch);

    /* ---------- CARD: ANIMAÇÃO DO GOL ---------- */
    root.appendChild(golCard());

    /* ---------- CARD: BIBLIOTECA DE TIMES ---------- */
    const newBtn = el('button', 'btn-soft fb-prim', '+ Novo time');
    const cLib = card('BIBLIOTECA DE TIMES', ' <small>cadastre uma vez, use em qualquer jogo</small>');
    cLib.querySelector('.fb-card-h').appendChild(newBtn);
    const grid = el('div', 'fs-teams');
    const editorWrap = el('div', 'fs-editor'); editorWrap.hidden = true;
    function paintLib() {
      grid.innerHTML = '';
      const ts = teams();
      if (!ts.length) { grid.appendChild(el('div', 'hint', 'Nenhum time salvo. Clique em "+ Novo time".')); return; }
      ts.forEach(t => {
        const cardEl = el('div', 'fs-team');
        const head = el('div', 'fs-team-head');
        const crest = el('span', 'fs-crest'); crest.style.setProperty('--cc', t.c1);
        if (t.logo) crest.innerHTML = `<img src="${t.logo}" alt="">`; else crest.textContent = initials(t.name) || '—';
        const info = el('div', 'fs-team-info',
          `<b>${esc(t.name) || '—'}</b><span><i class="fs-dots"><i style="background:${t.c1}"></i><i style="background:${t.c2}"></i></i>${esc(t.abbr || initials(t.name))} · ${(t.squad || []).length} jog.</span>`);
        head.append(crest, info);
        const acts = el('div', 'fs-team-acts');
        const bH = el('button', 'fs-mini', 'Casa'); bH.onclick = () => { applyTeam(t, 'h'); paintSlots(); };
        const bA = el('button', 'fs-mini', 'Visitante'); bA.onclick = () => { applyTeam(t, 'a'); paintSlots(); };
        const bE = el('button', 'fs-mini', 'Editar'); bE.onclick = () => openEditor(JSON.parse(JSON.stringify(t)));
        const bX = el('button', 'fs-mini fs-x', '×'); bX.title = 'Remover'; bX.onclick = () => { if (!confirm('Remover ' + (t.name || 'time') + '?')) return; saveTeams(teams().filter(x => x.id !== t.id)); paintLib(); paintSlots(); };
        acts.append(bH, bA, bE, bX);
        cardEl.append(head, acts); grid.appendChild(cardEl);
      });
    }
    newBtn.onclick = () => openEditor(blank());

    /* ---------- EDITOR DE TIME (com elenco) ---------- */
    function openEditor(tm) {
      editing = tm; editorWrap.hidden = false; editorWrap.innerHTML = '';
      const head = el('div', 'fs-ed-head', `<b>${teams().some(x => x.id === tm.id) ? 'Editar time' : 'Novo time'}</b>`);
      const close = el('button', 'fs-mini', 'Fechar'); close.onclick = () => { editorWrap.hidden = true; editing = null; }; head.appendChild(close);
      editorWrap.appendChild(head);

      const top = el('div', 'fs-ed-top');
      const crest = el('button', 'fs-crest fs-crest-edit'); crest.style.setProperty('--cc', tm.c1);
      const paintCrest = () => { crest.style.setProperty('--cc', tm.c1); crest.innerHTML = tm.logo ? `<img src="${tm.logo}" alt="">` : (initials(tm.name) || '+'); };
      paintCrest();
      crest.title = 'Enviar escudo (PNG)'; crest.onclick = () => pickImg(src => { tm.logo = src; paintCrest(); });
      const fields = el('div', 'fs-ed-fields');
      const fName = inp('text', 'Nome do time', tm.name, v => { tm.name = v; if (!tm.abbr) { fAbbr.value = initials(v); } paintCrest(); });
      const fAbbr = inp('text', 'Sigla (3)', tm.abbr || initials(tm.name), v => tm.abbr = v.toUpperCase().slice(0, 3)); fAbbr.maxLength = 3; fAbbr.classList.add('fs-abbr');
      const fc1 = inp('color', '', tm.c1, v => { tm.c1 = v; paintCrest(); });
      const fc2 = inp('color', '', tm.c2, v => tm.c2 = v);
      const fCoach = inp('text', 'Técnico (opcional)', tm.coach, v => tm.coach = v);
      fields.append(field('Nome', fName), field('Sigla', fAbbr), field('Cor 1', fc1), field('Cor 2', fc2), field('Técnico', fCoach));
      top.append(crest, fields); editorWrap.appendChild(top);

      // ELENCO
      const sqHead = el('div', 'fs-sq-head', '<b>ESCALAÇÃO</b> <small>número · nome · titular/reserva</small>');
      const addP = el('button', 'fs-mini', '+ Jogador'); sqHead.appendChild(addP);
      editorWrap.appendChild(sqHead);
      const sqList = el('div', 'fs-squad');
      if (!tm.squad) tm.squad = [];
      function paintSquad() {
        sqList.innerHTML = '';
        tm.squad.forEach((p, i) => {
          const row = el('div', 'fs-prow');
          const n = inp('text', 'Nº', p.n, v => p.n = v); n.classList.add('fs-pn');
          const nm = inp('text', 'Nome do jogador', p.name, v => p.name = v); nm.classList.add('fs-pname');
          const role = el('button', 'fs-role' + (p.role === 'r' ? ' res' : ''), p.role === 'r' ? 'Reserva' : 'Titular');
          role.onclick = () => { p.role = p.role === 'r' ? 't' : 'r'; role.classList.toggle('res', p.role === 'r'); role.textContent = p.role === 'r' ? 'Reserva' : 'Titular'; };
          const x = el('button', 'fs-mini fs-x', '×'); x.onclick = () => { tm.squad.splice(i, 1); paintSquad(); };
          row.append(n, nm, role, x); sqList.appendChild(row);
        });
        if (!tm.squad.length) sqList.appendChild(el('div', 'hint', 'Sem jogadores. Adicione para escolher rápido no gol/cartão/substituição ao vivo.'));
      }
      addP.onclick = () => { tm.squad.push({ n: '', name: '', role: tm.squad.filter(p => p.role !== 'r').length < 11 ? 't' : 'r' }); paintSquad(); };
      paintSquad(); editorWrap.appendChild(sqList);

      const foot = el('div', 'fs-ed-foot');
      const save = el('button', 'btn-soft fb-prim', 'Salvar time');
      save.onclick = () => {
        if (!tm.name.trim()) { toast('Dê um nome ao time'); return; }
        if (!tm.abbr) tm.abbr = initials(tm.name);
        const ts = teams(); const i = ts.findIndex(x => x.id === tm.id);
        if (i >= 0) ts[i] = tm; else ts.push(tm);
        saveTeams(ts); editorWrap.hidden = true; editing = null; paintLib();
        toast('Time salvo na biblioteca');
      };
      const useH = el('button', 'btn-soft', 'Salvar + usar na Casa');
      useH.onclick = () => { save.onclick(); applyTeam(tm, 'h'); paintSlots(); };
      foot.append(save, useH); editorWrap.appendChild(foot);
      editorWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    paintLib();
    cLib.append(editorWrap, grid);
    root.appendChild(cLib);
    return root;
  }

  /* ---- helpers visuais ---- */
  function card(title, extra) { const c = el('div', 'fb-card fs-card full'); c.appendChild(el('div', 'fb-card-h', title + (extra || ''))); return c; }
  function field(lab, node) { const w = el('label', 'fb-field', lab ? '<span>' + lab + '</span>' : ''); w.appendChild(node); return w; }
  function row(a, b) { const w = el('div', 'fs-gol-row'); w.append(a, b); return w; }

  /* ---------- card "Animação do gol" (compacto) ---------- */
  function golCard() {
    const F = window.Futebol;
    const c = card('ANIMAÇÃO DO GOL', ' <small>como o GOOOL! surge</small>');
    const cfg = (F && F.golGet) ? F.golGet() : { style: 'wave', speed: 50, hold: 1.4 };
    const LABELS = { wave: 'Subindo', drop: 'Caindo', zoom: 'Explosão', slide: 'Deslizar', neon: 'Neon' };
    const body = el('div', 'fs-gol');
    const prev = el('div', 'fs-gol-prev', '<span class="fs-gol-prev-tag">PRÉVIA</span>');
    const demo = () => { if (F && F.golDemo) F.golDemo(prev); };
    body.appendChild(prev);
    const line = (lab, ...nodes) => { const r = el('div', 'fs-gol-line'); r.appendChild(el('span', 'fs-gol-lab', lab)); nodes.forEach(n => r.appendChild(n)); return r; };
    const styles = el('div', 'fs-gol-styles');
    (F && F.golStyles ? F.golStyles : ['wave', 'drop', 'zoom', 'slide', 'neon']).forEach(s => {
      const b = el('button', 'fs-gol-style' + (s === cfg.style ? ' on' : '')); b.textContent = LABELS[s] || s; b.dataset.s = s;
      b.onclick = () => { if (F && F.golSet) F.golSet({ style: s }); styles.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.s === s)); demo(); };
      styles.appendChild(b);
    });
    body.appendChild(line('Estilo', styles));
    const sp = el('input', 'fs-gol-range'); sp.type = 'range'; sp.min = '0'; sp.max = '100'; sp.value = cfg.speed;
    const spv = el('span', 'fs-gol-v'); const updSp = () => spv.textContent = (+sp.value < 33 ? 'rápido' : (+sp.value > 66 ? 'lento' : 'normal'));
    sp.oninput = () => { if (F && F.golSet) F.golSet({ speed: +sp.value }); updSp(); }; updSp();
    body.appendChild(line('Velocidade', sp, spv));
    const hd = el('input', 'fs-gol-range'); hd.type = 'range'; hd.min = '4'; hd.max = '40'; hd.value = Math.round((cfg.hold || 1.4) * 10);
    const hdv = el('span', 'fs-gol-v'); const updHd = () => hdv.textContent = (+hd.value / 10).toFixed(1) + 's';
    hd.oninput = () => { if (F && F.golSet) F.golSet({ hold: +hd.value / 10 }); updHd(); }; updHd();
    body.appendChild(line('Tempo na tela', hd, hdv));
    const test = el('button', 'fs-gol-test', '&#9654; Testar'); test.onclick = demo;
    body.appendChild(test);
    c.appendChild(body);
    return c;
  }
  function inp(type, ph, val, on) { const i = el('input'); i.type = type; if (ph) i.placeholder = ph; if (val != null) i.value = val; i.oninput = () => on(i.value); return i; }

  return { render };
})();
window.FutSetup = FutSetup;
