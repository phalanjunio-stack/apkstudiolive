/* ============================================
   CENAS — estilo OBS, INDEPENDENTES e robustas.
   Cada cena tem suas PRÓPRIAS camadas (cada gráfico tem dono = id da cena)
   + a fonte (program). Trocar de cena só MOSTRA as camadas da cena ativa
   (+ as globais) e esconde o resto — não destrói/recria nada (era isso que
   bugava antes). Camadas "globais" (sem dono) aparecem em todas as cenas.
     • clique simples  = manda a cena pro ar
     • duplo-clique     = abre as camadas da cena (vídeo, logos, escritas)
   ============================================ */
(function () {
  const KEY = 'sl-scenes', AKEY = 'sl-scene-active';
  let host, activeId = null, tick = null, lastProg = '';
  let modalScene = null, prevActive = null, seVid = null, seHost = null, seSide = null, seTick = null;
  try { activeId = localStorage.getItem(AKEY) || null; } catch {}

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = l => localStorage.setItem(KEY, JSON.stringify(l));
  function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function toast(m) { const t = el('div', 'toast show'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

  const G = () => window.Graphics;
  const progId = () => (window.Studio && window.Studio.state) ? window.Studio.state().program : null;
  function srcLabel(id) {
    if (id == null) return null;
    try { const s = window.Studio.sourcesInfo().list.find(x => x.id === id); return s ? s.label : null; } catch { return null; }
  }

  const EYE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYEOFF = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.9 17.9A10 10 0 0 1 12 19C5 19 1 12 1 12a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const LTYPE = { image: 'Logo / Imagem', scoreboard: 'Placar', slideshow: 'Slideshow', ticker: 'Rodapé', template: 'Modelo', text: 'Escrita', video: 'Vídeo (PiP)' };
  const layerName = o => (o.type === 'template' && o.data && o.data.name) ? o.data.name : (LTYPE[o.type] || 'Camada');

  // ---- ativa uma cena: mostra as camadas dela (+ globais); opcionalmente troca a fonte (vai ao ar) ----
  function setActive(id, air) {
    activeId = id || null; try { localStorage.setItem(AKEY, activeId || ''); } catch {}
    if (G() && G().setActiveScene) G().setActiveScene(activeId);
    const sc = load().find(x => x.id === id);
    if (sc && air) {
      if (sc.program != null && window.Studio && window.Studio.setProgram) window.Studio.setProgram(sc.program);
      toast('▶ Cena "' + sc.name + '" no ar');
    }
    lastProg = String(progId() || '');
  }

  function newScene() {
    const l = load(); const name = prompt('Nome da nova cena:', 'Cena ' + (l.length + 1)); if (name == null) return;
    const sc = { id: 'sc' + Date.now(), name: name || ('Cena ' + (l.length + 1)), program: progId() };
    l.push(sc); save(l); openId = sc.id; setActive(sc.id, false); render();
    toast('Cena criada. Adicione logos/escritas em Gráficos ou Modelos — elas entram nesta cena.');
  }
  function selectScene(id) { if (!load().some(x => x.id === id)) return; setActive(id, true); render(); }        // clique simples → ao ar
  function editScene(id) { openEditor(id); }                                                                      // duplo-clique → editor (modal, fora do ar)

  // ---- menu flutuante simples (reaproveita o estilo .add-menu) ----
  function miniMenu(ev, items) {
    const old = document.getElementById('scMenu'); if (old) old.remove();
    const m = el('div', 'add-menu'); m.id = 'scMenu';
    items.forEach(([label, fn]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = (e) => { e.stopPropagation(); m.remove(); fn(); }; m.appendChild(b); });
    document.body.appendChild(m);
    const r = (ev.currentTarget || ev.target).getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 250)) + 'px';
    m.style.top = (r.bottom + 6) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', h, true); } }, true), 0);
  }
  function saveProgram(id, p) { const l = load(); const i = l.findIndex(x => x.id === id); if (i >= 0) { l[i].program = p; save(l); lastProg = String(p || ''); } }
  function pickImg(id) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const f = i.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => G().update(id, { src: rd.result }); rd.readAsDataURL(f); }; i.click(); }
  function sourceMenu(ev, sc) {
    const items = []; let srcs = []; try { srcs = window.Studio.sourcesInfo().list; } catch {}
    srcs.forEach(s => items.push([(s.id === sc.program ? '● ' : '    ') + (s.label || s.id), () => { if (window.Studio.setProgram) window.Studio.setProgram(s.id); saveProgram(sc.id, s.id); render(); }]));
    items.push(['➕  Adicionar fonte…', () => { if (window.Studio.openAddMenu) window.Studio.openAddMenu(ev); }]);
    miniMenu(ev, items);
  }
  function addLayerMenu(ev, sc, modal) {
    if (!modal && activeId !== sc.id) setActive(sc.id, false);
    const A = t => { if (G().setActiveScene) G().setActiveScene(sc.id); return G().add(t); };
    miniMenu(ev, [
      ['✍️  Texto / Escrita', () => { A('text'); render(); }],
      ['🖼️  Logo / Imagem', () => { const o = A('image'); pickImg(o.id); render(); }],
      ['📹  Vídeo PiP', () => { const o = A('video'); const st = window.Studio.state(); G().update(o.id, { sourceId: st.preview || st.program || null }); render(); }],
      ['🏆  Placar', () => { A('scoreboard'); render(); }],
      ['📊  Rodapé', () => { A('ticker'); render(); }],
    ]);
  }
  function dupMenu(ev, o, sc) {
    const scenes = load();
    const items = [['⧉  Duplicar nesta cena', () => { G().duplicate(o.id, sc.id); render(); }]];
    scenes.filter(x => x.id !== sc.id).forEach(x => items.push(['→  Copiar p/ "' + x.name + '"', () => { G().duplicate(o.id, x.id); toast('Copiada p/ "' + x.name + '" — mesma posição'); render(); }]));
    miniMenu(ev, items);
  }

  // ===== EDITOR DE CENA (modal, FORA DO AR) =====
  // Enquanto o modal está aberto, as camadas são desenhadas no canvas do modal
  // (Graphics.setHost), não no PROGRAM. "Pôr no ar" devolve pro PROGRAM.
  function fmtRatio() { try { return ({ '16:9': '16/9', '9:16': '9/16', '1:1': '1/1', '4:5': '4/5' })[document.querySelector('.dash').dataset.format] || '16/9'; } catch { return '16/9'; } }
  function modalSourceMenu(ev, sc) {
    const items = []; let srcs = []; try { srcs = window.Studio.sourcesInfo().list; } catch {}
    srcs.forEach(s => items.push([(s.id === sc.program ? '● ' : '    ') + (s.label || s.id), () => { saveProgram(sc.id, s.id); seRender(); }]));
    items.push(['➕  Adicionar fonte…', () => { if (window.Studio.openAddMenu) window.Studio.openAddMenu(ev); }]);
    miniMenu(ev, items);
  }
  function seRefreshVid() {
    if (!seVid || !modalScene) return;
    let stream = null; try { const s = window.Studio.sourcesInfo().list.find(x => x.id === modalScene.program); stream = s ? s.stream : null; } catch {}
    const emp = document.getElementById('seEmpty');
    if (stream) { if (seVid.srcObject !== stream) { seVid.srcObject = stream; seVid.play && seVid.play().catch(() => {}); } seVid.style.display = ''; if (emp) emp.style.display = 'none'; }
    else { if (seVid.srcObject) seVid.srcObject = null; seVid.style.display = 'none'; if (emp) emp.style.display = 'flex'; }
  }
  function seRender() {
    if (!seSide || !modalScene) return;
    modalScene = load().find(x => x.id === modalScene.id) || modalScene;
    seSide.innerHTML = ''; seSide.appendChild(layersPanel(modalScene, true));
    seRefreshVid();
  }
  function seEsc(e) { if (e.key === 'Escape' && modalScene) { e.stopPropagation(); closeEditor(); } }
  function openEditor(id) {
    const sc = load().find(x => x.id === id); if (!sc) return;
    if (modalScene) closeEditor();
    modalScene = sc; prevActive = activeId;
    const ov = el('div', 'modal-overlay se-overlay'); ov.id = 'seModal';
    ov.innerHTML = '<div class="se-modal"><div class="se-head"><b>Montar cena — <span class="se-nm"></span></b>'
      + '<div class="se-actions"><button class="se-air">▸ Pôr no ar</button><button class="modal-close se-x" aria-label="Fechar">&times;</button></div></div>'
      + '<div class="se-body"><div class="se-stagewrap"><div class="se-stage" id="seStage">'
      + '<video class="se-vid" id="seVid" autoplay playsinline muted></video>'
      + '<div class="se-empty" id="seEmpty">Sem fonte — escolha ao lado &#9656;</div><div class="se-ovs" id="seOvs"></div>'
      + '</div></div><div class="se-side" id="seSide"></div></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.se-nm').textContent = sc.name;
    ov.querySelector('.se-stage').style.aspectRatio = fmtRatio();
    ov.querySelector('.se-x').onclick = closeEditor;
    ov.querySelector('.se-air').onclick = putOnAir;
    ov.addEventListener('pointerdown', e => { if (e.target === ov) closeEditor(); });
    document.addEventListener('keydown', seEsc, true);
    seVid = ov.querySelector('#seVid'); seHost = ov.querySelector('#seOvs'); seSide = ov.querySelector('#seSide');
    if (G() && G().setHost) G().setHost(seHost);            // camadas vão pro canvas do modal (fora do PROGRAM)
    if (G() && G().setActiveScene) G().setActiveScene(sc.id);
    seRender();
    if (!seTick) seTick = setInterval(seRefreshVid, 700);
  }
  function putOnAir() {
    const sc = modalScene; if (!sc) return;
    if (G() && G().setHost) G().setHost(document.getElementById('pgmOverlay'));   // devolve as camadas pro PROGRAM
    if (G() && G().setActiveScene) G().setActiveScene(sc.id);
    if (sc.program != null && window.Studio && window.Studio.setProgram) window.Studio.setProgram(sc.program);
    activeId = sc.id; try { localStorage.setItem(AKEY, sc.id); } catch {}
    lastProg = String(sc.program || '');
    toast('▶ Cena "' + sc.name + '" no ar'); teardown(); render();
  }
  function closeEditor() {
    if (!modalScene) return teardown();
    if (G() && G().setHost) G().setHost(document.getElementById('pgmOverlay'));   // camadas voltam pro PROGRAM
    if (G() && G().setActiveScene) G().setActiveScene(prevActive);                // restaura a cena que estava no ar
    teardown(); render();
  }
  function teardown() {
    if (seTick) { clearInterval(seTick); seTick = null; }
    document.removeEventListener('keydown', seEsc, true);
    const m = document.getElementById('seModal'); if (m) m.remove();
    if (seVid) { try { seVid.srcObject = null; } catch {} }
    modalScene = null; seVid = seHost = seSide = null;
  }

  // ---- painel: as camadas de UMA cena (vídeo + gráficos próprios + globais) ----
  function layersPanel(sc, modal) {
    const box = el('div', 'sc-layers');
    const vid = el('div', 'sc-lrow sc-lvid'); vid.title = 'Escolher / adicionar a fonte desta cena';
    vid.append(el('span', 'sc-lic', '🎥'), el('span', 'lp-nm', srcLabel(sc.program) || '— escolher fonte —'), el('span', 'sc-ltag', 'trocar ▾'));
    vid.onclick = (e) => modal ? modalSourceMenu(e, sc) : sourceMenu(e, sc);
    box.appendChild(vid);

    const own = (G() && G().listForScene) ? G().listForScene(sc.id) : [];
    if (!own.length) box.appendChild(el('div', 'lp-empty', 'Sem camadas próprias ainda — use "+ camada" abaixo.'));
    [...own].reverse().forEach(o => {
      const sel = G().selected && G().selected() === o.id;
      const row = el('div', 'sc-lrow lp-row' + (o.visible === false ? ' off' : '') + (sel ? ' sel' : ''));
      const eye = el('button', 'lp-eye', o.visible === false ? EYEOFF : EYE); eye.title = 'Mostrar / ocultar';
      eye.onclick = e => { e.stopPropagation(); G().setVisible(o.id, o.visible === false); };
      const nm = el('span', 'lp-nm', layerName(o));
      const up = el('button', 'lp-mini', '▲'); up.title = 'Frente'; up.onclick = e => { e.stopPropagation(); G().raise(o.id); };
      const dn = el('button', 'lp-mini', '▼'); dn.title = 'Trás'; dn.onclick = e => { e.stopPropagation(); G().lower(o.id); };
      const dup = el('button', 'lp-mini', '⧉'); dup.title = 'Duplicar / copiar p/ outra cena'; dup.onclick = e => { e.stopPropagation(); dupMenu(e, o, sc); };
      const x = el('button', 'lp-x', '×'); x.title = 'Remover camada'; x.onclick = e => { e.stopPropagation(); G().remove(o.id); };
      row.append(eye, nm, up, dn, dup, x);
      row.onclick = () => { if (!modal && activeId !== sc.id) setActive(sc.id, false); G().select(o.id); };
      box.appendChild(row);
    });
    const addb = el('button', 'sc-add'); addb.textContent = '+ camada'; addb.title = 'Adicionar nesta cena'; addb.onclick = (e) => addLayerMenu(e, sc, modal); box.appendChild(addb);

    const gl = (G() && G().globals) ? G().globals() : [];
    if (gl.length) {
      box.appendChild(el('div', 'sc-lsec', 'Em todas as cenas'));
      [...gl].reverse().forEach(o => {
        const row = el('div', 'sc-lrow lp-row sc-global');
        const claim = el('button', 'lp-mini', '↧'); claim.title = 'Trazer só pra esta cena'; claim.onclick = e => { e.stopPropagation(); G().setOverlayScene(o.id, sc.id); render(); };
        row.append(el('span', 'sc-lic', '🌐'), el('span', 'lp-nm', layerName(o)), claim);
        box.appendChild(row);
      });
    }
    return box;
  }

  function render() {
    if (!host) return; const list = load(); host.innerHTML = '';
    const add = el('button', 'btn-soft fb-prim sc-save', '+ Nova cena'); add.onclick = newScene; host.appendChild(add);
    if (!list.length) { host.appendChild(el('div', 'lp-empty', 'Crie uma cena e monte as camadas dela (logos, escritas, placar). Clique = ao ar · Duplo-clique = abrir as camadas.')); return; }
    const grid = el('div', 'sc-grid');
    list.forEach(s => {
      const wrap = el('div', 'sc-wrap');
      const chip = el('div', 'sc-chip' + (s.id === activeId ? ' active' : ''));
      const go = el('button', 'sc-go', s.name); go.title = 'Clique: ir ao ar · Duplo-clique: abrir o editor';
      let ct = null;
      go.onclick = () => { clearTimeout(ct); ct = setTimeout(() => selectScene(s.id), 230); };
      go.ondblclick = () => { clearTimeout(ct); editScene(s.id); };
      const ed = el('button', 'sc-mini', '▤'); ed.title = 'Abrir editor da cena'; ed.onclick = e => { e.stopPropagation(); editScene(s.id); };
      const ren = el('button', 'sc-mini', '✎'); ren.title = 'Renomear'; ren.onclick = e => { e.stopPropagation(); const n = prompt('Nome da cena:', s.name); if (n != null) { const l = load(); const j = l.findIndex(x => x.id === s.id); if (j >= 0) { l[j].name = n || s.name; save(l); render(); } } };
      const x = el('button', 'sc-x', '×'); x.title = 'Remover cena'; x.onclick = e => {
        e.stopPropagation();
        if (!confirm('Remover a cena "' + s.name + '"? As camadas dela viram globais (continuam, aparecendo em todas).')) return;
        if (G() && G().listForScene) G().listForScene(s.id).forEach(o => G().setOverlayScene(o.id, null)); // não perde trabalho
        save(load().filter(y => y.id !== s.id));
        if (activeId === s.id) setActive(null, false);
        render();
      };
      chip.append(go, ed, ren, x); wrap.appendChild(chip);
      grid.appendChild(wrap);
    });
    host.appendChild(grid);
  }

  window.Scenes = { list: () => load(), apply: id => selectScene(id), active: () => activeId, render: () => render() };

  function autoSave() {
    if (!activeId) return;
    const l = load(); const i = l.findIndex(x => x.id === activeId); if (i < 0) { activeId = null; return; }
    const p = String(progId() || '');
    if (p !== lastProg) { l[i].program = progId(); save(l); lastProg = p; }   // a cena lembra a fonte que estava no ar
  }

  function init() {
    host = document.getElementById('scenesPanel'); if (!host) return;
    if (G() && G().setActiveScene) G().setActiveScene(activeId);     // restaura a cena ativa ao abrir o Studio
    render();
    lastProg = String(progId() || '');
    if (G() && G().onChange) G().onChange(() => { if (modalScene) seRender(); });   // editor aberto acompanha mudanças
    if (!tick) tick = setInterval(autoSave, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
