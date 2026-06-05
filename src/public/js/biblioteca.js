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
      c.addEventListener('click', e => { if (e.target.closest('.lib-x, .lib-hk')) return; addLayer({ kind: 'image', src: a.src, name: a.name }, 50, 50); });
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
  function previewLayers() { try { const g = G(); const ps = g.getPreviewScene ? g.getPreviewScene() : null; return g.listForScene ? g.listForScene(ps) : []; } catch { return []; } }
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
      placeLogo(o, payload.src, xPct, yPct, payload.name);
      if (g.select) g.select(o.id);
      toast('Logo na cena — arraste/roda do mouse redimensiona no PREVIEW.');
    } else {                                         // vídeo (arquivo) ou fonte ao vivo
      const o = g.add('video'); if (!o) return null; made = o;
      g.update(o.id, payload.kind === 'source'
        ? { sourceId: payload.id, label: payload.label || 'Câmera', fit: 'cover' }
        : { src: payload.src, label: payload.name || 'Vídeo', fit: 'cover' });
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
      const r = o.elv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d0 = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)), s0 = o.scale || 1;
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
          g.setWidth(o.id, nw); g.setHeight(o.id, nh); g.setPos(o.id, (Math.min(left, right) - hr.left) / hr.width * 100, (Math.min(top, bottom) - hr.top) / hr.height * 100);
        } else { g.setScale(o.id, Math.max(.15, Math.min(8, s0 * Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0))); }
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  function bindRotatePV(h, o) {
    h.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault(); const g = G(); const r = o.elv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a0 = Math.atan2(e.clientY - cy, e.clientX - cx), r0 = o.rotation || 0;
      try { h.setPointerCapture(e.pointerId); } catch (er) {}
      const mv = ev => { const a = Math.atan2(ev.clientY - cy, ev.clientX - cx); g.setRotation(o.id, r0 + (a - a0) * 180 / Math.PI); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  function bindPreviewEdit() {
    const host = $('prevOverlay'); if (!host || host.__libEdit) return; host.__libEdit = true;
    host.addEventListener('pointerdown', e => {
      const node = e.target.closest('.ovv'); if (!node) return;
      const g = G(); const id = +node.dataset.id; const o = g && g.get && g.get(id); if (!o) return;
      if (g.select) g.select(id); syncSel();
      if (o.locked) return;
      const r = host.getBoundingClientRect(), x0 = o.x, y0 = o.y, px = e.clientX, py = e.clientY; let moved = false;
      e.preventDefault();
      const mv = ev => {
        if (!moved && Math.abs(ev.clientX - px) + Math.abs(ev.clientY - py) < 3) return; moved = true;
        g.setPos(id, x0 + (ev.clientX - px) / r.width * 100, y0 + (ev.clientY - py) / r.height * 100);
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    host.addEventListener('wheel', e => {
      const node = e.target.closest('.ovv'); if (!node) return;
      const g = G(); const id = +node.dataset.id; const o = g && g.get && g.get(id); if (!o) return;
      e.preventDefault(); if (g.select) g.select(id); syncSel();
      const f = e.deltaY < 0 ? 1.07 : 0.93;
      if (o.h != null && (o.type === 'video' || o.type === 'image')) {   // caixa: cresce a partir do centro
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2, nw = Math.max(5, o.w * f), nh = Math.max(5, o.h * f);
        g.setWidth(id, nw); g.setHeight(id, nh); g.setPos(id, cx - nw / 2, cy - nh / 2);
      } else { g.setScale(id, (o.scale || 1) * f); }
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

  window.Biblioteca = { importImages, addImageAsset, addLayer, refresh: renderAssets, assets: () => assets.slice() };
})();
