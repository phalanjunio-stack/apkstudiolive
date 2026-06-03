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
  let host, activeId = null, openId = null, tick = null, lastProg = '';
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
  function editScene(id) { openId = (openId === id ? null : id); if (openId) setActive(id, false); render(); }     // duplo-clique → abre camadas

  // ---- painel: as camadas de UMA cena (vídeo + gráficos próprios + globais) ----
  function layersPanel(sc) {
    const box = el('div', 'sc-layers');
    const vid = el('div', 'sc-lrow sc-lvid');
    vid.append(el('span', 'sc-lic', '🎥'), el('span', 'lp-nm', srcLabel(sc.program) || '— sem fonte —'), el('span', 'sc-ltag', 'vídeo'));
    box.appendChild(vid);

    const own = (G() && G().listForScene) ? G().listForScene(sc.id) : [];
    if (!own.length) box.appendChild(el('div', 'lp-empty', 'Sem camadas próprias ainda. Com esta cena aberta, adicione em Gráficos / Modelos / Futebol — entram aqui.'));
    [...own].reverse().forEach(o => {
      const sel = G().selected && G().selected() === o.id;
      const row = el('div', 'sc-lrow lp-row' + (o.visible === false ? ' off' : '') + (sel ? ' sel' : ''));
      const eye = el('button', 'lp-eye', o.visible === false ? EYEOFF : EYE); eye.title = 'Mostrar / ocultar';
      eye.onclick = e => { e.stopPropagation(); G().setVisible(o.id, o.visible === false); };
      const nm = el('span', 'lp-nm', layerName(o));
      const up = el('button', 'lp-mini', '▲'); up.title = 'Frente'; up.onclick = e => { e.stopPropagation(); G().raise(o.id); };
      const dn = el('button', 'lp-mini', '▼'); dn.title = 'Trás'; dn.onclick = e => { e.stopPropagation(); G().lower(o.id); };
      const x = el('button', 'lp-x', '×'); x.title = 'Remover camada'; x.onclick = e => { e.stopPropagation(); G().remove(o.id); };
      row.append(eye, nm, up, dn, x);
      row.onclick = () => { if (activeId !== sc.id) setActive(sc.id, false); G().select(o.id); };
      box.appendChild(row);
    });

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
      const chip = el('div', 'sc-chip' + (s.id === activeId ? ' active' : '') + (s.id === openId ? ' open' : ''));
      const go = el('button', 'sc-go', s.name); go.title = 'Clique: ir ao ar · Duplo-clique: abrir as camadas';
      let ct = null;
      go.onclick = () => { clearTimeout(ct); ct = setTimeout(() => selectScene(s.id), 230); };
      go.ondblclick = () => { clearTimeout(ct); editScene(s.id); };
      const ed = el('button', 'sc-mini', s.id === openId ? '▾' : '▤'); ed.title = 'Abrir / fechar camadas'; ed.onclick = e => { e.stopPropagation(); editScene(s.id); };
      const ren = el('button', 'sc-mini', '✎'); ren.title = 'Renomear'; ren.onclick = e => { e.stopPropagation(); const n = prompt('Nome da cena:', s.name); if (n != null) { const l = load(); const j = l.findIndex(x => x.id === s.id); if (j >= 0) { l[j].name = n || s.name; save(l); render(); } } };
      const x = el('button', 'sc-x', '×'); x.title = 'Remover cena'; x.onclick = e => {
        e.stopPropagation();
        if (!confirm('Remover a cena "' + s.name + '"? As camadas dela viram globais (continuam, aparecendo em todas).')) return;
        if (G() && G().listForScene) G().listForScene(s.id).forEach(o => G().setOverlayScene(o.id, null)); // não perde trabalho
        save(load().filter(y => y.id !== s.id));
        if (activeId === s.id) setActive(null, false);
        if (openId === s.id) openId = null;
        render();
      };
      chip.append(go, ed, ren, x); wrap.appendChild(chip);
      if (s.id === openId) wrap.appendChild(layersPanel(s));
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
    if (G() && G().onChange) G().onChange(() => { if (openId) render(); });   // painel aberto acompanha mudanças nas camadas
    if (!tick) tick = setInterval(autoSave, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
