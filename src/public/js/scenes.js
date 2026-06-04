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
  let host, activeId = null, previewId = null, tick = null, lastProg = '';
  let modalScene = null, prevActive = null, seVid = null, seHost = null, seSide = null, seTick = null, seTab = 'camadas';
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
  // ícones de linha (estilo Lucide) — sem emoji, look broadcast
  const SEIC = {
    media: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    text: '<path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M9 20h6"/>',
    stickers: '<path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10l6-6V5a2 2 0 0 0-2-2Z"/><path d="M15 21v-4a2 2 0 0 1 2-2h4"/>',
    elements: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="6.5" r="3.5"/>',
    transitions: '<path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/><path d="M3 12h18"/>',
    filters: '<path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    audio: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 21"/>',
    video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M6 4v6a6 6 0 0 0 12 0V4Z"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    ticker: '<rect x="2" y="13" width="20" height="7" rx="1.5"/><path d="M5 16.5h7"/>',
    template: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    slideshow: '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
    fit: '<path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/>',
    center: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>',
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/>',
    duplicate: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    keyframe: '<path d="M12 2 22 12 12 22 2 12 12 2Z"/>',
    magnet: '<path d="M6 3v6a6 6 0 0 0 12 0V3"/><path d="M5 3h3v6H5z"/><path d="M16 3h3v6h-3z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    play: '<path d="m7 4 13 8-13 8V4Z"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    full: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    broadcast: '<circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
  };
  function seIcon(name) { return '<svg class="se-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (SEIC[name] || '') + '</svg>'; }

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
    const sc = { id: 'sc' + Date.now(), name: name || ('Cena ' + (l.length + 1)), program: null };
    l.push(sc); save(l); render(); openEditor(sc.id);   // nova cena abre no EDITOR (preview), NÃO vai pro ar
    toast('Cena criada — monte as camadas com "+ camada".');
  }
  function selectScene(id) { if (!load().some(x => x.id === id)) return; setActive(id, true); render(); }        // API: manda direto pro ar
  function loadToPreview(id) {                                                                                    // clique simples → PREVIEW (fora do ar)
    const sc = load().find(x => x.id === id); if (!sc) return;
    previewId = id;
    if (sc.program != null && window.Studio && window.Studio.setPreview) window.Studio.setPreview(sc.program);
    if (G() && G().setPreviewScene) G().setPreviewScene(id);
    render(); toast('◐ "' + sc.name + '" no PREVIEW');
  }
  function takeToAir() {                                                                                          // TAKE: preview → programa
    if (!previewId) return toast('Clique numa cena pra carregar no PREVIEW primeiro');
    setActive(previewId, true); render();
  }
  function editScene(id) { openMontarCena(id); }   // duplo-clique → editor "Montar Cena"
  function openMontarCena(id) { try { localStorage.setItem('sl-edit-scene', id || ''); } catch (e) {} location.href = 'montar-cena.html?scene=' + encodeURIComponent(id || ''); }

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
  function pickVideoFile(id) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*'; i.onchange = () => { const f = i.files[0]; if (!f) return; G().update(id, { src: URL.createObjectURL(f) }); }; i.click(); }
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
      ['📷  Câmera', () => pickCamera(ev, A)],
      ['🎬  Vídeo (arquivo)', () => { const o = A('video'); pickVideoFile(o.id); render(); }],
      ['🖼️  Imagem / Logo', () => { const o = A('image'); pickImg(o.id); render(); }],
      ['✍️  Texto / Escrita', () => { A('text'); render(); }],
      ['🏆  Placar', () => { A('scoreboard'); render(); }],
      ['📊  Rodapé', () => { A('ticker'); render(); }],
    ]);
  }
  function pickCamera(ev, A) {
    (async () => {
      let cams = [];
      try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach(t => t.stop()); cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); }
      catch (e) { return toast('Sem acesso à câmera: ' + (e.message || e.name)); }
      if (!cams.length) return toast('Nenhuma câmera encontrada');
      miniMenu(ev, cams.map((c, i) => [(c.label || ('Câmera ' + (i + 1))), () => { const o = A('video'); G().update(o.id, { device: c.deviceId, label: c.label || 'Câmera', w: 40, x: 30, y: 25 }); render(); }]));
    })();
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
  function fmtRatioNum() { try { return ({ '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 })[document.querySelector('.dash').dataset.format] || (16 / 9); } catch (e) { return 16 / 9; } }
  function seFitStage() {   // dimensiona o palco por cálculo (cabe certinho em qualquer formato, sem esticar)
    const stage = document.getElementById('seStage'); if (!stage) return;
    const wrap = document.querySelector('#seModal .se-stagewrap') || stage.parentElement; const aw = (wrap ? wrap.clientWidth : 800) - 36; const ah = (wrap ? wrap.clientHeight : 500) - 66;
    const r = fmtRatioNum(); let w = aw, h = w / r; if (h > ah) { h = ah; w = h * r; }
    stage.style.aspectRatio = ''; stage.style.width = Math.round(w) + 'px'; stage.style.height = Math.round(h) + 'px';
  }
  // (seletor de formato REMOVIDO do editor — formato é global; mexer aqui mudava a live toda. Volta com perfis/salvar.)
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
    let nLayers = 0; try { nLayers = (G().listForScene ? G().listForScene(modalScene.id) : []).length; } catch (e) {}
    if (stream) { if (seVid.srcObject !== stream) { seVid.srcObject = stream; seVid.play && seVid.play().catch(() => {}); } seVid.style.display = ''; if (emp) emp.style.display = 'none'; }
    else { if (seVid.srcObject) seVid.srcObject = null; seVid.style.display = 'none'; if (emp) emp.style.display = nLayers ? 'none' : 'flex'; }
  }
  // o VÍDEO da cena também é controlável: arrasta = move, scroll = zoom, 2 cliques = reseta (por cena)
  function applyVidT(sc) { if (!seVid || !sc) return; const v = sc.vid || {}; seVid.style.transformOrigin = 'center'; seVid.style.transform = 'translate(' + (v.x || 0) + '%,' + (v.y || 0) + '%) scale(' + (v.scale || 1) + ')'; }
  function saveVid(sc) { const l = load(); const i = l.findIndex(x => x.id === sc.id); if (i >= 0) { l[i].vid = sc.vid; save(l); } }
  function bindVideoTransform(sc) {
    if (!seVid || !sc) return;
    if (!sc.vid) sc.vid = { x: 0, y: 0, scale: 1 };
    applyVidT(sc); seVid.style.cursor = 'move'; seVid.title = 'Arraste pra mover · scroll = zoom · 2 cliques = resetar';
    seVid.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const sr = document.getElementById('seStage').getBoundingClientRect();
      const x0 = sc.vid.x || 0, y0 = sc.vid.y || 0, px = e.clientX, py = e.clientY;
      const move = (ev) => { sc.vid.x = x0 + (ev.clientX - px) / sr.width * 100; sc.vid.y = y0 + (ev.clientY - py) / sr.height * 100; applyVidT(sc); };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); saveVid(sc); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    seVid.addEventListener('wheel', (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.06 : 0.94; sc.vid.scale = Math.max(0.2, Math.min(6, (sc.vid.scale || 1) * f)); applyVidT(sc); saveVid(sc); }, { passive: false });
    seVid.addEventListener('dblclick', () => { sc.vid = { x: 0, y: 0, scale: 1 }; applyVidT(sc); saveVid(sc); });
  }

  // ===== TIMELINE (entra/sai + fade + keyframes) — etapas 1-3 =====
  let tlT = 0, tlDur = 15, tlPlaying = false, tlRaf = 0, tlPrev = 0, tlZoom = 1;
  function vidCtl(id) { try { const v = window.Studio.mediaElFor && window.Studio.mediaElFor(id); if (!v || typeof v.play !== 'function') return null; return { t: () => v.currentTime || 0, dur: () => (isFinite(v.duration) ? v.duration : 0), play: () => { try { v.play(); } catch (e) {} }, pause: () => { try { v.pause(); } catch (e) {} }, seek: (s) => { if (isFinite(v.duration)) try { v.currentTime = Math.max(0, Math.min(v.duration, s)); } catch (e) {} } }; } catch (e) { return null; } }
  function tlMedia() { return modalScene ? vidCtl(modalScene.program) : null; }
  function tlPos(t) { return Math.max(0, Math.min(100, (t / tlDur) * 100)); }
  function fmtT(s) { s = Math.round(s); const m = Math.floor(s / 60), ss = s % 60; return m > 0 ? (m + ':' + String(ss).padStart(2, '0')) : (ss + 's'); }
  function tlRender() {
    const body = document.getElementById('seTlBody'); if (!body || !modalScene) return;
    const own = (G() && G().listForScene) ? G().listForScene(modalScene.id) : [];
    body.innerHTML = '';
    const wrap = el('div', 'tl-wrap'); body.appendChild(wrap);
    const heads = el('div', 'tl-heads'); wrap.appendChild(heads);
    heads.appendChild(el('div', 'tl-headspacer'));                 // alinha os cabeçalhos com a régua
    const lanesScroll = el('div', 'tl-lanesscroll'); wrap.appendChild(lanesScroll);
    const lanes = el('div', 'tl-lanes'); lanes.style.width = (tlZoom * 100) + '%'; lanesScroll.appendChild(lanes);
    const ruler = el('div', 'tl-ruler');
    const step = tlDur <= 20 ? 1 : tlDur <= 60 ? 5 : 10;
    for (let s = 0; s <= tlDur + 0.001; s += step) { const tk = el('span', 'tl-tick', fmtT(s)); tk.style.left = tlPos(s) + '%'; ruler.appendChild(tk); }
    ruler.addEventListener('pointerdown', e => { const r = ruler.getBoundingClientRect(); const sk = ev => tlSeek((ev.clientX - r.left) / r.width * tlDur); sk(e); const up = () => { window.removeEventListener('pointermove', sk); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', sk); window.addEventListener('pointerup', up); });
    lanes.appendChild(ruler);
    const ph = el('div', 'tl-ph'); ph.style.left = tlPos(tlT) + '%'; ph.appendChild(el('span', 'tl-ph-head')); lanes.appendChild(ph);
    if (!own.length) lanes.appendChild(el('div', 'tl-empty', 'Adicione camadas (painel à direita ou "+ Adicionar camada") pra animar.'));
    [...own].reverse().forEach(o => {
      const a = o.data && o.data.anim;
      const tin = a ? (a.tin || 0) : 0, tout = (a && a.tout != null) ? a.tout : tlDur;
      const sel = G().selected && G().selected() === o.id;
      const head = el('div', 'tl-thead' + (sel ? ' sel' : ''));   // cabeçalho da faixa: cadeado + olho + nome (estilo mockup)
      const lockB = el('button', 'tl-hlock'); lockB.innerHTML = seIcon(o.locked ? 'lock' : 'unlock'); lockB.title = o.locked ? 'Destravar' : 'Travar'; lockB.onclick = e => { e.stopPropagation(); G().setLocked(o.id, !o.locked); tlRender(); seRender(); };
      const eyeB = el('button', 'tl-heye' + (o.visible === false ? ' off' : '')); eyeB.innerHTML = (o.visible === false ? EYEOFF : EYE); eyeB.title = 'Mostrar / ocultar'; eyeB.onclick = e => { e.stopPropagation(); G().setVisible(o.id, o.visible === false); tlRender(); seRender(); };
      head.append(lockB, eyeB, el('span', 'tl-hname', layerName(o)));
      head.addEventListener('click', () => { if (!G().selected || G().selected() !== o.id) { G().select(o.id); seRender(); tlRender(); } });
      heads.appendChild(head);
      const lane = el('div', 'tl-lane' + (sel ? ' sel' : ''));
      const bar = el('div', 'tl-bar tl-bar-' + o.type); bar.style.left = tlPos(tin) + '%'; bar.style.width = Math.max(1, tlPos(tout) - tlPos(tin)) + '%';
      if ((o.type === 'image' || o.type === 'template') && o.data && (o.data.src || o.data.art)) { bar.style.backgroundImage = 'url(' + (o.data.src || o.data.art) + ')'; bar.classList.add('tl-bar-thumb'); }
      bar.appendChild(el('span', 'tl-bar-nm', layerName(o)));
      const hl = el('span', 'tl-h tl-hl'), hr = el('span', 'tl-h tl-hr'); bar.append(hl, hr); lane.appendChild(bar);
      if (a && a.keys) a.keys.forEach(k => { const d = el('span', 'tl-kf'); d.style.left = tlPos(k.t) + '%'; d.title = 'keyframe ' + k.t + 's · clique=ir · 2 cliques=remover'; d.onclick = ev => { ev.stopPropagation(); tlSeek(k.t); }; d.ondblclick = ev => { ev.stopPropagation(); G().removeKeyframe(o.id, k.t); tlRender(); }; lane.appendChild(d); });
      lane.addEventListener('click', e => { if (e.target === lane) { if (!G().selected || G().selected() !== o.id) { G().select(o.id); seRender(); tlRender(); } } });
      tlDragBar(o, bar, hl, hr, lane);
      lanes.appendChild(lane);
    });
    const sid = G().selected && G().selected(), an = (sid != null && G().getAnim) ? (G().getAnim(sid) || {}) : {};
    const fi = document.getElementById('seFin'), fo = document.getElementById('seFout');
    if (fi) fi.value = an.fin || 0; if (fo) fo.value = an.fout || 0;
  }
  // ✂ ferramenta de CORTE (CapCut): divide o clipe da camada selecionada no cursor → dois clipes
  function tlSplit() {
    const id = G().selected && G().selected(); if (id == null) return toast('Selecione a camada que quer cortar');
    const o = G().get && G().get(id); if (!o) return;
    const a = (o.data && o.data.anim) ? o.data.anim : { tin: 0, tout: tlDur, fin: 0, fout: 0, keys: [] };
    const tin = a.tin || 0, tout = (a.tout == null ? tlDur : a.tout);
    if (tlT <= tin + 0.05 || tlT >= tout - 0.05) return toast('Posicione o cursor DENTRO do clipe pra cortar');
    const cut = Math.round(tlT * 100) / 100;
    const keysA = (a.keys || []).filter(k => k.t <= cut), keysB = (a.keys || []).filter(k => k.t >= cut);
    const off = (o.type === 'video') ? ((o.data.srcOffset || 0) + (cut - tin)) : 0;
    const clone = G().duplicate(id, o.scene);
    if (clone) { if (G().setPos) G().setPos(clone.id, o.x, o.y); if (o.type === 'video') clone.data.srcOffset = off; G().setAnim(clone.id, { tin: cut, tout: tout, fin: 0, fout: a.fout || 0, keys: keysB }); }
    G().setAnim(id, { tin: tin, tout: cut, fin: a.fin || 0, fout: 0, keys: keysA });
    if (clone) G().select(clone.id);
    tlRender(); seRender(); toast('Clipe cortado em ' + cut.toFixed(1) + 's');
  }
  function tlSetZoom(z) { tlZoom = Math.max(1, Math.min(8, z)); const l = document.getElementById('seZoomLbl'); if (l) l.textContent = (Math.round(tlZoom * 10) / 10) + 'x'; tlRender(); tlSeek(tlT); }
  function tlDragBar(o, bar, hl, hr, track) {
    function start(e, mode) {
      e.preventDefault(); e.stopPropagation();
      if (G().selected && G().selected() !== o.id) { G().select(o.id); seRender(); }   // pegar o clipe = selecionar a camada
      if (!o.data.anim) o.data.anim = { tin: 0, tout: tlDur, fin: 0, fout: 0, keys: [] };
      const a = o.data.anim, t0 = a.tin || 0, t1 = (a.tout == null ? tlDur : a.tout), px = e.clientX, r = track.getBoundingClientRect();
      const move = ev => { const dt = (ev.clientX - px) / r.width * tlDur; let n0 = t0, n1 = t1;
        if (mode === 'move') { n0 = t0 + dt; n1 = t1 + dt; if (n0 < 0) { n1 -= n0; n0 = 0; } if (n1 > tlDur) { n0 -= (n1 - tlDur); n1 = tlDur; } }
        else if (mode === 'l') n0 = Math.max(0, Math.min(t1 - 0.2, t0 + dt)); else n1 = Math.min(tlDur, Math.max(t0 + 0.2, t1 + dt));
        a.tin = Math.round(n0 * 100) / 100; a.tout = Math.round(n1 * 100) / 100;
        bar.style.left = tlPos(a.tin) + '%'; bar.style.width = Math.max(1, tlPos(a.tout) - tlPos(a.tin)) + '%'; };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (G().setAnim) G().setAnim(o.id, {}); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }
    bar.addEventListener('pointerdown', e => { if (e.target === hl || e.target === hr) return; start(e, 'move'); });
    hl.addEventListener('pointerdown', e => start(e, 'l')); hr.addEventListener('pointerdown', e => start(e, 'r'));
  }
  function tlSeek(t) {
    tlT = Math.max(0, Math.min(tlDur, t));
    if (G().setTime) G().setTime(tlT, !tlPlaying);
    const ph = document.querySelector('#seTlBody .tl-ph'); if (ph) ph.style.left = tlPos(tlT) + '%';
    const lab = document.getElementById('seTime'); if (lab) lab.textContent = tlT.toFixed(1) + ' / ' + tlDur.toFixed(0) + 's';
    if (!tlPlaying) { const m = tlMedia(); if (m && m.seek) m.seek(tlT); }
  }
  function tlToggle() { tlPlaying ? tlPause() : tlPlay(); }
  function tlPlay() {
    if (tlPlaying || !modalScene) return; tlPlaying = true;
    const b = document.getElementById('sePlay'); if (b) b.innerHTML = seIcon('pause');
    const m = tlMedia(); if (m && m.play) m.play();
    tlPrev = (window.performance ? performance.now() : Date.now());
    const loop = ts => { if (!tlPlaying) return; const m = tlMedia(); let nt;
      if (m) { nt = m.t(); if (nt >= tlDur - 0.04) nt = (m.dur() > tlDur ? tlDur : 0); }       // segue o tempo real do video
      else { const dt = (ts - tlPrev) / 1000; tlPrev = ts; nt = tlT + dt; if (nt >= tlDur) nt = 0; }
      tlSeek(nt); tlRaf = requestAnimationFrame(loop); };
    tlRaf = requestAnimationFrame(loop);
  }
  function tlPause() {
    tlPlaying = false; if (tlRaf) cancelAnimationFrame(tlRaf); tlRaf = 0;
    const b = document.getElementById('sePlay'); if (b) b.innerHTML = seIcon('play');
    const m = tlMedia(); if (m && m.pause) m.pause();
    if (G().setTime) G().setTime(tlT, true);
  }
  function saveLoop(sc) { const l = load(); const i = l.findIndex(x => x.id === sc.id); if (i >= 0) { l[i].loop = sc.loop; save(l); } }
  function applyLoop(sc) { try { const v = window.Studio.mediaElFor && window.Studio.mediaElFor(sc.program); if (v) v.loop = !!sc.loop; } catch (e) {} }
  function tlInit(sc) {
    tlPlaying = false; tlT = 0; tlRaf = 0; tlZoom = 1;
    let dur = 15; const m = tlMedia(); try { if (m && m.dur && m.dur() > 0) dur = m.dur(); } catch (e) {}
    tlDur = (isFinite(dur) && dur > 0) ? dur : 15;
    const sePlay = document.getElementById('sePlay'); if (sePlay) sePlay.onclick = tlToggle;
    const seKf = document.getElementById('seKf'); if (seKf) seKf.onclick = () => { const s = G().selected && G().selected(); if (s == null) return toast('Selecione uma camada (clique nela no palco)'); G().addKeyframe(s, tlT); tlRender(); toast('Keyframe @ ' + tlT.toFixed(1) + 's'); };
    const seKfClr = document.getElementById('seKfClr'); if (seKfClr) seKfClr.onclick = () => { const s = G().selected && G().selected(); if (s == null) return toast('Selecione uma camada'); G().clearAnim(s); tlRender(); };
    const seCut = document.getElementById('seCut'); if (seCut) seCut.onclick = tlSplit;
    const zi = document.getElementById('seZoomIn'); if (zi) zi.onclick = () => tlSetZoom(tlZoom * 1.5);
    const zo = document.getElementById('seZoomOut'); if (zo) zo.onclick = () => tlSetZoom(tlZoom / 1.5);
    const seAdL = document.getElementById('seAddLayer'); if (seAdL) seAdL.onclick = (e) => addLayerMenu(e, sc, true);
    const seDup = document.getElementById('seDup'); if (seDup) seDup.onclick = () => { const s = G().selected && G().selected(); if (s == null) return toast('Selecione uma camada'); G().duplicate(s, sc.id); seRender(); tlRender(); };
    const seDel = document.getElementById('seDel'); if (seDel) seDel.onclick = () => { const s = G().selected && G().selected(); if (s == null) return toast('Selecione uma camada'); G().remove(s); seRender(); tlRender(); };
    const seGrid = document.getElementById('seGrid'); if (seGrid) seGrid.onclick = () => { const st = document.getElementById('seStage'); if (st) st.classList.toggle('hide-guides'); };
    const seFull = document.getElementById('seFull'); if (seFull) seFull.onclick = () => { try { const fs = document.querySelector('#seModal .se-fs'); if (document.fullscreenElement) document.exitFullscreen(); else if (fs && fs.requestFullscreen) fs.requestFullscreen(); } catch (e) {} };
    const fi = document.getElementById('seFin'); if (fi) fi.onchange = () => { const s = G().selected && G().selected(); if (s != null) G().setAnim(s, { fin: +fi.value || 0 }); };
    const fo = document.getElementById('seFout'); if (fo) fo.onchange = () => { const s = G().selected && G().selected(); if (s != null) G().setAnim(s, { fout: +fo.value || 0 }); };
    const lp = document.getElementById('seLoop'); if (lp) { lp.classList.toggle('on', !!sc.loop); lp.onclick = () => { sc.loop = !sc.loop; lp.classList.toggle('on', sc.loop); saveLoop(sc); applyLoop(sc); }; }
    applyLoop(sc);
    tlRender(); tlSeek(0);
  }
  function seRender() {
    if (!seSide || !modalScene) return;
    modalScene = load().find(x => x.id === modalScene.id) || modalScene;
    seSide.innerHTML = ''; seSide.appendChild(seTab === 'props' ? propsPanel(modalScene) : layersPanel(modalScene, true));
    seRefreshVid(); seFooter();
  }
  function seEsc(e) { if (e.key === 'Escape' && modalScene) { e.stopPropagation(); closeEditor(); } }
  function seTabSet(t) { seTab = t; const m = document.getElementById('seModal'); if (m) m.querySelectorAll('.se-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); seRender(); }
  function seRailSet(panel) { const m = document.getElementById('seModal'); if (!m) return; m.querySelectorAll('.se-railb').forEach(b => b.classList.toggle('on', b.dataset.panel === panel)); const lib = document.getElementById('seLibrary'); if (lib) { lib.innerHTML = ''; lib.appendChild(libraryPanel(panel)); } }
  function seFooter() {
    const m = document.getElementById('seModal'); if (!m) return;
    let fmt = '16:9'; try { fmt = document.querySelector('.dash').dataset.format || '16:9'; } catch (e) {}
    const res = ({ '16:9': '1920×1080', '9:16': '1080×1920', '1:1': '1080×1080', '4:5': '1080×1350' })[fmt] || '1920×1080';
    const r = document.getElementById('seFtRes'); if (r) r.textContent = res + ' (' + fmt + ')';
    const d = document.getElementById('seFtDur'); if (d) d.textContent = (tlDur || 0).toFixed(1) + 's';
    const oa = document.getElementById('seOnAir'); if (oa && modalScene) { const live = (activeId === modalScene.id); oa.className = 'se-onair' + (live ? ' live' : ''); oa.innerHTML = '&#9679; ' + (live ? 'NO AR' : 'PRÉVIA'); }
  }
  function numRow(label, val, step, fn) {
    const r = el('div', 'se-prow'); r.appendChild(el('label', '', label));
    const i = document.createElement('input'); i.type = 'number'; i.step = step || 1; i.value = (val === '' ? '' : Math.round((val || 0) * 100) / 100);
    i.onchange = () => fn(parseFloat(i.value) || 0); r.appendChild(i); return r;
  }
  function propsPanel(sc) {
    const box = el('div', 'se-props');
    const id = G().selected && G().selected(); const o = (id != null && G().get) ? G().get(id) : null;
    if (!o) { box.appendChild(el('div', 'lp-empty', 'Selecione uma camada (no palco ou na lista) pra editar as propriedades.')); return box; }
    box.appendChild(el('div', 'se-ptitle', layerName(o)));
    const a = (o.data && o.data.anim) || {};
    box.appendChild(el('div', 'se-psec', 'Transformar'));
    const grid = el('div', 'se-pgrid');
    grid.appendChild(numRow('X (%)', o.x, 0.5, v => { G().setPos && G().setPos(o.id, v, o.y); }));
    grid.appendChild(numRow('Y (%)', o.y, 0.5, v => { G().setPos && G().setPos(o.id, o.x, v); }));
    grid.appendChild(numRow('Largura (%)', o.w, 0.5, v => { G().setWidth && G().setWidth(o.id, v); }));
    grid.appendChild(numRow('Altura (%)', (o.h == null ? '' : o.h), 0.5, v => { G().setHeight && G().setHeight(o.id, v); }));
    grid.appendChild(numRow('Escala', o.scale || 1, 0.05, v => { G().setScale && G().setScale(o.id, v); }));
    grid.appendChild(numRow('Rotação°', o.rotation || 0, 1, v => { G().setRotation && G().setRotation(o.id, v); }));
    box.appendChild(grid);
    const oprow = el('div', 'se-prow se-prow-op'); oprow.appendChild(el('label', '', 'Opacidade'));
    const op = document.createElement('input'); op.type = 'range'; op.min = 0; op.max = 100; op.value = Math.round((o.opacity == null ? 1 : o.opacity) * 100);
    const opv = el('span', 'se-opv', op.value + '%'); op.oninput = () => { opv.textContent = op.value + '%'; G().setOpacity && G().setOpacity(o.id, (+op.value) / 100); };
    oprow.append(op, opv); box.appendChild(oprow);
    box.appendChild(el('div', 'se-psec', 'Tempo (timeline)'));
    const tg = el('div', 'se-pgrid');
    tg.appendChild(numRow('Entrada (s)', a.tin || 0, 0.1, v => { G().setAnim && G().setAnim(o.id, { tin: v }); tlRender(); }));
    tg.appendChild(numRow('Saída (s)', (a.tout == null ? tlDur : a.tout), 0.1, v => { G().setAnim && G().setAnim(o.id, { tout: v }); tlRender(); }));
    tg.appendChild(numRow('Fade in (s)', a.fin || 0, 0.1, v => { G().setAnim && G().setAnim(o.id, { fin: v }); }));
    tg.appendChild(numRow('Fade out (s)', a.fout || 0, 0.1, v => { G().setAnim && G().setAnim(o.id, { fout: v }); }));
    box.appendChild(tg);
    const btns = el('div', 'se-pbtns');
    const mk = (t, fn, cls) => { const b = el('button', 'se-pbtn' + (cls ? ' ' + cls : ''), t); b.onclick = fn; btns.appendChild(b); };
    mk('⧉ Duplicar', () => { G().duplicate && G().duplicate(o.id, o.scene); seRender(); tlRender(); });
    mk('▲ Frente', () => { G().raise && G().raise(o.id); seRender(); });
    mk('▼ Trás', () => { G().lower && G().lower(o.id); seRender(); });
    mk(o.locked ? '🔓 Destravar' : '🔒 Travar', () => { G().setLocked && G().setLocked(o.id, !o.locked); seRender(); });
    mk('× Excluir', () => { G().remove && G().remove(o.id); seRender(); tlRender(); }, 'danger');
    box.appendChild(btns);
    return box;
  }
  function seAdd(type) { if (!modalScene) return null; if (G().setActiveScene) G().setActiveScene(modalScene.id); const o = G().add(type); if (o) G().select(o.id); seRender(); tlRender(); return o; }
  function libCard(icon, label, fn) { const c = el('button', 'se-libcard'); c.innerHTML = '<span class="se-libic">' + icon + '</span><span class="se-libnm">' + label + '</span>'; c.onclick = e => fn(e); return c; }
  function libraryPanel(panel) {
    const box = el('div', 'se-lib');
    box.appendChild(el('div', 'se-lib-head', 'Biblioteca'));
    if (panel !== 'media' && panel !== 'text' && panel !== 'layers' && panel !== 'elements') { box.appendChild(el('div', 'lp-empty', 'Em construção — em breve.')); return box; }
    box.appendChild(el('div', 'se-libsec', 'Importar'));
    const imp = el('div', 'se-libgrid');
    imp.appendChild(libCard(seIcon('image'), 'Imagem', () => { const o = seAdd('image'); if (o) pickImg(o.id); }));
    imp.appendChild(libCard(seIcon('video'), 'Vídeo', () => { const o = seAdd('video'); if (o) pickVideoFile(o.id); }));
    imp.appendChild(libCard(seIcon('camera'), 'Câmera', (e) => pickCamera(e, t => seAdd(t))));
    box.appendChild(imp);
    box.appendChild(el('div', 'se-libsec', 'Overlays & gráficos'));
    const g = el('div', 'se-libgrid');
    g.appendChild(libCard(seIcon('text'), 'Texto', () => seAdd('text')));
    g.appendChild(libCard(seIcon('trophy'), 'Placar', () => seAdd('scoreboard')));
    g.appendChild(libCard(seIcon('ticker'), 'Rodapé', () => seAdd('ticker')));
    g.appendChild(libCard(seIcon('template'), 'Modelo', () => seAdd('template')));
    g.appendChild(libCard(seIcon('slideshow'), 'Slides', () => seAdd('slideshow')));
    box.appendChild(g);
    box.appendChild(el('div', 'lp-empty se-libhint', 'Clique pra adicionar a camada no palco.'));
    return box;
  }
  function openEditor(id) {
    const sc = load().find(x => x.id === id); if (!sc) return;
    if (modalScene) closeEditor();
    modalScene = sc; prevActive = activeId;
    const RAIL = [['Mídia', 'media', '▦'], ['Texto', 'text', 'T'], ['Stickers', 'stickers', '✦'], ['Elementos', 'elements', '◆'], ['Transições', 'transitions', '⇄'], ['Filtros', 'filters', '◑'], ['Camadas', 'layers', '☰'], ['Áudio', 'audio', '♪'], ['Config', 'config', '⚙']];
    const railHTML = RAIL.map(function (r) { return '<button class="se-railb' + (r[1] === 'media' ? ' on' : '') + '" data-panel="' + r[1] + '"><span class="se-railic">' + seIcon(r[1]) + '</span><span class="se-raill">' + r[0] + '</span></button>'; }).join('');
    const ov = el('div', 'modal-overlay se-overlay'); ov.id = 'seModal';
    ov.innerHTML = '<div class="se-fs">'
      + '<div class="se-topbar"><div class="se-tb-l"><span class="se-logo">KIVO STUDIO</span><span class="se-mode">Montar cena &#9662;</span><span class="se-nm se-scene"></span></div>'
      + '<div class="se-tb-c"><button class="se-ico-btn" title="Desfazer">&#8624;</button><button class="se-ico-btn" title="Refazer">&#8625;</button><span class="se-saved" id="seSaved">&#9679; Salvo automaticamente</span></div>'
      + '<div class="se-tb-r"><button class="se-prev">&#9680; Preview</button><button class="se-air">&#9679; Pôr no ar</button><button class="se-pro">&#10022; Pro</button><button class="modal-close se-x" aria-label="Fechar">&times;</button></div></div>'
      + '<div class="se-main"><div class="se-rail" id="seRail">' + railHTML + '</div>'
      + '<div class="se-library" id="seLibrary"></div>'
      + '<div class="se-center"><div class="se-upper"><div class="se-stagewrap">'
      + '<div class="se-canvasframe"><span class="se-corner"></span><div class="se-ruler-h"></div><div class="se-ruler-v"></div><div class="se-stage" id="seStage"><video class="se-vid" id="seVid" playsinline muted></video><div class="se-empty" id="seEmpty">Cena vazia — use <b>+ camada</b> pra montar</div><div class="se-ovs pgm-overlay" id="seOvs"></div><div class="se-safe"></div><span class="se-guide se-guide-x"></span><span class="se-guide se-guide-y"></span><div class="se-onair" id="seOnAir">&#9679; NO AR</div></div></div>'
      + '<div class="se-canvas-bar"><button class="se-ctool" id="seGrid" title="Mostrar/ocultar guias">' + seIcon('grid') + '</button><span class="se-czoom" id="seCZoom">Ajustar</span><span class="se-time" id="seTime">0.0s</span><button class="se-play" id="sePlay" title="Play / pausar">' + seIcon('play') + '</button><button class="se-ctool" id="seFit" title="Camada no canto (0,0)">' + seIcon('fit') + '</button><button class="se-ctool" id="seCenter" title="Centralizar camada">' + seIcon('center') + '</button><button class="se-ctool" id="seFull" title="Tela cheia">' + seIcon('full') + '</button></div>'
      + '</div></div>'
      + '<div class="se-tl" id="seTl"><div class="se-tl-top"><button class="se-addlayer" id="seAddLayer">' + seIcon('plus') + ' Adicionar camada</button><span class="se-tlsep"></span><button class="se-titool" id="seCut" title="Cortar/dividir no cursor (camada selecionada)">' + seIcon('cut') + '</button><button class="se-titool" id="seDup" title="Duplicar camada">' + seIcon('duplicate') + '</button><button class="se-titool" id="seDel" title="Excluir camada">' + seIcon('trash') + '</button><button class="se-titool" id="seKf" title="Keyframe no cursor">' + seIcon('keyframe') + '</button><button class="se-kfclr" id="seKfClr">limpar anim</button><span class="se-tlsep"></span><button class="se-titool dim" id="seMagnet" title="Magnetismo (em breve)">' + seIcon('magnet') + '</button><button class="se-titool dim" id="seLink" title="Linkar (em breve)">' + seIcon('link') + '</button><button class="se-loop" id="seLoop" title="Repetir / loop">&#128257;</button><span class="se-zoom" title="Zoom da timeline"><button id="seZoomOut">&minus;</button><span id="seZoomLbl">1x</span><button id="seZoomIn">+</button></span></div><div class="se-tl-body" id="seTlBody"></div></div>'
      + '</div>'
      + '<div class="se-right"><div class="se-tabs"><button class="se-tab on" data-tab="camadas">Camadas</button><button class="se-tab" data-tab="props">Propriedades</button></div><div class="se-tabbody" id="seSide"></div></div>'
      + '</div>'
      + '<div class="se-footer"><span>Projeto: <b class="se-nm"></b></span><span>Resolução: <b id="seFtRes">—</b></span><span>FPS: <b>60</b></span><span>Duração: <b id="seFtDur">—</b></span><span class="se-ft-r">&#9679; Sistema operacional</span></div>'
      + '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('.se-nm').forEach(function (n) { n.textContent = sc.name; });
    requestAnimationFrame(seFitStage); window.addEventListener('resize', seFitStage);
    ov.querySelector('.se-x').onclick = closeEditor;
    ov.querySelector('.se-air').onclick = putOnAir;
    ov.querySelector('.se-prev').onclick = () => { const id = modalScene && modalScene.id; closeEditor(); if (id) loadToPreview(id); };
    ov.querySelectorAll('.se-tab').forEach(function (b) { b.onclick = function () { seTabSet(b.dataset.tab); }; });
    ov.querySelectorAll('.se-railb').forEach(function (b) { b.onclick = function () { seRailSet(b.dataset.panel); }; });
    const fitB = ov.querySelector('#seFit'); if (fitB) fitB.onclick = function () { const s = G().selected && G().selected(); if (s != null && G().setPos) G().setPos(s, 0, 0); };
    const cenB = ov.querySelector('#seCenter'); if (cenB) cenB.onclick = function () { const s = G().selected && G().selected(); const o = (s != null && G().get) ? G().get(s) : null; if (o && G().setPos) G().setPos(s, Math.max(0, (100 - (o.w || 20)) / 2), Math.max(0, (100 - (o.h || 20)) / 2)); };
    document.addEventListener('keydown', seEsc, true);
    seVid = ov.querySelector('#seVid'); seHost = ov.querySelector('#seOvs'); seSide = ov.querySelector('#seSide');
    seRailSet('media');
    if (G() && G().setHost) G().setHost(seHost);            // camadas vão pro canvas do modal (fora do PROGRAM)
    if (G() && G().setActiveScene) G().setActiveScene(sc.id);
    if (G() && G().setEditing) G().setEditing(true);        // editor: vídeos entram PARADOS (só tocam no PLAY)
    seRender();
    bindVideoTransform(sc);
    tlInit(sc);
    if (!seTick) seTick = setInterval(seRefreshVid, 700);
  }
  function putOnAir() {
    const sc = modalScene; if (!sc) return;
    if (G() && G().setHost) G().setHost(document.getElementById('pgmOverlay'));   // devolve as camadas pro PROGRAM
    if (G() && G().setActiveScene) G().setActiveScene(sc.id);
    if (sc.program != null && window.Studio && window.Studio.setProgram) window.Studio.setProgram(sc.program);
    applyLoop(sc);
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
    tlPlaying = false; if (tlRaf) cancelAnimationFrame(tlRaf); tlRaf = 0;
    window.removeEventListener('resize', seFitStage);
    if (G() && G().setEditing) G().setEditing(false);       // saiu do editor: vídeos voltam a tocar (no ar)
    if (G() && G().clearTime) G().clearTime();
    if (seTick) { clearInterval(seTick); seTick = null; }
    document.removeEventListener('keydown', seEsc, true);
    const m = document.getElementById('seModal'); if (m) m.remove();
    if (seVid) { try { seVid.srcObject = null; } catch {} }
    modalScene = null; seVid = seHost = seSide = null;
  }

  // ===== etapa 4: tocar a timeline NO AR (sincronizada com o tempo do vídeo do PROGRAM) =====
  let airRaf = 0, airOn = false;
  function sceneHasAnim(id) {
    if (!G().listForScene) return false;
    const list = G().listForScene(id).concat(G().globals ? G().globals() : []);
    return list.some(o => { const a = o.data && o.data.anim; return a && ((a.keys && a.keys.length) || a.tout != null || a.fin || a.fout); });
  }
  function airLoop() {
    airRaf = requestAnimationFrame(airLoop);
    if (modalScene) return;                                   // editor aberto = ele controla o tempo
    if (!activeId || !sceneHasAnim(activeId)) { if (airOn) { if (G().clearTime) G().clearTime(); airOn = false; } return; }
    const sc = load().find(x => x.id === activeId);
    const v = (sc && window.Studio.mediaElFor) ? window.Studio.mediaElFor(sc.program) : null;
    if (v && typeof v.play === 'function') { if (G().setTime) G().setTime(v.currentTime || 0, false); airOn = true; }
    else if (airOn) { if (G().clearTime) G().clearTime(); airOn = false; }
  }

  // ---- painel de CAMADAS estilo Photoshop (miniatura, opacidade, travar, arrastar pra reordenar) ----
  function layerThumb(o) {
    const t = el('span', 'lp-thumb');
    if (o.type === 'image' && o.data && o.data.src) { const im = document.createElement('img'); im.src = o.data.src; t.appendChild(im); }
    else if (o.type === 'template' && o.data && o.data.art) { const im = document.createElement('img'); im.src = o.data.art; t.appendChild(im); }
    else { t.classList.add('lp-th-ic'); t.textContent = (o.type === 'video') ? (o.data && o.data.device != null ? '📷' : '🎬') : o.type === 'text' ? 'Aa' : o.type === 'scoreboard' ? '🏆' : o.type === 'ticker' ? '▭' : o.type === 'slideshow' ? '🎞' : o.type === 'template' ? '🖼' : '▦'; if (o.type === 'text' && o.data && o.data.color) t.style.color = o.data.color; }
    return t;
  }
  function bindRowDrag(row, o, sc, modal, listWrap) {
    row.addEventListener('pointerdown', e => {
      if (e.target.closest('button, input')) return;
      const startY = e.clientY; let dragging = false;
      const onMove = ev => {
        if (!dragging && Math.abs(ev.clientY - startY) < 5) return;
        if (!dragging) { dragging = true; row.classList.add('ps-dragging'); }
        const after = [...listWrap.querySelectorAll('.ps-row')].filter(r => r !== row).find(r => ev.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
        if (after) listWrap.insertBefore(row, after); else listWrap.appendChild(row);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
        row.classList.remove('ps-dragging');
        if (dragging) { const ids = [...listWrap.querySelectorAll('.ps-row')].map(r => +r.dataset.id); if (G().reorderLayers) G().reorderLayers(ids); seRender(); tlRender(); }
        else { if (!modal && activeId !== sc.id) setActive(sc.id, false); G().select(o.id); seRender(); tlRender(); }
      };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    });
  }
  function layersPanel(sc, modal) {
    const box = el('div', 'sc-layers ps-layers');
    const own = (G() && G().listForScene) ? G().listForScene(sc.id) : [];
    const gl = (G() && G().globals) ? G().globals() : [];
    const selId = G().selected && G().selected();
    const selO = own.concat(gl).find(o => o.id === selId);
    const opbar = el('div', 'ps-opacity' + (selO ? '' : ' off'));
    opbar.appendChild(el('span', 'ps-oplab', 'Opacidade'));
    const op = document.createElement('input'); op.type = 'range'; op.min = 0; op.max = 100; op.step = 1;
    op.value = selO ? Math.round((selO.opacity == null ? 1 : selO.opacity) * 100) : 100; op.disabled = !selO;
    const opv = el('span', 'ps-opv', op.value + '%');
    op.oninput = () => { opv.textContent = op.value + '%'; if (selO) G().setOpacity(selO.id, (+op.value) / 100); };
    opbar.append(op, opv); box.appendChild(opbar);

    const listWrap = el('div', 'ps-list');
    if (!own.length) listWrap.appendChild(el('div', 'lp-empty', 'Sem camadas — use "+ camada" abaixo.'));
    [...own].reverse().forEach(o => {
      const sel = selId === o.id;
      const row = el('div', 'sc-lrow ps-row lp-row' + (o.visible === false ? ' off' : '') + (sel ? ' sel' : '') + (o.locked ? ' locked' : '')); row.dataset.id = o.id;
      const eye = el('button', 'lp-eye', o.visible === false ? EYEOFF : EYE); eye.title = 'Mostrar / ocultar'; eye.onclick = e => { e.stopPropagation(); G().setVisible(o.id, o.visible === false); };
      const nm = el('span', 'lp-nm', layerName(o));
      const lock = el('button', 'lp-mini lp-lock', o.locked ? '🔒' : '🔓'); lock.title = o.locked ? 'Destravar' : 'Travar (não move)'; lock.onclick = e => { e.stopPropagation(); G().setLocked(o.id, !o.locked); seRender(); };
      const dup = el('button', 'lp-mini', '⧉'); dup.title = 'Duplicar / copiar p/ outra cena'; dup.onclick = e => { e.stopPropagation(); dupMenu(e, o, sc); };
      const x = el('button', 'lp-x', '×'); x.title = 'Remover camada'; x.onclick = e => { e.stopPropagation(); G().remove(o.id); };
      row.append(eye, layerThumb(o), nm, lock, dup, x);
      bindRowDrag(row, o, sc, modal, listWrap);
      listWrap.appendChild(row);
    });
    box.appendChild(listWrap);
    const addb = el('button', 'sc-add'); addb.textContent = '+ camada'; addb.title = 'Adicionar nesta cena'; addb.onclick = (e) => addLayerMenu(e, sc, modal); box.appendChild(addb);

    if (gl.length) {
      box.appendChild(el('div', 'sc-lsec', 'Em todas as cenas'));
      [...gl].reverse().forEach(o => {
        const row = el('div', 'sc-lrow lp-row sc-global');
        const claim = el('button', 'lp-mini', '↧'); claim.title = 'Trazer só pra esta cena'; claim.onclick = e => { e.stopPropagation(); G().setOverlayScene(o.id, sc.id); render(); };
        row.append(el('span', 'lp-thumb lp-th-ic', '🌐'), el('span', 'lp-nm', layerName(o)), claim);
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
      const chip = el('div', 'sc-chip' + (s.id === activeId ? ' active' : '') + (s.id === previewId ? ' preview' : ''));
      const go = el('button', 'sc-go', s.name); go.title = 'Clique: ver no PREVIEW · Duplo-clique: abrir o editor';
      let ct = null;
      go.onclick = () => { clearTimeout(ct); ct = setTimeout(() => loadToPreview(s.id), 230); };
      go.ondblclick = () => { clearTimeout(ct); editScene(s.id); };
      const air = el('button', 'sc-mini sc-air-btn', seIcon('broadcast')); air.title = 'Pôr ESTA cena no ar (PROGRAM)'; air.onclick = e => { e.stopPropagation(); setActive(s.id, true); render(); };
      const ed = el('button', 'sc-mini sc-edit-btn', seIcon('layers')); ed.title = 'Montar Cena (abrir editor)'; ed.onclick = e => { e.stopPropagation(); openMontarCena(s.id); };
      const ren = el('button', 'sc-mini', seIcon('pencil')); ren.title = 'Renomear'; ren.onclick = e => { e.stopPropagation(); const n = prompt('Nome da cena:', s.name); if (n != null) { const l = load(); const j = l.findIndex(x => x.id === s.id); if (j >= 0) { l[j].name = n || s.name; save(l); render(); } } };
      const x = el('button', 'sc-x', '×'); x.title = 'Remover cena'; x.onclick = e => {
        e.stopPropagation();
        if (!confirm('Remover a cena "' + s.name + '"? As camadas dela viram globais (continuam, aparecendo em todas).')) return;
        if (G() && G().listForScene) G().listForScene(s.id).forEach(o => G().setOverlayScene(o.id, null)); // não perde trabalho
        save(load().filter(y => y.id !== s.id));
        if (activeId === s.id) setActive(null, false);
        render();
      };
      chip.append(go, air, ed, ren, x); wrap.appendChild(chip);
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
    if (!activeId && G() && G().getPreviewScene && G().getPreviewScene() == null && G().setPreviewScene) G().setPreviewScene('__prev0__');   // dashboard: camadas novas entram no PREVIEW (staging)
    render();
    lastProg = String(progId() || '');
    if (G() && G().onChange) G().onChange(() => { if (modalScene) { seRender(); tlRender(); } });   // editor aberto acompanha mudanças
    if (!tick) tick = setInterval(autoSave, 1500);
    if (!airRaf) airRaf = requestAnimationFrame(airLoop);   // etapa 4: toca a timeline no ar
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
