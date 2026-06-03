/* ============================================
   CENAS — estilo OBS, robusto.
   Cada cena guarda: a FONTE no ar + quais gráficos estão visíveis.
   Clica = aplica ao ar (troca a fonte + mostra/esconde os gráficos).
   Edita à vontade enquanto a cena está ativa → salva sozinho.
   ============================================ */
(function () {
  const KEY = 'sl-scenes', AKEY = 'sl-scene-active';
  let host, activeId = null, tick = null, lastSig = '';
  try { activeId = localStorage.getItem(AKEY) || null; } catch {}

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = l => localStorage.setItem(KEY, JSON.stringify(l));
  function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function toast(m) { const t = el('div', 'toast show'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

  const progId = () => (window.Studio && window.Studio.state) ? window.Studio.state().program : null;
  const ovList = () => (window.Graphics && window.Graphics.list) ? window.Graphics.list() : [];
  function visMap() { const m = {}; ovList().forEach(o => m[o.id] = (o.visible !== false)); return m; }
  function curState() { return { program: progId(), vis: visMap() }; }
  function applyState(s) {
    if (s.program != null && window.Studio && window.Studio.setProgram) window.Studio.setProgram(s.program);
    if (window.Graphics && window.Graphics.setVisible) { const vis = s.vis || {}; ovList().forEach(o => { if (o.id in vis) window.Graphics.setVisible(o.id, vis[o.id]); }); }
  }
  const sigOf = st => { try { return JSON.stringify(st); } catch { return ''; } };

  function autoSave() {
    if (!activeId) return;
    const l = load(); const i = l.findIndex(x => x.id === activeId);
    if (i < 0) { activeId = null; return; }
    const st = curState(), sig = sigOf(st);
    if (sig !== lastSig) { l[i].program = st.program; l[i].vis = st.vis; save(l); lastSig = sig; }
  }
  function setActive(id, apply) {
    activeId = id; try { localStorage.setItem(AKEY, id || ''); } catch {}
    const sc = load().find(x => x.id === id);
    if (sc && apply) { applyState(sc); toast('▶ Cena "' + sc.name + '" no ar'); }
    lastSig = sigOf(curState());
  }
  function newScene() {
    const l = load(); const name = prompt('Nome da nova cena:', 'Cena ' + (l.length + 1)); if (name == null) return;
    const sc = Object.assign({ id: 'sc' + Date.now(), name: name || ('Cena ' + (l.length + 1)) }, curState());
    l.push(sc); save(l); setActive(sc.id, false); render();
  }
  function selectScene(id) { if (!load().some(x => x.id === id)) return; setActive(id, true); render(); }

  function render() {
    if (!host) return; const list = load(); host.innerHTML = '';
    const add = el('button', 'btn-soft fb-prim sc-save', '+ Nova cena'); add.onclick = newScene; host.appendChild(add);
    if (!list.length) { host.appendChild(el('div', 'lp-empty', 'Monte a tela (fonte no ar + gráficos) e clique "+ Nova cena". Crie outra diferente e alterne — cada clique vai ao ar.')); return; }
    const grid = el('div', 'sc-grid');
    list.forEach(s => {
      const chip = el('div', 'sc-chip' + (s.id === activeId ? ' active' : ''));
      const go = el('button', 'sc-go', s.name); go.title = 'Ir ao ar com esta cena'; go.onclick = () => selectScene(s.id);
      const ren = el('button', 'sc-mini', '✎'); ren.title = 'Renomear'; ren.onclick = e => { e.stopPropagation(); const n = prompt('Nome da cena:', s.name); if (n != null) { const l = load(); const j = l.findIndex(x => x.id === s.id); if (j >= 0) { l[j].name = n || s.name; save(l); render(); } } };
      const x = el('button', 'sc-x', '×'); x.title = 'Remover'; x.onclick = e => { e.stopPropagation(); save(load().filter(y => y.id !== s.id)); if (activeId === s.id) activeId = null; render(); };
      chip.append(go, ren, x); grid.appendChild(chip);
    });
    host.appendChild(grid);
  }

  window.Scenes = { list: () => load(), apply: (id) => selectScene(id), active: () => activeId, render: () => render() };

  function init() {
    host = document.getElementById('scenesPanel'); if (!host) return;
    render();
    lastSig = sigOf(curState());
    if (!tick) tick = setInterval(autoSave, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
