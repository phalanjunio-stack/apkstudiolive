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
    const wrap = stage.parentElement; const aw = (wrap ? wrap.clientWidth : 800) - 4; const ah = window.innerHeight * 0.74;
    const r = fmtRatioNum(); let w = aw, h = w / r; if (h > ah) { h = ah; w = h * r; }
    stage.style.aspectRatio = ''; stage.style.width = Math.round(w) + 'px'; stage.style.height = Math.round(h) + 'px';
  }
  function seSetFormat(fmt) {
    const b = document.querySelector('#fmtSeg button[data-fmt="' + fmt + '"]'); if (b) b.click();   // muda o FORMATO da live inteira (global)
    seFitStage();
    document.querySelectorAll('#seModal .se-fmt button').forEach(x => x.classList.toggle('on', x.dataset.fmt === fmt));
  }
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
  let tlT = 0, tlDur = 15, tlPlaying = false, tlRaf = 0, tlPrev = 0;
  function vidCtl(id) { try { const v = window.Studio.mediaElFor && window.Studio.mediaElFor(id); if (!v || typeof v.play !== 'function') return null; return { t: () => v.currentTime || 0, dur: () => (isFinite(v.duration) ? v.duration : 0), play: () => { try { v.play(); } catch (e) {} }, pause: () => { try { v.pause(); } catch (e) {} }, seek: (s) => { if (isFinite(v.duration)) try { v.currentTime = Math.max(0, Math.min(v.duration, s)); } catch (e) {} } }; } catch (e) { return null; } }
  function tlMedia() { return modalScene ? vidCtl(modalScene.program) : null; }
  function tlPos(t) { return Math.max(0, Math.min(100, (t / tlDur) * 100)); }
  function tlRender() {
    const body = document.getElementById('seTlBody'); if (!body || !modalScene) return;
    const own = (G() && G().listForScene) ? G().listForScene(modalScene.id) : [];
    body.innerHTML = '';
    const ruler = el('div', 'tl-ruler');
    ruler.addEventListener('pointerdown', e => { const r = ruler.getBoundingClientRect(); const sk = ev => tlSeek((ev.clientX - r.left) / r.width * tlDur); sk(e); const up = () => { window.removeEventListener('pointermove', sk); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', sk); window.addEventListener('pointerup', up); });
    body.appendChild(ruler);
    const ph = el('div', 'tl-ph'); ph.style.left = tlPos(tlT) + '%'; body.appendChild(ph);
    if (!own.length) body.appendChild(el('div', 'tl-empty', 'Adicione camadas (painel à direita) pra animar.'));
    [...own].reverse().forEach(o => {
      const a = o.data && o.data.anim;
      const tin = a ? (a.tin || 0) : 0, tout = (a && a.tout != null) ? a.tout : tlDur;
      const sel = G().selected && G().selected() === o.id;
      const track = el('div', 'tl-track' + (sel ? ' sel' : ''));   // faixa ocupa a largura toda → alinha com a régua/playhead
      track.appendChild(el('span', 'tl-lab', layerName(o)));
      const bar = el('div', 'tl-bar'); bar.style.left = tlPos(tin) + '%'; bar.style.width = Math.max(1, tlPos(tout) - tlPos(tin)) + '%';
      const hl = el('span', 'tl-h tl-hl'), hr = el('span', 'tl-h tl-hr'); bar.append(hl, hr); track.appendChild(bar);
      if (a && a.keys) a.keys.forEach(k => { const d = el('span', 'tl-kf'); d.style.left = tlPos(k.t) + '%'; d.title = 'keyframe ' + k.t + 's · clique=ir · 2 cliques=remover'; d.onclick = ev => { ev.stopPropagation(); tlSeek(k.t); }; d.ondblclick = ev => { ev.stopPropagation(); G().removeKeyframe(o.id, k.t); tlRender(); }; track.appendChild(d); });
      track.addEventListener('click', e => { if (e.target === track || e.target.classList.contains('tl-lab')) { if (!G().selected || G().selected() !== o.id) G().select(o.id); } });
      tlDragBar(o, bar, hl, hr, track);
      body.appendChild(track);
    });
    const sid = G().selected && G().selected(), an = (sid != null && G().getAnim) ? (G().getAnim(sid) || {}) : {};
    const fi = document.getElementById('seFin'), fo = document.getElementById('seFout');
    if (fi) fi.value = an.fin || 0; if (fo) fo.value = an.fout || 0;
  }
  function tlDragBar(o, bar, hl, hr, track) {
    function start(e, mode) {
      e.preventDefault(); e.stopPropagation();
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
    const b = document.getElementById('sePlay'); if (b) b.innerHTML = '&#10074;&#10074;';
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
    const b = document.getElementById('sePlay'); if (b) b.innerHTML = '&#9654;';
    const m = tlMedia(); if (m && m.pause) m.pause();
    if (G().setTime) G().setTime(tlT, true);
  }
  function saveLoop(sc) { const l = load(); const i = l.findIndex(x => x.id === sc.id); if (i >= 0) { l[i].loop = sc.loop; save(l); } }
  function applyLoop(sc) { try { const v = window.Studio.mediaElFor && window.Studio.mediaElFor(sc.program); if (v) v.loop = !!sc.loop; } catch (e) {} }
  function tlInit(sc) {
    tlPlaying = false; tlT = 0; tlRaf = 0;
    let dur = 15; const m = tlMedia(); try { if (m && m.dur && m.dur() > 0) dur = m.dur(); } catch (e) {}
    tlDur = (isFinite(dur) && dur > 0) ? dur : 15;
    const sePlay = document.getElementById('sePlay'); if (sePlay) sePlay.onclick = tlToggle;
    const seKf = document.getElementById('seKf'); if (seKf) seKf.onclick = () => { const s = G().selected && G().selected(); if (s == null) return toast('Selecione uma camada (clique nela no palco)'); G().addKeyframe(s, tlT); tlRender(); toast('Keyframe @ ' + tlT.toFixed(1) + 's'); };
    const seKfClr = document.getElementById('seKfClr'); if (seKfClr) seKfClr.onclick = () => { const s = G().selected && G().selected(); if (s == null) return toast('Selecione uma camada'); G().clearAnim(s); tlRender(); };
    const fi = document.getElementById('seFin'); if (fi) fi.onchange = () => { const s = G().selected && G().selected(); if (s != null) G().setAnim(s, { fin: +fi.value || 0 }); };
    const fo = document.getElementById('seFout'); if (fo) fo.onchange = () => { const s = G().selected && G().selected(); if (s != null) G().setAnim(s, { fout: +fo.value || 0 }); };
    const lp = document.getElementById('seLoop'); if (lp) { lp.classList.toggle('on', !!sc.loop); lp.onclick = () => { sc.loop = !sc.loop; lp.classList.toggle('on', sc.loop); saveLoop(sc); applyLoop(sc); }; }
    applyLoop(sc);
    tlRender(); tlSeek(0);
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
      + '<div class="se-fmt">' + ['16:9', '9:16', '1:1', '4:5'].map(function (f) { return '<button data-fmt="' + f + '">' + f + '</button>'; }).join('') + '</div>'
      + '<div class="se-actions"><button class="se-prev">&#9680; Preview</button><button class="se-air">&#9679; Pôr no ar</button><button class="modal-close se-x" aria-label="Fechar">&times;</button></div></div>'
      + '<div class="se-body"><div class="se-stagewrap"><div class="se-stage" id="seStage">'
      + '<video class="se-vid" id="seVid" autoplay playsinline muted></video>'
      + '<div class="se-empty" id="seEmpty">Cena vazia — use <b>+ camada</b> pra montar</div><div class="se-ovs pgm-overlay" id="seOvs"></div>'
      + '</div></div><div class="se-side" id="seSide"></div></div>'
      + '<div class="se-tl" id="seTl"><div class="se-tl-top"><button class="se-play" id="sePlay">&#9654;</button><button class="se-loop" id="seLoop" title="Repetir / loop">&#128257;</button><span class="se-time" id="seTime">0.0s</span><button class="se-kf" id="seKf">&#9670; keyframe</button><span class="se-fade">fade<input type="number" id="seFin" min="0" max="10" step="0.1" value="0" title="fade in (s)"><input type="number" id="seFout" min="0" max="10" step="0.1" value="0" title="fade out (s)"></span><button class="se-kfclr" id="seKfClr">limpar anim</button><span class="se-tl-h">barras = entra/sai &middot; &#9670; grava posição no tempo (camada selecionada) &middot; régua = ir pro tempo</span></div><div class="se-tl-body" id="seTlBody"></div></div>'
      + '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.se-nm').textContent = sc.name;
    requestAnimationFrame(seFitStage); window.addEventListener('resize', seFitStage);
    (function () { var cur; try { cur = document.querySelector('.dash').dataset.format; } catch (e) { cur = '16:9'; } ov.querySelectorAll('.se-fmt button').forEach(function (b) { b.classList.toggle('on', b.dataset.fmt === cur); b.onclick = function () { seSetFormat(b.dataset.fmt); }; }); })();
    ov.querySelector('.se-x').onclick = closeEditor;
    ov.querySelector('.se-air').onclick = putOnAir;
    ov.querySelector('.se-prev').onclick = () => { const id = modalScene && modalScene.id; closeEditor(); if (id) loadToPreview(id); };
    ov.addEventListener('pointerdown', e => { if (e.target === ov) closeEditor(); });
    document.addEventListener('keydown', seEsc, true);
    seVid = ov.querySelector('#seVid'); seHost = ov.querySelector('#seOvs'); seSide = ov.querySelector('#seSide');
    if (G() && G().setHost) G().setHost(seHost);            // camadas vão pro canvas do modal (fora do PROGRAM)
    if (G() && G().setActiveScene) G().setActiveScene(sc.id);
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

  // ---- painel: as camadas de UMA cena (vídeo + gráficos próprios + globais) ----
  function layersPanel(sc, modal) {
    const box = el('div', 'sc-layers');
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
      const chip = el('div', 'sc-chip' + (s.id === activeId ? ' active' : '') + (s.id === previewId ? ' preview' : ''));
      const go = el('button', 'sc-go', s.name); go.title = 'Clique: ver no PREVIEW · Duplo-clique: abrir o editor';
      let ct = null;
      go.onclick = () => { clearTimeout(ct); ct = setTimeout(() => loadToPreview(s.id), 230); };
      go.ondblclick = () => { clearTimeout(ct); editScene(s.id); };
      const air = el('button', 'sc-mini sc-air-btn', '▶'); air.title = 'Pôr ESTA cena no ar (PROGRAM)'; air.onclick = e => { e.stopPropagation(); setActive(s.id, true); render(); };
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
    render();
    lastProg = String(progId() || '');
    if (G() && G().onChange) G().onChange(() => { if (modalScene) { seRender(); tlRender(); } });   // editor aberto acompanha mudanças
    if (!tick) tick = setInterval(autoSave, 1500);
    if (!airRaf) airRaf = requestAnimationFrame(airLoop);   // etapa 4: toca a timeline no ar
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
