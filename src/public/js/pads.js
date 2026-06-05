/* ============================================
   PADS vMix — 2 grades 3x3 de números (1-9).
   - VERMELHO (acima do TAKE) = recall AO VIVO (PROGRAM).
   - VERDE  (abaixo do TAKE+Play) = recall no PREVIEW (testar antes do ar).
   Um número pode estar marcado numa CENA (chip "#") ou numa CAMADA (props "Atalho nº").
   Prioridade: cena > camada. Teclado: 1-9 = vermelho · Shift+1-9 = verde.
   + fone (🎧) nos monitores: PROGRAM = master · PREVIEW = a fonte que está no preview.
   ============================================ */
(function () {
  const G = () => window.Graphics, S = () => window.Scenes, ST = () => window.Studio, MX = () => window.Mixer;
  let airHost, prevHost, fonePrev, fonePgm, airBtns = [], prevBtns = [];

  // resolve o que está marcado no número n. Prioridade: CENA > CAMADA > LOGO(biblioteca) > FONTE
  function resolve(n) {
    const s = S(); if (s && s.list) { const sc = s.list().find(x => +x.hotkey === n); if (sc) return { kind: 'scene', id: sc.id, name: sc.name, obj: sc }; }
    const g = G(); if (g && g.list) { const ov = g.list().find(o => o.data && +o.data.hotkey === n); if (ov) return { kind: 'overlay', id: ov.id, name: (ov.data && (ov.data.name || ov.data.label)) || 'Camada', obj: ov }; }
    const B = window.Biblioteca; if (B && B.assets) { const a = B.assets().find(x => +x.hotkey === n); if (a) return { kind: 'asset', id: a.id, name: a.name, obj: a }; }
    const st = ST(); if (st && st.sourcesInfo) { const list = st.sourcesInfo().list || []; const src = list[n - 1]; if (src) return { kind: 'source', id: src.id, name: src.label, obj: src }; }
    return null;
  }
  // próximo número LIVRE ao ciclar (pula os já usados por qualquer coisa — números são únicos). 0 = nenhum.
  function nextFreeNumber(cur, selfKind, selfId) {
    cur = +cur || 0;
    for (let i = 1; i <= 10; i++) { const n = (cur + i) % 10; if (n === 0) return 0; const o = resolve(n); if (!o || (o.kind === selfKind && o.id === selfId)) return n; }
    return 0;
  }
  function assetOverlay(a) { const g = G(); return (g && g.list) ? g.list().find(o => o.data && o.data.libId === a.id) : null; }
  function sourceOverlay(id) { const g = G(); return (g && g.list) ? g.list().find(o => o.data && o.data.sourceId === id) : null; }
  // cria uma camada SÓ NO AR (global + airOnly) sem mexer no PREVIEW (não troca a cena de preview, não seleciona)
  function airCreate(g, payload, extra) {
    const ps = g.getPreviewScene ? g.getPreviewScene() : null;
    const made = window.Biblioteca.addLayer(payload, 50, 50);
    if (made) { g.update(made.id, Object.assign({ airOnly: true }, extra || {})); if (g.setOverlayScene) g.setOverlayScene(made.id, null); g.setVisible(made.id, true); }
    if (g.setPreviewScene) g.setPreviewScene(ps);   // devolve o preview como estava (a camada do ar NÃO entra no preview)
    if (g.select) g.select(null);
    return made;
  }
  function fireAir(n) {
    const r = resolve(n); if (!r) return false;
    if (r.kind === 'scene') S().air(r.id);                                // cena → liga/desliga no ar (2º clique tira do ar)
    else if (r.kind === 'overlay') G().setVisible(r.id, r.obj.visible === false);   // camada → liga/desliga no ar
    else if (r.kind === 'asset') {                                        // logo → cria SÓ NO AR (global airOnly) na 1ª vez, depois liga/desliga
      const g = G(), a = r.obj, ov = assetOverlay(a);
      if (ov) g.setVisible(ov.id, ov.visible === false);
      else airCreate(g, { kind: 'image', src: a.src, name: a.name }, { libId: a.id });
    }
    else if (r.kind === 'source') {                                       // vídeo/câmera → vai pro PROGRAM (imagem base; os logos ficam POR CIMA, não some nada); 2º clique tira do ar
      try { const st = ST().state(); if (st.program === r.id) ST().clearProgram(); else ST().setProgram(r.id); } catch (e) {}
    }
    refresh(); return true;
  }
  function firePrev(n) {
    const r = resolve(n); if (!r) return false;
    if (r.kind === 'scene') S().preview(r.id);                           // cena → carrega no PREVIEW (testar)
    else if (r.kind === 'overlay') { if (G().select) G().select(r.id); } // camada → seleciona pra ajustar no preview
    else if (r.kind === 'asset') {                                        // logo → coloca/edita no PREVIEW
      const g = G(), a = r.obj, ov = assetOverlay(a);
      if (ov) { if (g.select) g.select(ov.id); }
      else { const made = window.Biblioteca.addLayer({ kind: 'image', src: a.src, name: a.name }, 50, 50); if (made) g.update(made.id, { libId: a.id, hotkey: a.hotkey }); }
    }
    else if (r.kind === 'source') {                                       // vídeo/câmera → joga no PREVIEW (testar antes do ar); 2º clique limpa
      try { const st = ST().state(); if (st.preview === r.id && ST().clearPreview) ST().clearPreview(); else ST().setPreview(r.id); } catch (e) {}
    }
    refresh(); return true;
  }
  function isAirOn(r) {
    if (!r) return false;
    if (r.kind === 'scene') return S().active && S().active() === r.id;
    if (r.kind === 'overlay') return r.obj.visible !== false;
    if (r.kind === 'asset') { const ov = assetOverlay(r.obj); return !!(ov && ov.visible !== false); }
    if (r.kind === 'source') { const ov = sourceOverlay(r.id); return !!(ov && ov.visible !== false); }
    return false;
  }
  function isPrevOn(r) {
    if (!r) return false;
    if (r.kind === 'scene') return S().previewId && S().previewId() === r.id;
    if (r.kind === 'overlay') return G().selected && G().selected() === r.id;
    if (r.kind === 'asset') { const g = G(), ov = assetOverlay(r.obj); return !!(ov && g.selected && g.selected() === ov.id); }
    if (r.kind === 'source') { const g = G(), ov = sourceOverlay(r.id); return !!(ov && g.selected && g.selected() === ov.id); }
    return false;
  }
  function prevLabel() {
    try { const st = ST().state(), info = ST().sourcesInfo(); const s = info.list.find(x => x.id === st.preview); return s ? s.label : null; } catch (e) { return null; }
  }

  function refresh() {
    for (let n = 1; n <= 9; n++) {
      const r = resolve(n), a = airBtns[n], p = prevBtns[n]; if (!a || !p) continue;
      a.classList.toggle('bound', !!r); p.classList.toggle('bound', !!r);
      a.classList.toggle('on', isAirOn(r)); p.classList.toggle('on', isPrevOn(r));
      const KIND = { scene: 'Cena: ', overlay: 'Camada: ', asset: 'Logo: ', source: 'Fonte: ' };
      const tip = r ? (KIND[r.kind] + r.name) : ('Número ' + n + ' — livre (marque numa cena, camada ou fonte)');
      a.title = tip; p.title = tip;
    }
    const m = MX();
    if (fonePgm && m && m.getMasterMon) fonePgm.classList.toggle('on', m.getMasterMon());
    if (fonePrev && m && m.getMonitorByLabel) { const lb = prevLabel(); fonePrev.classList.toggle('on', lb ? m.getMonitorByLabel(lb) : false); }
  }

  function buildGrid(host, kind) {
    host.innerHTML = ''; const arr = [];
    for (let n = 1; n <= 9; n++) {
      const b = document.createElement('button'); b.className = 'pad-btn'; b.dataset.n = n;
      b.innerHTML = '<span class="pad-num">' + n + '</span>';
      b.onclick = () => { if (!(kind === 'air' ? fireAir : firePrev)(n)) flashEmpty(b); };
      host.appendChild(b); arr[n] = b;
    }
    return arr;
  }
  function flashEmpty(b) { b.classList.add('empty-flash'); setTimeout(() => b.classList.remove('empty-flash'), 300); }
  function toast(m) { try { const t = document.createElement('div'); t.className = 'toast show'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); } catch (e) {} }

  // ---- "Editar no ar": traz a cena do PROGRAM pro PREVIEW numa CÓPIA; edita escondido; aplicar = TAKE ----
  const EDIT_SCENE = '__editair__';
  let editing = null;   // { orig } enquanto edita no ar
  function clearEditCopies(g) { (g.listForScene ? g.listForScene(EDIT_SCENE) : []).forEach(o => g.remove(o.id)); }
  function startEditAir(btn) {
    const g = G(), s = S(); if (!g || !s) return;
    const orig = s.active ? s.active() : null;
    if (orig == null) return toast('Põe uma cena no ar primeiro pra editar');
    const src = g.listForScene ? g.listForScene(orig) : [];
    if (!src.length) return toast('A cena no ar não tem camadas pra editar');
    clearEditCopies(g);                                   // limpa restos de uma edição anterior
    src.forEach(o => g.duplicate && g.duplicate(o.id, EDIT_SCENE));
    if (g.setPreviewScene) g.setPreviewScene(EDIT_SCENE);
    editing = { orig };
    btn.classList.add('editing'); btn.innerHTML = '✓ Aplicar no ar';
    toast('Editando no PREVIEW — o ar continua igual. Clique “Aplicar” pra publicar.'); refresh();
  }
  function applyEditAir(btn) {
    const g = G(); if (!g || !editing) return; const orig = editing.orig;
    const copies = g.listForScene ? g.listForScene(EDIT_SCENE) : [];
    (g.listForScene ? g.listForScene(orig) : []).forEach(o => g.remove(o.id));      // tira as antigas do ar
    copies.forEach(o => g.setOverlayScene && g.setOverlayScene(o.id, orig));        // as cópias editadas viram as do ar
    if (g.setPreviewScene) g.setPreviewScene(null);
    endEditAir(btn); toast('Aplicado no ar ✓');
  }
  function cancelEditAir(btn) {
    const g = G(); if (!g || !editing) return;
    clearEditCopies(g); if (g.setPreviewScene) g.setPreviewScene(null);
    endEditAir(btn); toast('Edição no ar cancelada');
  }
  function endEditAir(btn) { editing = null; btn.classList.remove('editing'); btn.innerHTML = '✎ Editar no ar'; refresh(); }

  function init() {
    airHost = document.getElementById('padAir'); prevHost = document.getElementById('padPrev');
    if (!airHost || !prevHost) return;
    airBtns = buildGrid(airHost, 'air'); prevBtns = buildGrid(prevHost, 'prev');
    fonePrev = document.getElementById('monePrev'); fonePgm = document.getElementById('monePgm');
    if (fonePgm) fonePgm.onclick = () => { const m = MX(); if (m && m.toggleMasterMon) m.toggleMasterMon(); refresh(); };
    if (fonePrev) fonePrev.onclick = () => { const m = MX(), lb = prevLabel(); if (!lb) return toast('PREVIEW sem áudio pra monitorar'); if (m && m.monitorByLabel) m.monitorByLabel(lb); refresh(); };
    const eb = document.getElementById('editAirBtn');
    if (eb) { eb.onclick = () => editing ? applyEditAir(eb) : startEditAir(eb); eb.oncontextmenu = e => { e.preventDefault(); if (editing) cancelEditAir(eb); }; }
    if (G() && G().onChange) G().onChange(refresh);
    setInterval(refresh, 700);   // pega troca de cena/preview/fonte (barato: só classList em 18 botões)
    refresh();
  }

  window.Pads = { fireAir, firePrev, refresh, owner: resolve, nextFreeNumber };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
