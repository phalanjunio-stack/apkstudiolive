/* ============================================
   MODELOS (KIVO SCORE) — biblioteca de templates:
   importa a arte PNG, posiciona campos editáveis
   (nome/placar/relógio/escudos/texto) em cima dela,
   salva e põe no ar (dados ao vivo da partida).
   ============================================ */
const Modelos = (function () {
  const KEY = 'sl-templates';
  const FIELD_TYPES = [
    ['home', 'Nome Casa'], ['away', 'Nome Visitante'], ['hs', 'Placar Casa'], ['as', 'Placar Visitante'],
    ['clock', 'Relógio'], ['stage', 'Etapa'], ['added', 'Acréscimo'], ['comp', 'Competição'],
    ['homeLogo', 'Escudo Casa'], ['awayLogo', 'Escudo Visitante'], ['text', 'Texto livre'],
  ];
  const SAMPLE = { home: 'SETE LAGOAS', away: 'NOVA ESPERANÇA', hs: 2, as: 1, clock: 2700, stage: '2º TEMPO', added: 3, comp: 'Campeonato Mineiro' };

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = (l) => localStorage.setItem(KEY, JSON.stringify(l));
  function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function pick(accept, cb) { const i = el('input'); i.type = 'file'; i.accept = accept; i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f); }; i.click(); }
  const fmtClock = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fname = k => (FIELD_TYPES.find(x => x[0] === k) || [, '?'])[1];
  function fval(f) { if (f.key === 'text') return f.text || 'TEXTO'; if (f.key === 'clock') return fmtClock(SAMPLE.clock); if (f.key === 'added') return '+' + SAMPLE.added; if (f.key === 'homeLogo' || f.key === 'awayLogo') return ''; return SAMPLE[f.key] != null ? String(SAMPLE[f.key]) : ''; }
  function toast(m) { const t = el('div', 'toast show'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

  function defaultFields() {
    return [
      { key: 'homeLogo', x: 9, y: 50, size: 56 },
      { key: 'home', x: 31, y: 50, size: 26, color: '#0b1220', weight: 800, align: 'center' },
      { key: 'hs', x: 47, y: 50, size: 30, color: '#ffffff', weight: 900, align: 'center' },
      { key: 'clock', x: 50, y: 80, size: 17, color: '#ffffff', weight: 800, align: 'center' },
      { key: 'as', x: 53, y: 50, size: 30, color: '#ffffff', weight: 900, align: 'center' },
      { key: 'away', x: 69, y: 50, size: 26, color: '#0b1220', weight: 800, align: 'center' },
      { key: 'awayLogo', x: 91, y: 50, size: 56 },
    ];
  }

  // ===================== PÁGINA =====================
  function renderPage() {
    const root = el('div', 'md-page');
    const head = el('div', 'md-head');
    head.appendChild(el('p', 'hint', 'Importe a arte (PNG transparente) do seu placar/card e posicione os campos editáveis em cima. Depois é só "Pôr no ar" — os dados da partida entram sozinhos.'));
    const newBtn = el('button', 'btn-soft fb-prim', '+ Novo modelo (enviar PNG)');
    newBtn.onclick = () => pick('image/*', art => openEditor({ id: 'tpl' + Date.now(), name: 'Novo modelo', type: 'scoreboard', art, fields: defaultFields() }, true));
    head.appendChild(newBtn);
    root.appendChild(head);
    const grid = el('div', 'md-grid'); root.appendChild(grid);
    function renderGrid() {
      grid.innerHTML = '';
      const list = load();
      if (!list.length) { grid.appendChild(el('p', 'hint', 'Nenhum modelo ainda. Clique em "+ Novo modelo" e envie sua arte PNG.')); return; }
      list.forEach(t => {
        const card = el('div', 'md-card');
        card.innerHTML = '<div class="md-thumb"><img src="' + (t.art || '') + '" alt=""></div><div class="md-nm">' + (t.name || 'Modelo') + '</div>';
        const row = el('div', 'md-actions');
        const air = el('button', 'btn-soft fb-prim', 'Pôr no ar'); air.onclick = () => putOnAir(t);
        const fl = el('button', 'btn-soft', 'Disparar 6s'); fl.title = 'Aparece e some sozinho (gol/cartão)'; fl.onclick = () => putOnAirFlash(t, 6000);
        const ed = el('button', 'btn-soft', 'Editar'); ed.onclick = () => openEditor(JSON.parse(JSON.stringify(t)), false);
        const dup = el('button', 'btn-soft', 'Duplicar'); dup.onclick = () => { const c = JSON.parse(JSON.stringify(t)); c.id = 'tpl' + Date.now(); c.name = (t.name || 'Modelo') + ' (cópia)'; const l = load(); l.push(c); save(l); renderGrid(); };
        const del = el('button', 'md-x', '×'); del.onclick = () => { save(load().filter(x => x.id !== t.id)); renderGrid(); };
        row.append(air, fl, ed, dup, del); card.appendChild(row); grid.appendChild(card);
      });
    }
    renderGrid();
    root.__refresh = renderGrid;
    return root;
  }

  // ===================== EDITOR =====================
  function openEditor(tpl, isNew) {
    const ov = el('div', 'md-overlay');
    const card = el('div', 'md-editor');
    const hd = el('div', 'md-ed-head');
    const nameIn = el('input', 'md-name'); nameIn.type = 'text'; nameIn.value = tpl.name || 'Modelo'; nameIn.oninput = () => tpl.name = nameIn.value;
    const saveBtn = el('button', 'btn-soft fb-prim', 'Salvar modelo');
    saveBtn.onclick = () => { const l = load(); const i = l.findIndex(x => x.id === tpl.id); if (i >= 0) l[i] = tpl; else l.push(tpl); save(l); ov.remove(); const pg = document.querySelector('.md-page'); if (pg && pg.__refresh) pg.__refresh(); };
    const closeBtn = el('button', 'md-x', '×'); closeBtn.onclick = () => ov.remove();
    hd.append(el('span', 'md-ed-tag', isNew ? 'NOVO MODELO' : 'EDITAR MODELO'), nameIn, saveBtn, closeBtn);
    card.appendChild(hd);

    const body = el('div', 'md-ed-body');
    const stage = el('div', 'md-stage');
    const artbox = el('div', 'md-artbox');
    const art = el('img', 'md-art'); art.src = tpl.art || ''; artbox.appendChild(art);
    stage.appendChild(artbox);
    const changeArt = el('button', 'md-changeart', 'Trocar PNG'); changeArt.onclick = () => pick('image/*', src => { tpl.art = src; art.src = src; }); stage.appendChild(changeArt);
    body.appendChild(stage);

    const side = el('div', 'md-side');
    side.appendChild(el('div', 'md-side-h', 'CAMPOS'));
    const addRow = el('div', 'md-addrow');
    const addSel = el('select'); FIELD_TYPES.forEach(([k, n]) => { const o = el('option'); o.value = k; o.textContent = n; addSel.appendChild(o); });
    const addBtn = el('button', 'btn-soft', '+ Adicionar');
    addBtn.onclick = () => { const k = addSel.value; tpl.fields.push({ key: k, x: 50, y: 50, size: (k === 'homeLogo' || k === 'awayLogo') ? 50 : 22, color: '#ffffff', weight: 800, align: 'center', text: k === 'text' ? 'Texto' : '' }); sel = tpl.fields.length - 1; renderFields(); };
    addRow.append(addSel, addBtn); side.appendChild(addRow);
    const props = el('div', 'md-props'); side.appendChild(props);
    body.appendChild(side);
    card.appendChild(body);
    ov.appendChild(card);
    document.body.appendChild(ov);

    let sel = -1;
    function renderFields() {
      artbox.querySelectorAll('.md-f').forEach(n => n.remove());
      tpl.fields.forEach((f, i) => {
        const sp = el('div', 'md-f' + (i === sel ? ' sel' : ''));
        sp.style.left = (f.x || 50) + '%'; sp.style.top = (f.y || 50) + '%';
        sp.style.fontSize = (f.size || 18) + 'px'; sp.style.color = f.color || '#fff'; sp.style.fontWeight = f.weight || 800; sp.style.textAlign = f.align || 'center';
        if (f.key === 'homeLogo' || f.key === 'awayLogo') sp.innerHTML = '<div class="md-f-logo" style="width:' + (f.size || 40) + 'px;height:' + (f.size || 40) + 'px">' + (f.key === 'homeLogo' ? 'C' : 'V') + '</div>';
        else sp.textContent = fval(f);
        dragF(sp, f, i); artbox.appendChild(sp);
      });
      renderProps();
    }
    function dragF(sp, f, i) {
      sp.addEventListener('pointerdown', e => {
        e.preventDefault(); sel = i; renderFields();
        const r = artbox.getBoundingClientRect(), x0 = f.x || 50, y0 = f.y || 50, px = e.clientX, py = e.clientY;
        try { sp.setPointerCapture(e.pointerId); } catch {}
        const mv = ev => { f.x = Math.max(0, Math.min(100, x0 + (ev.clientX - px) / r.width * 100)); f.y = Math.max(0, Math.min(100, y0 + (ev.clientY - py) / r.height * 100)); sp.style.left = f.x + '%'; sp.style.top = f.y + '%'; };
        const up = () => { sp.removeEventListener('pointermove', mv); sp.removeEventListener('pointerup', up); };
        sp.addEventListener('pointermove', mv); sp.addEventListener('pointerup', up);
      });
    }
    function pl(lab, node) { const w = el('label', 'md-pl', '<span>' + lab + '</span>'); w.appendChild(node); return w; }
    function renderProps() {
      props.innerHTML = '';
      if (sel < 0 || !tpl.fields[sel]) { props.appendChild(el('p', 'hint', 'Clique num campo na arte para editar — ou adicione um campo acima.')); return; }
      const f = tpl.fields[sel];
      props.appendChild(el('div', 'md-prop-h', fname(f.key)));
      const sz = el('input'); sz.type = 'range'; sz.min = '8'; sz.max = '140'; sz.value = f.size || 22; sz.oninput = () => { f.size = +sz.value; renderFields(); };
      props.appendChild(pl('Tamanho', sz));
      if (f.key !== 'homeLogo' && f.key !== 'awayLogo') {
        const col = el('input'); col.type = 'color'; col.value = f.color || '#ffffff'; col.oninput = () => { f.color = col.value; renderFields(); };
        props.appendChild(pl('Cor', col));
        const al = el('select'); ['left', 'center', 'right'].forEach(a => { const o = el('option'); o.value = a; o.textContent = a === 'left' ? 'Esquerda' : a === 'right' ? 'Direita' : 'Centro'; if ((f.align || 'center') === a) o.selected = true; al.appendChild(o); }); al.onchange = () => { f.align = al.value; renderFields(); };
        props.appendChild(pl('Alinhar', al));
        const wt = el('select'); [['400', 'Normal'], ['600', 'Médio'], ['800', 'Forte'], ['900', 'Black']].forEach(([v, n]) => { const o = el('option'); o.value = v; o.textContent = n; if ('' + (f.weight || 800) === v) o.selected = true; wt.appendChild(o); }); wt.onchange = () => { f.weight = +wt.value; renderFields(); };
        props.appendChild(pl('Peso', wt));
        if (f.key === 'text') { const tx = el('input'); tx.type = 'text'; tx.value = f.text || ''; tx.placeholder = 'Texto fixo'; tx.oninput = () => { f.text = tx.value; renderFields(); }; props.appendChild(pl('Texto', tx)); }
      }
      const rm = el('button', 'btn-soft md-rmfield', 'Remover campo'); rm.onclick = () => { tpl.fields.splice(sel, 1); sel = -1; renderFields(); };
      props.appendChild(rm);
    }
    renderFields();
  }

  function putOnAir(tpl) {
    if (!window.Graphics) return toast('Motor de gráficos indisponível.');
    // garante uma fonte de DADOS (placar oculto) p/ o template preencher nomes/placar/relógio
    if (!window.Graphics.list().some(o => o.type === 'scoreboard')) {
      const sb = window.Graphics.add('scoreboard'); window.Graphics.setVisible(sb.id, false);
    }
    const o = window.Graphics.add('template');
    window.Graphics.update(o.id, { art: tpl.art, fields: JSON.parse(JSON.stringify(tpl.fields)), name: tpl.name });
    toast('"' + (tpl.name || 'Modelo') + '" no ar — controle os dados em Futebol; ajuste a posição clicando nele no PROGRAM.');
  }
  // dispara o modelo (gol/cartão): aparece e some sozinho depois de ms
  function putOnAirFlash(tpl, ms) {
    if (!window.Graphics) return toast('Motor de gráficos indisponível.');
    if (!window.Graphics.list().some(o => o.type === 'scoreboard')) { const sb = window.Graphics.add('scoreboard'); window.Graphics.setVisible(sb.id, false); }
    const o = window.Graphics.add('template');
    window.Graphics.update(o.id, { art: tpl.art, fields: JSON.parse(JSON.stringify(tpl.fields)), name: tpl.name });
    setTimeout(() => window.Graphics.remove(o.id), ms || 6000);
    toast('"' + (tpl.name || 'Modelo') + '" disparado por ' + Math.round((ms || 6000) / 1000) + 's.');
  }

  return { renderPage };
})();
window.Modelos = Modelos;
