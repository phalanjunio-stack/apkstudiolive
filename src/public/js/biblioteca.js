/* ============================================
   BIBLIOTECA — pool de mídia + fontes ao vivo, TUDO arrastável pro PREVIEW.
   Modelo OBS: soltar um item no PREVIEW cria uma CAMADA (Graphics) na cena de preview.
     • logo / imagem  → camada de imagem (data URL guardado na biblioteca)
     • câmera / vídeo / tela (fonte ao vivo) → camada de vídeo vinculada à FONTE
       (o áudio continua indo pelo MIXER; a camada só mostra o vídeo)
   A 1ª camada solta entra TELA CHEIA (vira o "fundo"); as próximas entram como PiP.
   Aparece sozinho no painel CAMADAS · PREVIEW (o motor já joga camada nova na cena de preview).
   ============================================ */
(function () {
  const KEY = 'sl-lib-assets';                 // só imagens (data URL) persistem; vídeo é da sessão
  const MIME = 'application/x-kivo';           // payload do drag interno
  const $ = (id) => document.getElementById(id);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const G = () => window.Graphics;

  let assets = [];      // { id, name, src }  (imagens/logos)
  let seq = 1;

  function toast(m) { const t = el('div', 'toast show'); t.textContent = m; document.body.appendChild(t); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600); }

  // ---------------------------- persistência ----------------------------
  function loadAssets() { try { const s = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(s)) assets = s; } catch {} assets.forEach(a => { if (a.id >= seq) seq = a.id + 1; }); }
  function saveAssets() { try { localStorage.setItem(KEY, JSON.stringify(assets)); } catch {} }

  function addImageAsset(name, dataUrl) { const a = { id: seq++, name: name || 'Logo', src: dataUrl }; assets.push(a); saveAssets(); renderAssets(); return a; }
  function removeAsset(id) { assets = assets.filter(a => a.id !== id); saveAssets(); renderAssets(); }
  function importImages() {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true;
    i.onchange = () => { let n = 0; [...i.files].forEach(f => { const r = new FileReader(); r.onload = () => addImageAsset(f.name, r.result); r.readAsDataURL(f); n++; }); if (n) toast(n + (n > 1 ? ' imagens' : ' imagem') + ' na biblioteca — arraste pro PREVIEW.'); };
    i.click();
  }

  // ---------------------------- strip de logos/imagens ----------------------------
  const ICON_VID = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>';
  function renderAssets() {
    const host = $('libAssets'); if (!host) return; host.innerHTML = '';
    if (!assets.length) { host.appendChild(el('div', 'lib-empty', 'Sem logos ainda — clique em <b>+ importar</b>.')); return; }
    assets.forEach(a => {
      const c = el('div', 'lib-item'); c.draggable = true; c.dataset.id = a.id; c.title = a.name + ' — clique (ou arraste) pro PREVIEW';
      const th = el('div', 'lib-thumb'); const im = document.createElement('img'); im.src = a.src; im.alt = ''; im.draggable = false; th.appendChild(im);
      const nm = el('span', 'lib-nm', a.name);
      const x = el('button', 'lib-x', '×'); x.title = 'Remover da biblioteca'; x.onclick = e => { e.stopPropagation(); removeAsset(a.id); };
      // número de atalho da LOGO (não precisa virar camada): pad/tecla põe ela no ar direto. Clique cicla 1→9.
      const hk = el('button', 'lib-hk' + (a.hotkey ? ' set' : ''), a.hotkey ? String(a.hotkey) : '#');
      hk.title = 'Número de atalho — pad/tecla põe a logo no ar sem precisar arrastar. Clique pra trocar';
      hk.onclick = e => { e.stopPropagation(); a.hotkey = window.Pads ? window.Pads.nextFreeNumber(a.hotkey, 'asset', a.id) : (((+a.hotkey || 0) + 1) % 10); saveAssets(); renderAssets(); if (window.Pads) window.Pads.refresh(); };
      c.append(th, nm, x, hk);
      c.addEventListener('dragstart', e => {
        e.dataTransfer.setData(MIME, JSON.stringify({ kind: 'image', src: a.src, name: a.name }));
        e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('lib-dragging');
      });
      c.addEventListener('dragend', () => document.body.classList.remove('lib-dragging'));
      // CLIQUE já adiciona como camada (jeito confiável, sem depender de arrastar)
      c.addEventListener('click', e => {
        if (e.target.closest('.lib-x, .lib-hk')) return;
        const g = G();
        // DEDUP: se essa logo já é camada, só seleciona (não duplica). Duplicar = painel Camadas.
        if (g && g.list) { const ex = g.list().find(o => o.data && (o.data.libId === a.id || o.data.src === a.src)); if (ex) { g.select && g.select(ex.id); return; } }
        const made = addLayer({ kind: 'image', src: a.src, name: a.name }, 50, 50);
        if (made && g) g.update(made.id, { libId: a.id });
      });
      host.appendChild(c);
    });
  }

  // ---------------------------- fontes ao vivo (cards do #fontesGrid) viram arrastáveis ----------------------------
  function makeSourceDraggable(card) {
    if (card.__libDrag || card.classList.contains('addcard')) return;
    card.__libDrag = true; card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      const id = card.dataset.id; if (!id) return;
      let label = ''; try { label = (card.querySelector('.nm') || {}).textContent || ''; } catch {}
      e.dataTransfer.setData(MIME, JSON.stringify({ kind: 'source', id, label }));
      e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('lib-dragging');
    });
    card.addEventListener('dragend', () => document.body.classList.remove('lib-dragging'));
  }
  function scanSources() { const g = $('fontesGrid'); if (!g) return; g.querySelectorAll('.fcard').forEach(makeSourceDraggable); }

  // ---------------------------- soltar no PREVIEW → cria camada ----------------------------
  function previewLayers() { try { const g = G(); if (!g.list) return []; const ps = g.getPreviewScene ? g.getPreviewScene() : null; return g.list().filter(o => (o.data && o.data.padManaged) ? (o.data.onPrev && o.visible !== false) : (o.scene === ps && o.visible !== false)); } catch { return []; } }
  function refreshPreviewEmpty() {
    const empt = $('previewEmpty'); if (!empt) return;
    let hasSrc = false; try { hasSrc = !!$('previewVideo').srcObject; } catch {}
    empt.style.display = (previewLayers().length || hasSrc) ? 'none' : 'flex';
  }

  // posiciona um LOGO no ponto solto, com a caixa na proporção real da imagem
  function placeLogo(o, src, xPct, yPct, name) {
    const g = G(); if (!g) return;
    g.update(o.id, { src: src, autofit: false, fit: 'contain', label: name || 'Logo' });
    const provW = 24; g.setWidth(o.id, provW); g.setHeight(o.id, 14); g.setPos(o.id, clamp(xPct - provW / 2), clamp(yPct - 7));
    const img = new Image();
    img.onload = () => {
      const host = $('prevOverlay'); const r = host ? host.getBoundingClientRect() : { width: 16, height: 9 };
      const ar = (img.naturalWidth / img.naturalHeight) || 1;
      const wPct = 24, hPct = Math.max(4, Math.round(wPct * (r.width / r.height) / ar * 10) / 10);
      g.setWidth(o.id, wPct); g.setHeight(o.id, hPct);
      g.setPos(o.id, clamp(xPct - wPct / 2), clamp(yPct - hPct / 2));
    };
    img.src = src;
  }

  // cria a camada a partir do payload do drag (ou de um duplo-clique)
  // regra previsível (estilo OBS): vídeo/câmera entra TELA CHEIA; imagem/logo entra
  // em tamanho de logo no ponto solto. Redimensione/mova depois no próprio PREVIEW.
  function addLayer(payload, xPct, yPct) {
    const g = G(); if (!g || !g.add) { toast('Motor de gráficos não carregou.'); return null; }
    let made = null;
    // garante uma cena de PREVIEW pra receber a camada (e o painel CAMADAS mostra a MESMA).
    // se uma cena está no ar, compõe ELA (a camada aparece na lista e no ar); senão, o staging.
    if (g.getPreviewScene && g.getPreviewScene() == null) {
      const act = g.getActiveScene ? g.getActiveScene() : null;
      if (g.setPreviewScene) g.setPreviewScene(act != null ? act : '__prev0__');
    }
    if (payload.kind === 'image') {
      const o = g.add('image'); if (!o) return null; made = o;
      g.update(o.id, { padManaged: true, onPrev: true, onPgm: false });   // modelo unificado: nasce no PREVIEW (staging) e o TAKE leva pro PROGRAMA com os ajustes (pv→ao vivo)
      placeLogo(o, payload.src, xPct, yPct, payload.name);
      if (g.select) g.select(o.id);
      toast('Logo na cena — arraste/roda do mouse redimensiona no PREVIEW.');
    } else {                                         // vídeo (arquivo) ou fonte ao vivo
      const o = g.add('video'); if (!o) return null; made = o;
      g.update(o.id, { padManaged: true, onPrev: true, onPgm: false });   // modelo unificado (staging no PREVIEW)
      if (payload.kind === 'source') {
        // se a FONTE for vídeo de arquivo (tem url), a camada TOCA o arquivo direto (confiável); câmera ao vivo usa o stream
        let fileUrl = null;
        try { const s = window.Studio.sourcesInfo().list.find(x => x.id === payload.id); if (s && s.url && s.kind !== 'youtube' && !/^data:image|\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(s.url)) fileUrl = s.url; } catch (e) {}
        g.update(o.id, fileUrl ? { src: fileUrl, label: payload.label || 'Vídeo', fit: 'cover' } : { sourceId: payload.id, label: payload.label || 'Câmera', fit: 'cover' });
      } else {
        g.update(o.id, { src: payload.src, label: payload.name || 'Vídeo', fit: 'cover' });
      }
      g.setPos(o.id, 0, 0); g.setWidth(o.id, 100); g.setHeight(o.id, 100);
      if (g.select) g.select(o.id);
      toast('Fonte na cena (tela cheia) — redimensione pra PiP se quiser.');
    }
    refreshPreviewEmpty();
    return made;
  }

  function payloadFromDrop(e) {
    let raw = ''; try { raw = e.dataTransfer.getData(MIME); } catch {}
    if (raw) { try { return JSON.parse(raw); } catch { return null; } }
    // arrastou ARQUIVO do desktop direto pro preview
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && /^image\//.test(f.type)) { return { kind: 'image', _file: f, name: f.name }; }
    if (f && /^video\//.test(f.type) && window.Studio && window.Studio.addVideoFile) { window.Studio.addVideoFile(f); toast('Vídeo virou fonte — arraste o card pro PREVIEW.'); return null; }
    return null;
  }
  function bindDropZone() {
    const mon = $('previewMon'); if (!mon || mon.__libDrop) return; mon.__libDrop = true;
    const hasOurs = (e) => { try { return [...e.dataTransfer.types].some(t => t === MIME || t === 'Files'); } catch { return true; } };
    mon.addEventListener('dragover', e => { if (!hasOurs(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; mon.classList.add('lib-dropping'); });
    mon.addEventListener('dragleave', e => { if (!mon.contains(e.relatedTarget)) mon.classList.remove('lib-dropping'); });
    mon.addEventListener('drop', e => {
      mon.classList.remove('lib-dropping');
      const payload = payloadFromDrop(e); if (!payload) return; e.preventDefault();
      // se soltou em cima de um QUADRO da grade, preenche o quadro em vez de criar camada nova
      if (payload.kind === 'source' && payload.id && window.Grid && window.Grid.fillSlotAt && window.Grid.fillSlotAt(e.clientX, e.clientY, payload.id)) return;
      const host = $('prevOverlay') || mon; const r = host.getBoundingClientRect();
      const xPct = clamp((e.clientX - r.left) / r.width * 100), yPct = clamp((e.clientY - r.top) / r.height * 100);
      if (payload._file) { const rd = new FileReader(); rd.onload = () => { const a = addImageAsset(payload.name, rd.result); addLayer({ kind: 'image', src: a.src, name: a.name }, xPct, yPct); }; rd.readAsDataURL(payload._file); return; }
      addLayer(payload, xPct, yPct);
    });
  }

  // ---------------------------- mover / redimensionar a camada DIRETO no PREVIEW ----------------------------
  // (o PREVIEW era só leitura; aqui ele vira manipulável — usa só a API pública do Graphics)
  function clearPreviewHandles() { document.querySelectorAll('#prevOverlay .ovh-pv').forEach(n => n.remove()); }
  function syncSel() {
    const g = G(); const sel = (g && g.selected) ? g.selected() : null;
    document.querySelectorAll('#prevOverlay .ovv').forEach(n => n.classList.toggle('libsel', +n.dataset.id === sel));
    const mon = document.getElementById('previewMon'); if (mon) mon.classList.toggle('ov-editing', sel != null);   // abre overflow p/ as alças aparecerem
    drawPreviewHandles();
  }
  // desenha alças (4 cantos = redimensionar · alça de cima = girar) na camada selecionada, no PREVIEW
  function drawPreviewHandles() {
    clearPreviewHandles();
    const g = G(); const sel = g && g.selected ? g.selected() : null; if (sel == null) return;
    const o = g.get && g.get(sel); if (!o || !o.elv || o.locked) return;
    const boxed = (o.h != null) && (o.type === 'image' || o.type === 'video');
    ['nw', 'ne', 'se', 'sw'].forEach(corner => { const h = document.createElement('span'); h.className = 'ovh-pv ovh-pv-c ovh-pv-' + corner; bindResizePV(h, o, corner, boxed); o.elv.appendChild(h); });
    const rot = document.createElement('span'); rot.className = 'ovh-pv ovh-pv-rot'; bindRotatePV(rot, o); o.elv.appendChild(rot);
  }
  function bindResizePV(h, o, corner, boxed) {
    h.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault(); const g = G(); const host = $('prevOverlay'); const hr = host.getBoundingClientRect();
      const r = o.elv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d0 = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)), s0 = ((o.data && o.data.pv) ? o.data.pv.scale : o.scale) || 1;
      const CN = { nw: { x: 'l', y: 't' }, ne: { x: 'r', y: 't' }, se: { x: 'r', y: 'b' }, sw: { x: 'l', y: 'b' } }[corner];
      try { h.setPointerCapture(e.pointerId); } catch (er) {}
      const clmp = v => Math.max(0, Math.min(90, v));
      const mv = ev => {
        if (ev.altKey && (o.type === 'image' || o.type === 'video') && g.setCrop) {  // ALT = cortar (recortar) a imagem por esse canto
          const p = {};
          if (CN.x === 'l') p.l = clmp((ev.clientX - r.left) / r.width * 100); else p.r = clmp((r.right - ev.clientX) / r.width * 100);
          if (CN.y === 't') p.t = clmp((ev.clientY - r.top) / r.height * 100); else p.b = clmp((r.bottom - ev.clientY) / r.height * 100);
          g.setCrop(o.id, p); return;
        }
        if (boxed) {
          let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
          if (CN.x === 'l') left = ev.clientX; else right = ev.clientX;
          if (CN.y === 't') top = ev.clientY; else bottom = ev.clientY;
          const nw = Math.max(5, Math.abs(right - left) / hr.width * 100), nh = Math.max(5, Math.abs(bottom - top) / hr.height * 100);
          g.setPrevWidth(o.id, nw); g.setPrevHeight(o.id, nh); g.setPrevPos(o.id, (Math.min(left, right) - hr.left) / hr.width * 100, (Math.min(top, bottom) - hr.top) / hr.height * 100);
        } else { g.setPrevScale(o.id, Math.max(.15, Math.min(8, s0 * Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0))); }
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  function bindRotatePV(h, o) {
    h.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault(); const g = G(); const r = o.elv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a0 = Math.atan2(e.clientY - cy, e.clientX - cx), r0 = ((o.data && o.data.pv) ? o.data.pv.rotation : o.rotation) || 0;
      try { h.setPointerCapture(e.pointerId); } catch (er) {}
      const mv = ev => { const a = Math.atan2(ev.clientY - cy, ev.clientX - cx); let deg = r0 + (a - a0) * 180 / Math.PI; if (!ev.shiftKey) { const sn = Math.round(deg / 45) * 45; if (Math.abs(deg - sn) < 4) deg = sn; } g.setPrevRotation(o.id, deg); };   // encaixa em 0/45/90 (Shift solta)
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  // ímã de alinhamento: gruda no centro (50%) e nas bordas; T = tolerância em %
  function snapXY(o, nx, ny) {
    const T = 2.2, pv = o.data && o.data.pv;
    const w = (pv && pv.w != null) ? pv.w : o.w, h = (pv && pv.h != null) ? pv.h : o.h;
    let gv = false, gh = false;
    if (w != null) { const cx = nx + w / 2; if (Math.abs(cx - 50) < T) { nx = 50 - w / 2; gv = true; } else if (Math.abs(nx) < T) nx = 0; else if (Math.abs(nx + w - 100) < T) nx = 100 - w; }
    else if (Math.abs(nx - 50) < T) { nx = 50; gv = true; }
    if (h != null) { const cy = ny + h / 2; if (Math.abs(cy - 50) < T) { ny = 50 - h / 2; gh = true; } else if (Math.abs(ny) < T) ny = 0; else if (Math.abs(ny + h - 100) < T) ny = 100 - h; }
    else if (Math.abs(ny - 50) < T) { ny = 50; gh = true; }
    return { x: nx, y: ny, gv, gh };
  }
  function showGuides(v, h) {
    const host = $('prevOverlay'); if (!host) return;
    let gv = host.querySelector('.pv-guide-v'), gh = host.querySelector('.pv-guide-h');
    if (!gv) { gv = el('div', 'pv-guide pv-guide-v'); gv.style.display = 'none'; host.appendChild(gv); }
    if (!gh) { gh = el('div', 'pv-guide pv-guide-h'); gh.style.display = 'none'; host.appendChild(gh); }
    gv.style.display = v ? 'block' : 'none'; gh.style.display = h ? 'block' : 'none';
  }
  // ============== CORTE (Crop) estilo Photoshop ==============
  let cropId = null, cropOrig = null, cropRect = null;
  const cClamp = (v, max) => Math.max(0, Math.min(max == null ? 95 : max, v));
  function startCrop(id) {
    const g = G(); id = (id != null) ? id : (g && g.selected ? g.selected() : null);
    const o = g && g.get && g.get(id); if (!o || (o.type !== 'image' && o.type !== 'video')) { toast('Selecione uma imagem ou vídeo pra cortar (tecla C).'); return; }
    if (cropId != null) endCrop(true);
    cropId = id; cropOrig = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, o.data.crop); cropRect = Object.assign({}, cropOrig);
    const cv = o.elv && o.elv.firstElementChild; if (cv) cv.style.clipPath = '';   // mostra a imagem CHEIA só no PREVIEW; o PROGRAMA mantém o recorte atual no ar até concluir
    if (g.select) g.select(id);
    clearPreviewHandles(); buildCropUI();
    document.addEventListener('keydown', cropKeys, true);
  }
  function endCrop(apply) {
    const g = G(); if (cropId == null) return;
    if (g.setCrop) g.setCrop(cropId, apply ? cropRect : cropOrig);
    cropId = null; cropOrig = null; cropRect = null;
    document.removeEventListener('keydown', cropKeys, true);
    clearCropUI(); drawPreviewHandles();
  }
  function cropKeys(e) { if (cropId == null) return; if (e.key === 'Escape') { e.preventDefault(); endCrop(false); } else if (e.key === 'Enter') { e.preventDefault(); endCrop(true); } }
  function clearCropUI() { document.querySelectorAll('#prevOverlay .pv-crop, #previewMon .pv-croptools').forEach(n => n.remove()); }
  function cropBox() { const g = G(); const o = g.get(cropId); const host = $('prevOverlay'); if (!o || !o.elv || !host) return null; const hr = host.getBoundingClientRect(), br = o.elv.getBoundingClientRect(); return { bx: br.left - hr.left, by: br.top - hr.top, bw: br.width, bh: br.height }; }
  function paintCropRect() {
    const b = cropBox(); if (!b) return; const wrap = document.querySelector('#prevOverlay .pv-crop'); if (!wrap) return;
    const r = wrap.querySelector('.pc-rect');
    r.style.left = (b.bx + b.bw * cropRect.l / 100) + 'px'; r.style.top = (b.by + b.bh * cropRect.t / 100) + 'px';
    r.style.width = (b.bw * (1 - (cropRect.l + cropRect.r) / 100)) + 'px'; r.style.height = (b.bh * (1 - (cropRect.t + cropRect.b) / 100)) + 'px';
  }
  function setAspect(ar) {   // ar = w/h (0 = livre, só centraliza nada)
    if (!ar) return; const b = cropBox(); if (!b) return; const boxR = b.bw / b.bh;
    if (boxR > ar) { const f = ar / boxR; cropRect = { t: 0, b: 0, l: (1 - f) / 2 * 100, r: (1 - f) / 2 * 100 }; }
    else { const f = boxR / ar; cropRect = { l: 0, r: 0, t: (1 - f) / 2 * 100, b: (1 - f) / 2 * 100 }; }
    paintCropRect();
  }
  function bindCropHandle(h, edge) {
    h.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch (er) {}
      const mv = ev => {
        const b = cropBox(); if (!b) return; const px = (ev.clientX - ($('prevOverlay').getBoundingClientRect().left) - b.bx) / b.bw * 100, py = (ev.clientY - ($('prevOverlay').getBoundingClientRect().top) - b.by) / b.bh * 100;
        if (edge.indexOf('w') >= 0) cropRect.l = cClamp(px, 100 - cropRect.r - 5);
        if (edge.indexOf('e') >= 0) cropRect.r = cClamp(100 - px, 100 - cropRect.l - 5);
        if (edge.indexOf('n') >= 0) cropRect.t = cClamp(py, 100 - cropRect.b - 5);
        if (edge.indexOf('s') >= 0) cropRect.b = cClamp(100 - py, 100 - cropRect.t - 5);
        paintCropRect();
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  function buildCropUI() {
    const host = $('prevOverlay'); const mon = document.getElementById('previewMon'); if (!host) return;
    const wrap = el('div', 'pv-crop'); const rect = el('div', 'pc-rect'); wrap.appendChild(rect);
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(edge => { const h = el('span', 'pc-h pc-' + edge); bindCropHandle(h, edge); rect.appendChild(h); });
    host.appendChild(wrap); paintCropRect();
    // barra: proporção + cancelar/concluído
    const tb = el('div', 'pv-croptools');
    const sel = document.createElement('select'); sel.className = 'pc-ar';
    [['Livre', 0], ['1:1', 1], ['16:9', 16 / 9], ['9:16', 9 / 16], ['4:3', 4 / 3], ['3:4', 3 / 4]].forEach(([t, v]) => { const op = document.createElement('option'); op.value = v; op.textContent = t; sel.appendChild(op); });
    sel.onchange = () => setAspect(parseFloat(sel.value));
    const cancel = el('button', 'pc-btn', '✕ Cancelar'); cancel.onclick = () => endCrop(false);
    const done = el('button', 'pc-btn pc-done', '✓ Concluído'); done.onclick = () => endCrop(true);
    tb.append(el('span', 'pc-lab', 'Cortar'), sel, cancel, done); (mon || host).appendChild(tb);
  }

  // ============== APARAR (trim) vídeo: in/out + play ==============
  let trimId = null, trimOrig = null;
  const tFmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; };
  function startTrim(id) {
    const g = G(); id = (id != null) ? id : (g && g.selected ? g.selected() : null);
    const o = g && g.get && g.get(id); if (!o || o.type !== 'video') { toast('Selecione um vídeo pra aparar.'); return; }
    const v = o.elv && o.elv.querySelector('.ov-vid'); if (!v) { toast('Vídeo ainda carregando…'); return; }
    if (trimId != null) endTrim(true);
    trimId = id; trimOrig = { in: o.data.trimIn || 0, out: o.data.trimOut };
    if (g.select) g.select(id);
    buildTrimUI(o, v);
    document.addEventListener('keydown', trimKeys, true);
  }
  function endTrim(apply) {
    const g = G(); if (trimId == null) return;
    if (!apply && g.setTrim) g.setTrim(trimId, { in: trimOrig.in, out: trimOrig.out == null ? 0 : trimOrig.out });
    trimId = null; trimOrig = null;
    document.removeEventListener('keydown', trimKeys, true);
    document.querySelectorAll('#previewMon .pv-trimtools').forEach(n => n.remove());
  }
  function trimKeys(e) { if (trimId == null) return; if (e.key === 'Escape') { e.preventDefault(); endTrim(false); } else if (e.key === 'Enter') { e.preventDefault(); endTrim(true); } }
  function buildTrimUI(o, v) {
    const g = G(); const mon = document.getElementById('previewMon'); if (!mon) return;
    const tb = el('div', 'pv-trimtools');
    tb.innerHTML = '<button class="tt-play pc-btn">▶</button><div class="tt-track"><div class="tt-keep"></div><i class="tt-ph"></i><span class="tt-h tt-in"></span><span class="tt-h tt-out"></span></div><span class="tt-time pc-lab"></span><button class="pc-btn tt-cancel">✕</button><button class="pc-btn pc-done tt-done">✓ Aparar</button>';
    mon.appendChild(tb);
    const track = tb.querySelector('.tt-track'), keep = tb.querySelector('.tt-keep'), hIn = tb.querySelector('.tt-in'), hOut = tb.querySelector('.tt-out'), ph = tb.querySelector('.tt-ph'), timeEl = tb.querySelector('.tt-time'), playB = tb.querySelector('.tt-play');
    const D = () => (isFinite(v.duration) && v.duration > 0) ? v.duration : 1;
    function paint() { const d = D(), ti = o.data.trimIn || 0, to = (o.data.trimOut != null ? o.data.trimOut : d); hIn.style.left = (ti / d * 100) + '%'; hOut.style.left = (to / d * 100) + '%'; keep.style.left = (ti / d * 100) + '%'; keep.style.right = (100 - to / d * 100) + '%'; ph.style.left = (v.currentTime / d * 100) + '%'; timeEl.textContent = tFmt(ti) + ' – ' + tFmt(to); }
    if (o.data.trimOut == null) { if (isFinite(v.duration) && v.duration > 0) o.data.trimOut = v.duration; else v.addEventListener('loadedmetadata', () => { o.data.trimOut = v.duration; paint(); }, { once: true }); }
    function bindH(h, which) {
      h.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch (er) {}
        const r = track.getBoundingClientRect();
        const mv = ev => { const d = D(); let t = Math.max(0, Math.min(d, (ev.clientX - r.left) / r.width * d)); if (which === 'in') g.setTrim(o.id, { in: Math.min(t, (o.data.trimOut || d) - 0.2) }); else g.setTrim(o.id, { out: Math.max(t, (o.data.trimIn || 0) + 0.2) }); try { v.pause(); v.currentTime = (which === 'in') ? (o.data.trimIn || 0) : (o.data.trimOut || d); } catch (e2) {} playB.textContent = '▶'; paint(); };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      });
    }
    bindH(hIn, 'in'); bindH(hOut, 'out');
    playB.onclick = () => { if (v.paused) { try { v.currentTime = o.data.trimIn || 0; } catch (e) {} v.play().catch(() => {}); playB.textContent = '⏸'; } else { v.pause(); playB.textContent = '▶'; } };
    v.addEventListener('timeupdate', paint);
    tb.querySelector('.tt-cancel').onclick = () => endTrim(false);
    tb.querySelector('.tt-done').onclick = () => endTrim(true);
    paint();
  }

  function bindPreviewEdit() {
    const host = $('prevOverlay'); if (!host || host.__libEdit) return; host.__libEdit = true;
    host.addEventListener('pointerdown', e => {
      const node = e.target.closest('.ovv'); if (!node) return;
      const g = G(); const id = +node.dataset.id; const o = g && g.get && g.get(id); if (!o) return;
      if (g.select) g.select(id); syncSel();
      if (o.locked) return;
      const r = host.getBoundingClientRect(), x0 = ((o.data && o.data.pv) ? o.data.pv.x : o.x), y0 = ((o.data && o.data.pv) ? o.data.pv.y : o.y), px = e.clientX, py = e.clientY; let moved = false;
      e.preventDefault();
      const mv = ev => {
        if (!moved && Math.abs(ev.clientX - px) + Math.abs(ev.clientY - py) < 3) return; moved = true;
        let nx = x0 + (ev.clientX - px) / r.width * 100, ny = y0 + (ev.clientY - py) / r.height * 100;
        const snapped = snapXY(o, nx, ny); nx = snapped.x; ny = snapped.y; showGuides(snapped.gv, snapped.gh);
        g.setPrevPos(id, nx, ny);
      };
      const up = () => { showGuides(false, false); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    host.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;            // roda sozinha NÃO mexe (evita zoom sem querer) — só com Ctrl
      const node = e.target.closest('.ovv'); if (!node) return;
      const g = G(); const id = +node.dataset.id; const o = g && g.get && g.get(id); if (!o) return;
      e.preventDefault(); if (g.select) g.select(id); syncSel();
      const f = e.deltaY < 0 ? 1.07 : 0.93;
      const g0 = (o.data && o.data.pv) ? o.data.pv : o;   // mexe no staging (preview), não no ar
      if (o.h != null && (o.type === 'video' || o.type === 'image')) {   // caixa: cresce a partir do centro
        const cw = (g0.w != null ? g0.w : o.w), ch = (g0.h != null ? g0.h : o.h), cx = (g0.x || 0) + cw / 2, cy = (g0.y || 0) + ch / 2, nw = Math.max(5, cw * f), nh = Math.max(5, ch * f);
        g.setPrevWidth(id, nw); g.setPrevHeight(id, nh); g.setPrevPos(id, cx - nw / 2, cy - nh / 2);
      } else { g.setPrevScale(id, ((g0.scale || o.scale || 1)) * f); }
    }, { passive: false });
  }

  // ---------------------------- init ----------------------------
  function init() {
    if (!$('libAssets')) { setTimeout(init, 200); return; }
    loadAssets(); renderAssets(); bindDropZone(); bindPreviewEdit();
    const imp = $('libImport'); if (imp) imp.onclick = importImages;
    // (os cards de FONTE já são arrastáveis pelo studio.js makeTile com text/plain — NÃO duplicar
    //  aqui, senão cada arraste criava 2 camadas. Aqui cuidamos só dos assets/logos.)
    if (G() && G().onChange) G().onChange(() => { refreshPreviewEmpty(); syncSel(); });
    refreshPreviewEmpty();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.Biblioteca = { importImages, addImageAsset, addLayer, refresh: renderAssets, assets: () => assets.slice(), crop: startCrop, trim: startTrim };
})();
