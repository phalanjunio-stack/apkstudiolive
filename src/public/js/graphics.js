// GRAPHICS — overlays sobre o PROGRAM: logo/imagem (propaganda), placar de futebol
// (com cronômetro), rodapé animado (ticker). Cada elemento é arrastável e posicionado
// em % (acompanha o formato 16:9/9:16/etc). Persiste no localStorage.
// Obs: por enquanto renderiza no monitor PROGRAM; entra no stream/gravação na fatia de saída.
const Graphics = (function () {
  const KEY = 'sl-overlays';
  let host = null, overlays = [], seq = 1, clockTimer = null, subs = [], selectedId = null, activeScene = null;
  function notify() { subs.forEach(f => { try { f(); } catch {} }); }

  const DEF = {
    image: () => ({ x: 80, y: 5, w: 15, scale: 1, data: { src: '', label: 'Logo' } }),
    scoreboard: () => ({ x: 4, y: 4, w: 0, scale: 1, data: { home: 'CASA', away: 'VISITANTE', hs: 0, as: 0, clock: 0, running: false, ch: '#1a3a7a', ca: '#7a1a1a', homeLogo: '', awayLogo: '', design: 'modern', stage: '', comp: '', added: 0 } }),
    ticker: () => ({ x: 0, y: 88, w: 100, scale: 1, data: { text: 'Bem-vindo a transmissao  •  Kivo Studio', speed: 18 } }),
    slideshow: () => ({ x: 80, y: 5, w: 18, scale: 1, data: { images: [], interval: 5, transition: 'fade', i: 0 } }),
    template: () => ({ x: 6, y: 6, w: 40, scale: 1, data: { art: '', fields: [], name: 'Modelo' } }),
    text: () => ({ x: 22, y: 70, w: 0, scale: 1, data: { text: 'Escreva aqui', size: 36, color: '#ffffff', weight: 800, align: 'center', bg: '' } }),
    video: () => ({ x: 60, y: 58, w: 32, scale: 1, data: { sourceId: null, label: 'Vídeo' } }),
  };
  function tplValue(f, m) {
    if (!f) return '';
    if (f.key === 'text') return f.text || '';
    if (f.key === 'clock') return fmtClock(m.clock || 0);
    if (f.key === 'added') return m.added ? '+' + m.added : '';
    if (f.key === 'homeLogo') return m.homeLogo || '';
    if (f.key === 'awayLogo') return m.awayLogo || '';
    return (m[f.key] != null ? m[f.key] : '');
  }
  function matchData() { const sb = overlays.find(o => o.type === 'scoreboard'); return sb ? sb.data : {}; }
  function paintTemplate(ov) {
    const img = ov.el.querySelector('.tpl-art'), fc = ov.el.querySelector('.tpl-fields'); if (!fc) return;
    const d = ov.data; img.src = d.art || ''; img.style.display = d.art ? '' : 'none';
    ov.el.classList.toggle('tpl-empty', !d.art);
    const m = matchData(); fc.innerHTML = '';
    (d.fields || []).forEach(f => {
      const v = tplValue(f, m);
      const sp = document.createElement('span'); sp.className = 'tpl-f';
      sp.style.left = (f.x || 50) + '%'; sp.style.top = (f.y || 50) + '%';
      sp.style.fontSize = (f.size || 18) + 'px'; sp.style.color = f.color || '#ffffff';
      sp.style.fontWeight = f.weight || 800; sp.style.textAlign = f.align || 'center';
      sp.style.fontFamily = 'Plus Jakarta Sans,Inter,"Segoe UI",system-ui,sans-serif';
      if (f.key === 'homeLogo' || f.key === 'awayLogo') sp.innerHTML = v ? '<img src="' + v + '" style="height:' + (f.size || 40) + 'px;display:block">' : '';
      else sp.textContent = v;
      fc.appendChild(sp);
    });
  }

  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(overlays.map(o => ({ id: o.id, type: o.type, x: o.x, y: o.y, w: o.w, scale: o.scale, rotation: o.rotation || 0, opacity: (o.opacity == null ? 1 : o.opacity), visible: o.visible, scene: (o.scene == null ? null : o.scene), data: o.data })))); } catch {}
  }
  function emit() { saveLocal(); notify(); }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(s)) overlays = s; } catch {}
    overlays.forEach(o => { if (o.id >= seq) seq = o.id + 1; });
  }

  function mount(el) {
    host = el; renderAll(); ensureClock();
    // clicar fora dos overlays (e fora dos editores) deseleciona
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.ov') && !e.target.closest('.gfx-dock') && !e.target.closest('.fb-prevstage')) deselect(); }, true);
  }
  function onChange(fn) { subs.push(fn); }
  function hideAll() { overlays.forEach(o => { o.visible = false; if (o.el) o.el.style.display = 'none'; }); if (selectedId != null) select(null); emit(); }
  function showAll() { overlays.forEach(o => { o.visible = true; }); applyVisibility(); emit(); }
  function clearAll() { overlays.slice().forEach(o => { o.el?.remove(); }); overlays = []; selectedId = null; emit(); }
  function flash(id, ms) { setVisible(id, true); setTimeout(() => setVisible(id, false), ms || 6000); }
  function selected() { return selectedId; }
  // exporta/importa o conjunto de camadas (pra CENAS guardarem a sua montagem)
  function exportOverlays() { return overlays.map(o => ({ id: o.id, type: o.type, x: o.x, y: o.y, w: o.w, scale: o.scale, rotation: o.rotation || 0, opacity: (o.opacity == null ? 1 : o.opacity), visible: o.visible, scene: (o.scene == null ? null : o.scene), data: JSON.parse(JSON.stringify(o.data || {})) })); }
  function importOverlays(arr) {
    selectedId = null;
    overlays.forEach(o => { try { o.el && o.el.remove(); } catch {} });
    overlays = (Array.isArray(arr) ? arr : []).map(o => Object.assign({}, o, { el: null, data: JSON.parse(JSON.stringify(o.data || {})) }));
    overlays.forEach(o => { if (o.id >= seq) seq = o.id + 1; });
    if (host && host.parentElement) host.parentElement.classList.remove('ov-editing');
    renderAll(); emit();
  }
  function list() { return overlays; }
  function get(id) { return overlays.find(o => o.id === id); }

  // ===== CENAS: cada camada tem um "dono" (scene). null = global (todas as cenas) =====
  // Trocar de cena NÃO destrói nada — só mostra as camadas da cena ativa + globais.
  function ownedShow(o) { return (o.scene == null || o.scene === activeScene) && o.visible !== false; }
  function applyVisibility() { overlays.forEach(o => { if (o.el) o.el.style.display = ownedShow(o) ? '' : 'none'; }); }
  function setActiveScene(id) { activeScene = (id == null ? null : id); if (selectedId != null) select(null); applyVisibility(); notify(); }
  function getActiveScene() { return activeScene; }
  function listForScene(id) { return overlays.filter(o => o.scene === id); }
  function globals() { return overlays.filter(o => o.scene == null); }
  function listForActive() { return overlays.filter(o => o.scene == null || o.scene === activeScene); }
  function setOverlayScene(id, sceneId) { const o = get(id); if (!o) return; o.scene = (sceneId == null ? null : sceneId); applyVisibility(); emit(); }
  // troca ONDE as camadas são desenhadas (PROGRAM <-> canvas do editor de cena, fora do ar).
  // limpa o host antigo pra não duplicar; re-renderiza no novo. Não mexe nos dados.
  function setHost(el) { if (!el || el === host) return; if (host) host.innerHTML = ''; host = el; selectedId = null; renderAll(); }

  // ===== TIMELINE / ANIMAÇÃO =====
  // o.data.anim = { tin, tout, fin, fout, keys:[{t,x,y,scale,rot,opacity}] }
  // animT = tempo atual (s). null = modo edição (sem filtro de tempo, mostra estático).
  let animT = null;
  function lerp(a, b, f) { a = (a == null ? 0 : a); b = (b == null ? 0 : b); return a + (b - a) * f; }
  function interpKeys(keys, t) {
    const ks = keys.slice().sort((a, b) => a.t - b.t);
    if (t <= ks[0].t) return ks[0];
    const last = ks[ks.length - 1]; if (t >= last.t) return last;
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i], b = ks[i + 1];
      if (t >= a.t && t <= b.t) { const f = (t - a.t) / ((b.t - a.t) || 1);
        return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), scale: lerp(a.scale == null ? 1 : a.scale, b.scale == null ? 1 : b.scale, f), rot: lerp(a.rot, b.rot, f), opacity: lerp(a.opacity == null ? 1 : a.opacity, b.opacity == null ? 1 : b.opacity, f) }; }
    }
    return last;
  }
  function inWindow(o, t) { const a = o.data && o.data.anim; if (!a) return true; if (t < (a.tin || 0)) return false; if (a.tout != null && t > a.tout) return false; return true; }
  function setTime(t, edit) {
    animT = t;
    overlays.forEach(o => {
      if (!o.el) return;
      const base = (o.scene == null || o.scene === activeScene) && o.visible !== false;
      const show = base && (edit || inWindow(o, t));   // edit = sempre visível p/ poder editar; play = respeita janela
      o.el.style.display = show ? '' : 'none';
      if (!show) return;
      const a = o.data && o.data.anim;
      let op = (o.opacity == null ? 1 : o.opacity);
      if (a && !edit) { const tin = a.tin || 0, tout = (a.tout == null ? Infinity : a.tout), fin = a.fin || 0, fout = a.fout || 0;
        if (fin > 0 && t < tin + fin) op *= Math.max(0, Math.min(1, (t - tin) / fin));
        if (fout > 0 && isFinite(tout) && t > tout - fout) op *= Math.max(0, Math.min(1, (tout - t) / fout)); }
      if (a && a.keys && a.keys.length) {
        const k = interpKeys(a.keys, t);
        o.el.style.transformOrigin = 'center center';
        o.el.style.transform = 'rotate(' + (k.rot || 0) + 'deg) scale(' + (k.scale == null ? 1 : k.scale) + ')';
        o.el.style.left = (k.x || 0) + '%'; o.el.style.top = (k.y || 0) + '%';
        o.el.style.opacity = op * (k.opacity == null ? 1 : k.opacity);
      } else { applyTransform(o); o.el.style.left = o.x + '%'; o.el.style.top = o.y + '%'; o.el.style.opacity = op; }
    });
  }
  function clearTime() { animT = null; applyVisibility(); overlays.forEach(o => { if (o.el) { applyTransform(o); o.el.style.left = o.x + '%'; o.el.style.top = o.y + '%'; } }); }
  function ensureAnim(o) { if (!o.data.anim) o.data.anim = { tin: 0, tout: null, fin: 0, fout: 0, keys: [] }; return o.data.anim; }
  function getAnim(id) { const o = get(id); return o && o.data ? (o.data.anim || null) : null; }
  function setAnim(id, patch) { const o = get(id); if (!o) return; Object.assign(ensureAnim(o), patch); saveLocal(); notify(); }
  function clearAnim(id) { const o = get(id); if (!o || !o.data) return; delete o.data.anim; if (o.el) { applyTransform(o); o.el.style.left = o.x + '%'; o.el.style.top = o.y + '%'; } saveLocal(); notify(); }
  function addKeyframe(id, t) {
    const o = get(id); if (!o) return; const a = ensureAnim(o);
    const k = { t: Math.round(t * 100) / 100, x: o.x, y: o.y, scale: o.scale || 1, rot: o.rotation || 0, opacity: (o.opacity == null ? 1 : o.opacity) };
    const i = a.keys.findIndex(z => Math.abs(z.t - k.t) < 0.06);
    if (i >= 0) a.keys[i] = k; else a.keys.push(k);
    a.keys.sort((x, y) => x.t - y.t); saveLocal(); notify(); return k;
  }
  function removeKeyframe(id, t) { const o = get(id); if (!o || !o.data.anim) return; o.data.anim.keys = o.data.anim.keys.filter(k => Math.abs(k.t - t) >= 0.06); saveLocal(); notify(); }

  function add(type) {
    if (!DEF[type]) return;
    const ov = Object.assign({ id: seq++, type, visible: true, scene: activeScene }, DEF[type]());
    overlays.push(ov); renderOne(ov); emit(); return ov;
  }
  // duplica uma camada. toSceneId omitido = mesma cena (leve deslocamento p/ não sobrepor).
  // toSceneId de OUTRA cena = MESMA posição (pra alinhar entre cenas). null = global.
  function duplicate(id, toSceneId) {
    const o = get(id); if (!o) return null;
    const cross = (toSceneId !== undefined && toSceneId !== o.scene);
    const clone = Object.assign({}, o, { id: seq++, el: null, visible: true,
      scene: (toSceneId === undefined ? o.scene : (toSceneId == null ? null : toSceneId)),
      x: o.x + (cross ? 0 : 3), y: o.y + (cross ? 0 : 3),
      data: JSON.parse(JSON.stringify(o.data || {})) });
    delete clone._hideT; delete clone._t; delete clone._paintList;
    overlays.push(clone); renderOne(clone); emit(); return clone;
  }
  function remove(id) { const i = overlays.findIndex(o => o.id === id); if (i < 0) return; overlays[i].el?.remove(); overlays.splice(i, 1); emit(); }
  function setVisible(id, v) {
    const o = get(id); if (!o) return; o.visible = v;
    const show = ownedShow(o);
    if (o.el) {
      if (o.type === 'scoreboard') { // placar surge / recolhe com animação
        clearTimeout(o._hideT);
        if (show) { o.el.style.display = ''; o.el.classList.remove('ov-out'); void o.el.offsetWidth; o.el.classList.add('ov-in'); }
        else { o.el.classList.remove('ov-in'); o.el.classList.add('ov-out'); o._hideT = setTimeout(() => { if (!ownedShow(o)) { o.el.style.display = 'none'; o.el.classList.remove('ov-out'); } }, 430); }
      } else { o.el.style.display = show ? '' : 'none'; }
    }
    emit();
  }
  function setWidth(id, w) { const o = get(id); if (!o) return; o.w = w; if (o.el) o.el.style.width = w + '%'; saveLocal(); }
  function setPos(id, x, y) { const o = get(id); if (!o) return; o.x = Math.max(-20, Math.min(110, x)); o.y = Math.max(-20, Math.min(110, y)); if (o.el) { o.el.style.left = o.x + '%'; o.el.style.top = o.y + '%'; } saveLocal(); }
  function applyTransform(o) { if (!o || !o.el) return; o.el.style.transformOrigin = 'center center'; o.el.style.transform = 'rotate(' + (o.rotation || 0) + 'deg) scale(' + (o.scale || 1) + ')'; o.el.style.opacity = (o.opacity == null ? 1 : o.opacity); }
  // recorte (Alt-crop estilo OBS) — clip-path no conteúdo, sem mudar tamanho/posição
  function cropCss(c) { c = c || {}; const t = c.t || 0, r = c.r || 0, b = c.b || 0, l = c.l || 0; return (t < 0.2 && r < 0.2 && b < 0.2 && l < 0.2) ? '' : 'inset(' + t + '% ' + r + '% ' + b + '% ' + l + '%)'; }
  function applyCrop(o) { if (!o || !o.el) return; const c = o.el.firstElementChild; if (c) c.style.clipPath = cropCss(o.data && o.data.crop); }
  function setCrop(id, patch) { const o = get(id); if (!o) return; o.data.crop = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, o.data.crop, patch); applyCrop(o); saveLocal(); }
  function setScale(id, s) { const o = get(id); if (!o) return; o.scale = Math.max(0.15, Math.min(8, s)); applyTransform(o); saveLocal(); }
  function setRotation(id, deg) { const o = get(id); if (!o) return; o.rotation = ((deg % 360) + 360) % 360; applyTransform(o); saveLocal(); }
  function setOpacity(id, v) { const o = get(id); if (!o) return; o.opacity = Math.max(0, Math.min(1, v)); applyTransform(o); saveLocal(); }
  function raise(id) { const i = overlays.findIndex(o => o.id === id); if (i < 0 || i === overlays.length - 1) return; const [o] = overlays.splice(i, 1); overlays.push(o); if (host && o.el) host.appendChild(o.el); emit(); }
  function lower(id) { const i = overlays.findIndex(o => o.id === id); if (i <= 0) return; const [o] = overlays.splice(i, 1); overlays.unshift(o); if (host && o.el) host.insertBefore(o.el, host.firstChild); emit(); }
  function update(id, patch) { const o = get(id); if (!o) return; Object.assign(o.data, patch); paint(o); if (o.type === 'scoreboard') overlays.forEach(t => { if (t.type === 'template') paintTemplate(t); }); saveLocal(); }
  function score(id, side, d) { const o = get(id); if (!o) return; const k = side === 'h' ? 'hs' : 'as'; o.data[k] = Math.max(0, o.data[k] + d); paint(o); saveLocal(); }
  function clockCtl(id, action) { const o = get(id); if (!o) return; if (action === 'toggle') o.data.running = !o.data.running; if (action === 'reset') { o.data.clock = 0; o.data.running = false; } paint(o); saveLocal(); }

  function renderAll() { if (!host) return; host.innerHTML = ''; overlays.forEach(renderOne); }
  function renderOne(ov) {
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'ov ov-' + ov.type;
    el.style.left = ov.x + '%'; el.style.top = ov.y + '%';
    if (ov.w) el.style.width = ov.w + '%';
    if (!ownedShow(ov)) el.style.display = 'none';
    ov.el = el;
    if (ov.type === 'image') el.innerHTML = '<img alt="">';
    else if (ov.type === 'scoreboard') el.innerHTML = '<div class="sb"><img class="sb-logo sb-hl" alt=""><span class="sb-team sb-h"><span class="sb-nm"></span></span><span class="sb-score sb-hs"></span><span class="sb-mid"><span class="sb-stage"></span><span class="sb-clock"></span><span class="sb-added"></span></span><span class="sb-score sb-as"></span><span class="sb-team sb-a"><span class="sb-nm"></span></span><img class="sb-logo sb-al" alt=""><span class="sb-comp"></span></div>';
    else if (ov.type === 'ticker') el.innerHTML = '<div class="tk"><div class="tk-move"><span></span><span></span></div></div>';
    else if (ov.type === 'slideshow') el.innerHTML = '<img class="ss-img" alt="">';
    else if (ov.type === 'template') el.innerHTML = '<div class="tpl"><img class="tpl-art" alt=""><div class="tpl-fields"></div></div>';
    else if (ov.type === 'text') el.innerHTML = '<div class="ovt"></div>';
    else if (ov.type === 'video') el.innerHTML = '<video class="ov-vid" autoplay playsinline muted></video><span class="ov-vid-ph">Escolha a fonte ▸</span>';
    applyTransform(ov);
    applyCrop(ov);
    makeDraggable(ov);
    host.appendChild(el);
    if (ov.id === selectedId) select(ov.id);
    paint(ov);
  }

  function paint(ov) {
    if (!ov.el) return;
    if (ov.type === 'image') {
      const img = ov.el.querySelector('img');
      img.src = ov.data.src || ''; img.style.display = ov.data.src ? '' : 'none';
      ov.el.classList.toggle('empty', !ov.data.src);
    } else if (ov.type === 'scoreboard') {
      const q = s => ov.el.querySelector(s); const d = ov.data;
      ov.el.querySelector('.sb').className = 'sb sb-' + (d.design || 'modern');
      q('.sb-h .sb-nm').textContent = d.home; q('.sb-a .sb-nm').textContent = d.away;
      q('.sb-hs').textContent = d.hs; q('.sb-as').textContent = d.as;
      q('.sb-h').style.setProperty('--tc', d.ch); q('.sb-a').style.setProperty('--tc', d.ca);
      q('.sb-clock').textContent = fmtClock(d.clock);
      const stg = q('.sb-stage'); if (stg) { stg.textContent = d.stage || ''; stg.style.display = d.stage ? '' : 'none'; }
      const cmp = q('.sb-comp'); if (cmp) { cmp.textContent = d.comp || ''; cmp.style.display = d.comp ? '' : 'none'; }
      const add = q('.sb-added'); if (add) { add.textContent = d.added ? '+' + d.added : ''; add.style.display = d.added ? '' : 'none'; }
      const hl = q('.sb-hl'), al = q('.sb-al');
      hl.src = d.homeLogo || ''; hl.style.display = d.homeLogo ? '' : 'none';
      al.src = d.awayLogo || ''; al.style.display = d.awayLogo ? '' : 'none';
    } else if (ov.type === 'ticker') {
      ov.el.querySelectorAll('.tk-move span').forEach(s => s.textContent = ov.data.text);
      ov.el.querySelector('.tk-move').style.animationDuration = ov.data.speed + 's';
    } else if (ov.type === 'slideshow') {
      const img = ov.el.querySelector('.ss-img'); const imgs = ov.data.images || [];
      if (imgs.length) { ov.data.i = ov.data.i % imgs.length; img.src = imgs[ov.data.i]; img.style.display = ''; img.style.opacity = '1'; ov.el.classList.remove('empty'); }
      else { img.removeAttribute('src'); img.style.display = 'none'; ov.el.classList.add('empty'); }
      ov._t = 0;
    } else if (ov.type === 'template') { paintTemplate(ov); }
    else if (ov.type === 'text') {
      const t = ov.el.querySelector('.ovt'); const d = ov.data;
      t.textContent = d.text || ''; t.style.fontSize = (d.size || 32) + 'px'; t.style.color = d.color || '#fff';
      t.style.fontWeight = d.weight || 800; t.style.textAlign = d.align || 'center';
      t.style.background = d.bg || 'transparent'; t.style.padding = (d.bg ? '8px 14px' : '0');
    } else if (ov.type === 'video') { paintVideo(ov); }
  }
  function fmtClock(s) { const m = Math.floor(s / 60), ss = s % 60; return m + ':' + String(ss).padStart(2, '0'); }
  function paintVideo(ov) {
    const v = ov.el && ov.el.querySelector('.ov-vid'), ph = ov.el && ov.el.querySelector('.ov-vid-ph'); if (!v) return;
    let stream = null;
    try { const s = window.Studio.sourcesInfo().list.find(x => x.id === ov.data.sourceId); stream = s ? s.stream : null; } catch {}
    if (stream) { if (v.srcObject !== stream) { v.srcObject = stream; v.play && v.play().catch(() => {}); } v.style.display = ''; if (ph) ph.style.display = 'none'; }
    else { if (v.srcObject) v.srcObject = null; v.style.display = 'none'; if (ph) ph.style.display = ''; }
  }
  function showSlide(ov, idx) {
    const imgs = ov.data.images || []; const src = imgs[idx]; if (src == null || !ov.el) return;
    ov.data.i = idx;
    const img = ov.el.querySelector('.ss-img'); if (!img) return;
    if ((ov.data.transition || 'fade') === 'none') { img.src = src; return; }
    img.style.opacity = '0';
    setTimeout(() => { img.src = src; img.style.opacity = '1'; }, 260);
  }

  function ensureClock() {
    if (clockTimer) return;
    clockTimer = setInterval(() => {
      overlays.forEach(o => {
        if (o.type === 'scoreboard' && o.data.running) {
          o.data.clock++;
          const c = o.el?.querySelector('.sb-clock'); if (c) c.textContent = fmtClock(o.data.clock);
        }
        if (o.type === 'slideshow' && (o.data.images || []).length > 1) {
          o._t = (o._t || 0) + 1;
          if (o._t >= (o.data.interval || 5)) { o._t = 0; showSlide(o, (o.data.i + 1) % o.data.images.length); }
        }
        if (o.type === 'template') paintTemplate(o); // atualiza relogio/placar nos modelos
        if (o.type === 'video') paintVideo(o); // mantem o stream do PiP fresco (reconexao etc.)
      });
    }, 1000);
  }

  function makeDraggable(ov) {
    const el = ov.el;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, .ovh')) return;
      if (selectedId !== ov.id) select(ov.id);
      const hr = host.getBoundingClientRect();
      const x0 = ov.x, y0 = ov.y, px = e.clientX, py = e.clientY; // arraste por delta (sem pulo)
      el.classList.add('dragging');
      e.preventDefault();
      const move = (ev) => {
        ov.x = Math.max(-20, Math.min(110, x0 + (ev.clientX - px) / hr.width * 100));
        ov.y = Math.max(-20, Math.min(110, y0 + (ev.clientY - py) / hr.height * 100));
        el.style.left = ov.x + '%'; el.style.top = ov.y + '%';
      };
      const up = () => { el.classList.remove('dragging'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); saveLocal(); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  // ===== EDITOR: selecionar + alças (mover/redimensionar/recortar/girar) =====
  function clampc(v, opp) { return Math.max(0, Math.min(95 - (opp || 0), v)); }
  function select(id) {
    selectedId = id;
    overlays.forEach(o => { if (!o.el) return; const on = o.id === id && o.visible !== false; o.el.classList.toggle('ov-selected', on); if (on) ensureHandles(o); else removeHandles(o); });
    if (host && host.parentElement) host.parentElement.classList.toggle('ov-editing', id != null); // libera overflow p/ as alças
    notify();
  }
  function deselect() { if (selectedId != null) select(null); }
  function ensureHandles(ov) {
    const el = ov.el; if (!el || el.querySelector('.ovh-rot')) return;
    ['n', 'e', 's', 'w'].forEach(c => { const h = document.createElement('span'); h.className = 'ovh ovh-e ovh-e-' + c; bindCrop(h, ov, c); el.appendChild(h); });
    ['nw', 'ne', 'se', 'sw'].forEach(c => { const h = document.createElement('span'); h.className = 'ovh ovh-c ovh-c-' + c; bindResize(h, ov, c); el.appendChild(h); });
    const rot = document.createElement('span'); rot.className = 'ovh ovh-rot'; bindRotate(rot, ov); el.appendChild(rot);
    const tb = document.createElement('div'); tb.className = 'ovh ov-tools-bar';
    const mk = (txt, title, fn) => { const b = document.createElement('button'); b.textContent = txt; b.title = title; b.onpointerdown = (e) => e.stopPropagation(); b.onclick = (e) => { e.stopPropagation(); fn(); }; tb.appendChild(b); };
    mk('↺', 'Girar -15°', () => { ov.rotation = (ov.rotation || 0) - 15; applyTransform(ov); saveLocal(); });
    mk('↻', 'Girar +15°', () => { ov.rotation = (ov.rotation || 0) + 15; applyTransform(ov); saveLocal(); });
    mk('0°', 'Endireitar', () => { ov.rotation = 0; applyTransform(ov); saveLocal(); });
    mk('▫', 'Limpar recorte', () => { ov.data.crop = { t: 0, r: 0, b: 0, l: 0 }; applyCrop(ov); saveLocal(); });
    mk('↑', 'Trazer p/ frente', () => raise(ov.id));
    mk('↓', 'Mandar p/ trás', () => lower(ov.id));
    mk('✕', 'Remover', () => { remove(ov.id); selectedId = null; });
    el.appendChild(tb);
  }
  function removeHandles(ov) { if (ov.el) ov.el.querySelectorAll('.ovh').forEach(n => n.remove()); }
  function bindResize(h, ov, corner) {
    const CN = { nw: { x: 'l', sx: 1, y: 't', sy: 1 }, ne: { x: 'r', sx: -1, y: 't', sy: 1 }, se: { x: 'r', sx: -1, y: 'b', sy: -1 }, sw: { x: 'l', sx: 1, y: 'b', sy: -1 } };
    h.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const r = ov.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, W = r.width, H = r.height;
      const d0 = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)), s0 = ov.scale || 1, px = e.clientX, py = e.clientY;
      const c0 = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, ov.data.crop);
      try { h.setPointerCapture(e.pointerId); } catch {}
      const mv = (ev) => {
        if (ev.altKey) {
          const cn = CN[corner], patch = {};
          patch[cn.x] = clampc(c0[cn.x] + (ev.clientX - px) * cn.sx / W * 100, c0[cn.x === 'l' ? 'r' : 'l']);
          patch[cn.y] = clampc(c0[cn.y] + (ev.clientY - py) * cn.sy / H * 100, c0[cn.y === 't' ? 'b' : 't']);
          ov.data.crop = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, ov.data.crop, patch); applyCrop(ov);
        } else { ov.scale = Math.max(0.15, Math.min(8, s0 * Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0)); applyTransform(ov); }
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); saveLocal(); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  function bindCrop(h, ov, edge) {
    const SIDE = { n: 't', e: 'r', s: 'b', w: 'l' }, OPP = { t: 'b', r: 'l', b: 't', l: 'r' };
    h.addEventListener('dblclick', (e) => { e.stopPropagation(); ov.data.crop = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, ov.data.crop, { [SIDE[edge]]: 0 }); applyCrop(ov); saveLocal(); });
    h.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const r = ov.el.getBoundingClientRect(), W = r.width, H = r.height, px = e.clientX, py = e.clientY, side = SIDE[edge];
      const c0 = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, ov.data.crop);
      try { h.setPointerCapture(e.pointerId); } catch {}
      const mv = (ev) => {
        const dx = ev.clientX - px, dy = ev.clientY - py; let val;
        if (edge === 'e') val = c0.r - dx / W * 100; else if (edge === 'w') val = c0.l + dx / W * 100;
        else if (edge === 'n') val = c0.t + dy / H * 100; else val = c0.b - dy / H * 100;
        ov.data.crop = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, ov.data.crop, { [side]: clampc(val, c0[OPP[side]]) }); applyCrop(ov);
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); saveLocal(); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  function bindRotate(h, ov) {
    h.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const r = ov.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a0 = Math.atan2(e.clientY - cy, e.clientX - cx), r0 = ov.rotation || 0;
      try { h.setPointerCapture(e.pointerId); } catch {}
      const mv = (ev) => { const a = Math.atan2(ev.clientY - cy, ev.clientX - cx); ov.rotation = r0 + (a - a0) * 180 / Math.PI; applyTransform(ov); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); saveLocal(); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }

  load();
  return {
    mount, onChange, list, get, add, remove, setVisible, setWidth, setPos, setScale, setRotation, setOpacity, setCrop, raise, lower, update, score, clockCtl,
    select, selected, hideAll, showAll, clearAll, flash, exportOverlays, importOverlays,
    setActiveScene, getActiveScene, listForScene, listForActive, globals, setOverlayScene, duplicate, setHost,
    setTime, clearTime, getAnim, setAnim, clearAnim, addKeyframe, removeKeyframe,
    boot() { const h = document.getElementById('pgmOverlay'); if (h) mount(h); },
  };
})();
window.Graphics = Graphics;
Graphics.boot();
