// GRAPHICS — overlays sobre o PROGRAM: logo/imagem (propaganda), placar de futebol
// (com cronômetro), rodapé animado (ticker). Cada elemento é arrastável e posicionado
// em % (acompanha o formato 16:9/9:16/etc). Persiste no localStorage.
// Obs: por enquanto renderiza no monitor PROGRAM; entra no stream/gravação na fatia de saída.
const Graphics = (function () {
  const KEY = 'sl-overlays';
  let host = null, overlays = [], seq = 1, clockTimer = null, notify = null;

  const DEF = {
    image: () => ({ x: 80, y: 5, w: 15, scale: 1, data: { src: '', label: 'Logo' } }),
    scoreboard: () => ({ x: 4, y: 4, w: 0, scale: 1, data: { home: 'CASA', away: 'VISITANTE', hs: 0, as: 0, clock: 0, running: false, ch: '#1a8cff', ca: '#e74c3c', homeLogo: '', awayLogo: '', design: 'modern' } }),
    ticker: () => ({ x: 0, y: 88, w: 100, scale: 1, data: { text: 'Bem-vindo a transmissao  •  SeteLagoas Live', speed: 18 } }),
    slideshow: () => ({ x: 80, y: 5, w: 18, scale: 1, data: { images: [], interval: 5, transition: 'fade', i: 0 } }),
  };

  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(overlays.map(o => ({ id: o.id, type: o.type, x: o.x, y: o.y, w: o.w, scale: o.scale, visible: o.visible, data: o.data })))); } catch {}
  }
  function emit() { saveLocal(); notify?.(); }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(s)) overlays = s; } catch {}
    overlays.forEach(o => { if (o.id >= seq) seq = o.id + 1; });
  }

  function mount(el) { host = el; renderAll(); ensureClock(); }
  function onChange(fn) { notify = fn; }
  function list() { return overlays; }
  function get(id) { return overlays.find(o => o.id === id); }

  function add(type) {
    if (!DEF[type]) return;
    const ov = Object.assign({ id: seq++, type, visible: true }, DEF[type]());
    overlays.push(ov); renderOne(ov); emit(); return ov;
  }
  function remove(id) { const i = overlays.findIndex(o => o.id === id); if (i < 0) return; overlays[i].el?.remove(); overlays.splice(i, 1); emit(); }
  function setVisible(id, v) { const o = get(id); if (!o) return; o.visible = v; if (o.el) o.el.style.display = v ? '' : 'none'; emit(); }
  function setWidth(id, w) { const o = get(id); if (!o) return; o.w = w; if (o.el) o.el.style.width = w + '%'; saveLocal(); }
  function update(id, patch) { const o = get(id); if (!o) return; Object.assign(o.data, patch); paint(o); saveLocal(); }
  function score(id, side, d) { const o = get(id); if (!o) return; const k = side === 'h' ? 'hs' : 'as'; o.data[k] = Math.max(0, o.data[k] + d); paint(o); saveLocal(); }
  function clockCtl(id, action) { const o = get(id); if (!o) return; if (action === 'toggle') o.data.running = !o.data.running; if (action === 'reset') { o.data.clock = 0; o.data.running = false; } paint(o); saveLocal(); }

  function renderAll() { if (!host) return; host.innerHTML = ''; overlays.forEach(renderOne); }
  function renderOne(ov) {
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'ov ov-' + ov.type;
    el.style.left = ov.x + '%'; el.style.top = ov.y + '%';
    if (ov.w) el.style.width = ov.w + '%';
    if (!ov.visible) el.style.display = 'none';
    el.style.transformOrigin = 'top left';
    el.style.transform = 'scale(' + (ov.scale || 1) + ')';
    ov.el = el;
    if (ov.type === 'image') el.innerHTML = '<img alt="">';
    else if (ov.type === 'scoreboard') el.innerHTML = '<div class="sb"><span class="sb-team sb-h"><img class="sb-logo sb-hl" alt=""><span class="sb-nm"></span></span><span class="sb-score sb-hs"></span><span class="sb-clock"></span><span class="sb-score sb-as"></span><span class="sb-team sb-a"><span class="sb-nm"></span><img class="sb-logo sb-al" alt=""></span></div>';
    else if (ov.type === 'ticker') el.innerHTML = '<div class="tk"><div class="tk-move"><span></span><span></span></div></div>';
    else if (ov.type === 'slideshow') el.innerHTML = '<img class="ss-img" alt="">';
    makeDraggable(ov);
    makeResizable(ov);
    host.appendChild(el);
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
      q('.sb-h').style.background = d.ch; q('.sb-a').style.background = d.ca;
      q('.sb-clock').textContent = fmtClock(d.clock);
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
    }
  }
  function fmtClock(s) { const m = Math.floor(s / 60), ss = s % 60; return m + ':' + String(ss).padStart(2, '0'); }
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
      });
    }, 1000);
  }

  function makeDraggable(ov) {
    const el = ov.el;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, .ov-resize')) return;
      const hr = host.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const offx = e.clientX - er.left, offy = e.clientY - er.top;
      el.classList.add('dragging');
      try { el.setPointerCapture(e.pointerId); } catch {}
      const move = (ev) => {
        let x = (ev.clientX - hr.left - offx) / hr.width * 100;
        let y = (ev.clientY - hr.top - offy) / hr.height * 100;
        ov.x = Math.max(0, Math.min(98, x)); ov.y = Math.max(0, Math.min(98, y));
        el.style.left = ov.x + '%'; el.style.top = ov.y + '%';
      };
      const up = () => { el.classList.remove('dragging'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); saveLocal(); };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
    });
  }
  // alça de redimensionar (arrasta a bolinha do canto pra aumentar/diminuir)
  function makeResizable(ov) {
    const h = document.createElement('span'); h.className = 'ov-resize'; ov.el.appendChild(h);
    h.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, s0 = ov.scale || 1;
      try { h.setPointerCapture(e.pointerId); } catch {}
      const move = (ev) => { const d = (ev.clientX - sx) + (ev.clientY - sy); let s = s0 * (1 + d / 300); s = Math.max(0.3, Math.min(5, s)); ov.scale = s; ov.el.style.transform = 'scale(' + s + ')'; };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); saveLocal(); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
    });
  }

  load();
  return {
    mount, onChange, list, get, add, remove, setVisible, setWidth, update, score, clockCtl,
    boot() { const h = document.getElementById('pgmOverlay'); if (h) mount(h); },
  };
})();
window.Graphics = Graphics;
Graphics.boot();
