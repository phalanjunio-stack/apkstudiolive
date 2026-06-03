/* ============================================
   FUTEBOL — central de partida (placar + cronômetro + eventos)
   Controla o overlay "scoreboard" do motor Graphics e dispara
   lower-thirds (gol / cartão / substituição) sobre o PROGRAM.
   ============================================ */
const Futebol = (function () {
  const GKEY = 'sl-fb-games';
  let sbId = null, tick = null;

  const G = () => window.Graphics;
  function ensure() {
    const g = G(); if (!g) return null;
    let o = g.list().find(x => x.type === 'scoreboard');
    if (!o) o = g.add('scoreboard');
    sbId = o ? o.id : null; return o;
  }
  const ov = () => { const g = G(); return g && sbId != null ? g.get(sbId) : null; };
  const data = () => { const o = ov(); return o ? o.data : {}; };
  function up(patch) { const g = G(); if (g && sbId != null) g.update(sbId, patch); }

  // ---- helpers ----
  function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  const fmt = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const minute = () => Math.floor((data().clock || 0) / 60) + 1;
  const esc = s => String(s == null ? '' : s).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  function pick(accept, cb) { const i = el('input'); i.type = 'file'; i.accept = accept; i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f); }; i.click(); }

  // ---- cronômetro / período ----
  function startPause() { const g = G(); if (g && sbId != null) g.clockCtl(sbId, 'toggle'); }
  function zero() { const g = G(); if (g && sbId != null) g.clockCtl(sbId, 'reset'); }
  function preset(stage, clock, run) {
    const o = ov(); if (!o) return;
    if (clock != null) o.data.clock = clock;
    if (run != null) o.data.running = run;
    up({ stage });
  }
  function setVisible(v) { const g = G(); if (g && sbId != null) g.setVisible(sbId, v); }

  // ---- eventos (lower-thirds sobre o PROGRAM) ----
  const color = side => side === 'h' ? (data().ch || '#1a8cff') : (data().ca || '#e74c3c');
  const name = side => esc(side === 'h' ? data().home : data().away);
  const logo = side => side === 'h' ? (data().homeLogo || '') : (data().awayLogo || '');
  const teamRaw = side => side === 'h' ? (data().home || '') : (data().away || '');
  const initials3 = s => String(s || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  function crestHTML(side) { const lg = logo(side); return '<span class="fb-crest" style="--tc:' + color(side) + '">' + (lg ? '<img src="' + esc(lg) + '" alt="">' : esc(initials3(teamRaw(side)))) + '</span>'; }
  function banner(html, cls) {
    const host = document.getElementById('pgmOverlay'); if (!host) return;
    const b = el('div', 'fb-banner ' + (cls || ''), html);
    host.appendChild(b);
    requestAnimationFrame(() => b.classList.add('show'));
    setTimeout(() => { b.classList.remove('show'); setTimeout(() => b.remove(), 600); }, 6000);
  }
  // ----- CONFIG DA ANIMAÇÃO DO GOL (estilo · velocidade · tempo que fica) -----
  const GOLCFG = 'kivo-gol-cfg';
  const GOL_STYLES = ['wave', 'drop', 'zoom', 'slide', 'neon'];
  function golGet() { let c; try { c = JSON.parse(localStorage.getItem(GOLCFG) || '{}'); } catch { c = {}; } return Object.assign({ style: 'wave', speed: 50, hold: 1.4 }, c); }
  const golFactor = v => v <= 50 ? 0.5 + (v / 50) * 0.5 : 1 + ((v - 50) / 50) * 0.8; // 0=rápido(.5x)·50=normal·100=lento(1.8x)
  function golApplyVars() {
    const c = golGet(), f = golFactor(c.speed), r = document.documentElement.style;
    r.setProperty('--gol-stagger', (0.10 * f).toFixed(3) + 's');
    r.setProperty('--gol-dur', (0.50 * f).toFixed(3) + 's');
  }
  function golSet(patch) { const c = Object.assign(golGet(), patch); try { localStorage.setItem(GOLCFG, JSON.stringify({ style: c.style, speed: +c.speed, hold: +c.hold })); } catch {} golApplyVars(); return c; }
  // GOOOL! sobre o PROGRAM — estilo escolhido + tempo que fica (recolhe sozinho)
  function golBig(side, scorer, hostEl) {
    const host = hostEl || document.getElementById('programMon') || document.getElementById('pgmOverlay'); if (!host) return;
    let g = host.querySelector('.fb-golbig');
    if (!g) { g = el('div', 'fb-golbig'); host.appendChild(g); }
    const c = golGet(), sc = esc((scorer || '').trim());
    const letters = [...'GOOOL!'].map((ch, i) => '<span class="fb-gl" style="--i:' + i + '">' + ch + '</span>').join('');
    g.className = 'fb-golbig fb-anim-' + (GOL_STYLES.includes(c.style) ? c.style : 'wave');
    g.innerHTML = '<b>' + letters + '</b><i>' + (sc ? sc + ' · ' : '') + name(side) + '</i>';
    void g.offsetWidth; g.classList.add('on');
    const f = golFactor(c.speed), wave = c.style === 'wave' || c.style === 'drop';
    const enter = wave ? (1.0 * f) : (0.6 * f);                       // tempo de entrada
    clearTimeout(g._t);
    g._t = setTimeout(() => g.classList.add('fade'), Math.round((enter + Math.max(0.3, +c.hold || 1.4)) * 1000)); // entra + segura → recolhe
    window.SoundFX?.goal?.();
  }
  golApplyVars();
  function celebrate(side) { golBig(side || 'h', ''); }
  function hideGoal() { const h = document.getElementById('programMon'); const g = h && h.querySelector('.fb-golbig'); if (g) g.classList.remove('on'); }
  // CARD DE TÍTULO no PROGRAM (Intervalo / Fim de jogo / Pré-jogo / Pênaltis / Estatísticas / Patrocínio)
  let titleEl = null;
  function titleCard(title, sub, cls) {
    hideTitle();
    const host = document.getElementById('programMon') || document.getElementById('pgmOverlay'); if (!host) return;
    const f = el('div', 'fb-title ' + (cls || ''), '<div class="fb-title-in"><span class="fb-title-t">' + esc(title) + '</span>' + (sub ? '<span class="fb-title-s">' + esc(sub) + '</span>' : '') + '</div>');
    host.appendChild(f); titleEl = f;
    requestAnimationFrame(() => f.classList.add('show'));
  }
  function hideTitle() { if (titleEl) { const f = titleEl; titleEl = null; f.classList.remove('show'); setTimeout(() => { if (f.parentNode) f.remove(); }, 450); } }
  function goal(side, scorer) {
    const g = G(); if (g && sbId != null) g.score(sbId, side, +1);
    const nm = esc((scorer || '').trim());
    banner(crestHTML(side) + '<span class="fb-strip" style="background:' + color(side) + '"></span>' +
      '<div class="fb-main"><span class="fb-tag">GOL</span><span class="fb-team">' + name(side) + '</span>' +
      (nm ? '<span class="fb-name">' + nm + '</span>' : '') + '</div>' +
      '<span class="fb-min">' + minute() + "'</span>", 'fb-goal');
    golBig(side, scorer); // GOOOL! tela inteira + música de comemoração
  }
  function card(side, kind, player) {
    const nm = esc((player || '').trim());
    banner(crestHTML(side) + '<span class="fb-strip" style="background:' + color(side) + '"></span>' +
      '<span class="fb-cardico ' + (kind === 'red' ? 'red' : 'yellow') + '"></span>' +
      '<div class="fb-main"><span class="fb-tag">' + (kind === 'red' ? 'CARTÃO VERMELHO' : 'CARTÃO AMARELO') + '</span>' +
      '<span class="fb-team">' + name(side) + '</span>' + (nm ? '<span class="fb-name">' + nm + '</span>' : '') + '</div>' +
      '<span class="fb-min">' + minute() + "'</span>", 'fb-cardb');
    window.SoundFX?.warn ? window.SoundFX.warn() : window.SoundFX?.click?.();
  }
  function sub(side, out, into) {
    banner(crestHTML(side) + '<span class="fb-strip" style="background:' + color(side) + '"></span>' +
      '<div class="fb-main"><span class="fb-tag">SUBSTITUIÇÃO</span>' +
      '<span class="fb-subnames"><b class="in">&#9650; ' + esc(into || '') + '</b><b class="out">&#9660; ' + esc(out || '') + '</b></span></div>' +
      '<span class="fb-min">' + minute() + "'</span>", 'fb-subb');
    window.SoundFX?.click?.();
  }

  // ---- jogos salvos ----
  const games = () => { try { return JSON.parse(localStorage.getItem(GKEY) || '[]'); } catch { return []; } };
  const saveGames = g => localStorage.setItem(GKEY, JSON.stringify(g));
  function saveCurrent() {
    const d = data();
    const g = games();
    g.push({ comp: d.comp || '', home: d.home, away: d.away, ch: d.ch, ca: d.ca, homeLogo: d.homeLogo || '', awayLogo: d.awayLogo || '' });
    saveGames(g);
  }
  function loadGame(i) {
    const g = games()[i]; if (!g) return;
    up({ comp: g.comp, home: g.home, away: g.away, ch: g.ch, ca: g.ca, homeLogo: g.homeLogo, awayLogo: g.awayLogo, hs: 0, as: 0, clock: 0, stage: '', running: false });
  }
  function delGame(i) { const g = games(); g.splice(i, 1); saveGames(g); }

  // =========================================================
  //  PÁGINA DE CONTROLE
  // =========================================================
  function renderPage() {
    ensure();
    if (tick) { clearInterval(tick); tick = null; }
    const root = el('div', 'fb-page');
    const d = data();

    // helper p/ campo rotulado
    const field = (lab, node) => { const w = el('label', 'fb-field', '<span>' + lab + '</span>'); w.appendChild(node); return w; };
    const panel = (title, extra) => { const c = el('div', 'fb-card'); c.appendChild(el('div', 'fb-card-h', title + (extra || ''))); return c; };

    /* ---- 1. PLACAR + RELÓGIO (cabeçalho) ---- */
    const stage = el('div', 'fb-prevstage');
    stage.innerHTML =
      '<div class="fb-prevstage-tag">Prévia ao vivo <small>— arraste pra mover · cantos = tamanho</small></div>' +
      '<div class="fb-prevstage-inner no-video" id="fbStageInner">' +
      '<video class="fb-prev-video" autoplay muted playsinline></video>' +
      '<span class="fb-live-badge"><i></i>AO VIVO</span>' +
      '<div class="fb-prev-hint">Sem câmera ao vivo — conecte uma câmera ou coloque uma fonte no ar</div></div>' +
      '<div class="fb-prevstage-bar"></div>';
    root.appendChild(stage);
    const stageInner = stage.querySelector('#fbStageInner');
    const bar = stage.querySelector('.fb-prevstage-bar');

    // ===== EDITOR DE CAMADAS (clicar · mover · redimensionar · girar) =====
    let selId = sbId;
    const TYPE = { scoreboard: 'Placar', image: 'Imagem / PNG', slideshow: 'Slideshow', ticker: 'Rodapé' };
    const EYE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYEOFF = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.9 17.9A10 10 0 0 1 12 19C5 19 1 12 1 12a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    // painel de CAMADAS (sempre visível junto da prévia)
    const layers = el('div', 'fb-layers'); bar.after(layers);

    // barra: adicionar + controles da camada selecionada
    const addPng = el('button', 'btn-soft fb-prim', '+ PNG / Imagem');
    addPng.onclick = () => pick('image/*', src => { const o = window.Graphics.add('image'); window.Graphics.update(o.id, { src }); renderProxies(); select(o.id); });
    const addTk = el('button', 'btn-soft', '+ Rodapé');
    addTk.onclick = () => { const o = window.Graphics.add('ticker'); renderProxies(); select(o.id); };
    const opR = el('input'); opR.type = 'range'; opR.min = '0.1'; opR.max = '1'; opR.step = '0.05'; opR.value = '1'; opR.className = 'fb-pb-range'; opR.title = 'Opacidade';
    opR.oninput = () => { if (selId == null) return; window.Graphics.setOpacity(selId, parseFloat(opR.value)); const p = stageInner.querySelector('.fb-proxy[data-id="' + selId + '"]'); if (p) applyP(p, window.Graphics.get(selId)); };
    function rotateBy(d) { if (selId == null) return; const o = window.Graphics.get(selId); window.Graphics.setRotation(selId, (o.rotation || 0) + d); const p = stageInner.querySelector('.fb-proxy[data-id="' + selId + '"]'); if (p) applyP(p, window.Graphics.get(selId)); }
    const rotL = el('button', 'fb-tool', '⟲'); rotL.title = 'Girar −15°'; rotL.onclick = () => rotateBy(-15);
    const rotR = el('button', 'fb-tool', '⟳'); rotR.title = 'Girar +15°'; rotR.onclick = () => rotateBy(15);
    const rot0 = el('button', 'fb-tool', '0°'); rot0.title = 'Endireitar'; rot0.onclick = () => { if (selId != null) { window.Graphics.setRotation(selId, 0); const p = stageInner.querySelector('.fb-proxy[data-id="' + selId + '"]'); if (p) applyP(p, window.Graphics.get(selId)); } };
    const front = el('button', 'fb-tool', 'Frente'); front.onclick = () => { if (selId != null) { window.Graphics.raise(selId); renderProxies(); } };
    const back = el('button', 'fb-tool', 'Trás'); back.onclick = () => { if (selId != null) { window.Graphics.lower(selId); renderProxies(); } };
    const delB = el('button', 'fb-tool fb-del', 'Remover'); delB.onclick = () => { if (selId == null) return; const id = selId; selId = null; window.Graphics.remove(id); renderProxies(); };
    // barra organizada em grupos (adicionar · opacidade · girar · ordem · remover)
    const grp = (...nodes) => { const g = el('div', 'fb-pb-group'); nodes.forEach(n => g.appendChild(n)); return g; };
    bar.append(
      grp(addPng, addTk),
      grp(el('span', 'fb-pb-lab', 'Opacidade'), opR),
      grp(rotL, rotR, rot0),
      grp(front, back),
      delB
    );

    function syncVideo() {
      const vid = stageInner.querySelector('.fb-prev-video'); if (!vid) return;
      const stream = window.Studio?.liveStream?.() || document.getElementById('programVideo')?.srcObject || null;
      if (stream) { if (vid.srcObject !== stream) { vid.srcObject = stream; vid.play?.().catch(() => {}); } stageInner.classList.remove('no-video'); }
      else { if (vid.srcObject) vid.srcObject = null; stageInner.classList.add('no-video'); }
    }
    function applyP(p, o) { if (!p || !o) return; p.style.transformOrigin = 'center center'; p.style.transform = 'rotate(' + (o.rotation || 0) + 'deg) scale(' + (o.scale || 1) + ')'; p.style.opacity = (o.opacity == null ? 1 : o.opacity); }
    function applyCropP(p, c) { const e0 = p.firstElementChild; if (!e0) return; c = c || {}; const t = c.t || 0, r = c.r || 0, b = c.b || 0, l = c.l || 0; e0.style.clipPath = (t < 0.2 && r < 0.2 && b < 0.2 && l < 0.2) ? '' : ('inset(' + t + '% ' + r + '% ' + b + '% ' + l + '%)'); }
    function clampc(v, opp) { return Math.max(0, Math.min(95 - (opp || 0), v)); }

    function proxyFor(o) {
      const p = el('div', 'fb-proxy fb-proxy-' + o.type); p.dataset.id = o.id;
      p.style.left = (o.x || 0) + '%'; p.style.top = (o.y || 0) + '%';
      if (o.type === 'scoreboard') {
        p.innerHTML = '<div class="sb"><img class="sb-logo sb-hl" alt=""><span class="sb-team sb-h"><span class="sb-nm"></span></span><span class="sb-score sb-hs"></span><span class="sb-mid"><span class="sb-stage"></span><span class="sb-clock"></span><span class="sb-added"></span></span><span class="sb-score sb-as"></span><span class="sb-team sb-a"><span class="sb-nm"></span></span><img class="sb-logo sb-al" alt=""><span class="sb-comp"></span></div>';
      } else if (o.type === 'image' || o.type === 'slideshow') {
        const src = o.type === 'image' ? (o.data.src || '') : ((o.data.images || [])[o.data.i || 0] || '');
        p.style.width = (o.w || 15) + '%'; p.innerHTML = '<img class="fb-proxy-img" src="' + src + '" alt="">';
      } else if (o.type === 'ticker') {
        p.style.width = (o.w || 100) + '%'; p.innerHTML = '<div class="fb-proxy-tk">' + esc(o.data.text || '') + '</div>';
      }
      applyP(p, o); applyCropP(p, o.data.crop); bindBody(p); return p;
    }
    function bindBody(p) {
      p.addEventListener('pointerdown', e => {
        if (e.target.closest('.fb-rh, .fb-eh, .fb-rot')) return;
        e.preventDefault();
        const id = +p.dataset.id; if (id !== selId) select(id);
        const o = window.Graphics.get(id); if (!o) return;
        const r = stageInner.getBoundingClientRect(), x0 = o.x || 0, y0 = o.y || 0, px = e.clientX, py = e.clientY;
        try { p.setPointerCapture(e.pointerId); } catch {}
        p.classList.add('drag');
        const mv = ev => { window.Graphics.setPos(id, x0 + (ev.clientX - px) / r.width * 100, y0 + (ev.clientY - py) / r.height * 100); const oo = window.Graphics.get(id); p.style.left = oo.x + '%'; p.style.top = oo.y + '%'; };
        const upf = () => { p.classList.remove('drag'); p.removeEventListener('pointermove', mv); p.removeEventListener('pointerup', upf); };
        p.addEventListener('pointermove', mv); p.addEventListener('pointerup', upf);
      });
    }
    function ensureHandles(p) {
      if (p.querySelector('.fb-rot')) return;
      ['n', 'e', 's', 'w'].forEach(c => { const h = el('span', 'fb-eh fb-eh-' + c); bindCrop(h, p, c); p.appendChild(h); });
      ['nw', 'ne', 'se', 'sw'].forEach(c => { const h = el('span', 'fb-rh fb-rh-' + c); bindResize(h, p, c); p.appendChild(h); });
      const rot = el('span', 'fb-rot'); bindRotate(rot, p); p.appendChild(rot);
    }
    function removeHandles(p) { p.querySelectorAll('.fb-rh, .fb-eh, .fb-rot').forEach(n => n.remove()); }
    function bindResize(h, p, corner) {
      const CN = { nw: { x: 'l', sx: 1, y: 't', sy: 1 }, ne: { x: 'r', sx: -1, y: 't', sy: 1 }, se: { x: 'r', sx: -1, y: 'b', sy: -1 }, sw: { x: 'l', sx: 1, y: 'b', sy: -1 } };
      h.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        const id = +p.dataset.id, o = window.Graphics.get(id); if (!o) return;
        const r = p.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, W = r.width, H = r.height;
        const d0 = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)), s0 = o.scale || 1;
        const c0 = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, o.data.crop), px = e.clientX, py = e.clientY;
        try { h.setPointerCapture(e.pointerId); } catch {}
        const mv = ev => {
          if (ev.altKey) { // ALT = recortar os dois lados do canto (estilo OBS)
            const cn = CN[corner], patch = {};
            patch[cn.x] = clampc(c0[cn.x] + (ev.clientX - px) * cn.sx / W * 100, c0[cn.x === 'l' ? 'r' : 'l']);
            patch[cn.y] = clampc(c0[cn.y] + (ev.clientY - py) * cn.sy / H * 100, c0[cn.y === 't' ? 'b' : 't']);
            window.Graphics.setCrop(id, patch); applyCropP(p, window.Graphics.get(id).data.crop);
          } else { // redimensionar (escala)
            const d = Math.hypot(ev.clientX - cx, ev.clientY - cy); window.Graphics.setScale(id, s0 * d / d0); applyP(p, window.Graphics.get(id));
          }
        };
        const upf = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', upf); };
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', upf);
      });
    }
    // alça de borda = recortar aquele lado (clip). 2 cliques = limpar o recorte daquele lado.
    function bindCrop(h, p, edge) {
      const SIDE = { n: 't', e: 'r', s: 'b', w: 'l' }, OPP = { t: 'b', r: 'l', b: 't', l: 'r' };
      h.addEventListener('dblclick', e => { e.stopPropagation(); const id = +p.dataset.id; window.Graphics.setCrop(id, { [SIDE[edge]]: 0 }); applyCropP(p, window.Graphics.get(id).data.crop); });
      h.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        const id = +p.dataset.id, o = window.Graphics.get(id); if (!o) return;
        const r = p.getBoundingClientRect(), W = r.width, H = r.height;
        const c0 = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, o.data.crop), px = e.clientX, py = e.clientY, side = SIDE[edge];
        try { h.setPointerCapture(e.pointerId); } catch {}
        const mv = ev => {
          const dx = ev.clientX - px, dy = ev.clientY - py; let val;
          if (edge === 'e') val = c0.r - dx / W * 100;
          else if (edge === 'w') val = c0.l + dx / W * 100;
          else if (edge === 'n') val = c0.t + dy / H * 100;
          else val = c0.b - dy / H * 100;
          window.Graphics.setCrop(id, { [side]: clampc(val, c0[OPP[side]]) }); applyCropP(p, window.Graphics.get(id).data.crop);
        };
        const upf = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', upf); };
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', upf);
      });
    }
    function bindRotate(h, p) {
      h.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        const id = +p.dataset.id, o = window.Graphics.get(id); if (!o) return;
        const r = p.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const a0 = Math.atan2(e.clientY - cy, e.clientX - cx), r0 = o.rotation || 0;
        try { h.setPointerCapture(e.pointerId); } catch {}
        const mv = ev => { const a = Math.atan2(ev.clientY - cy, ev.clientX - cx); window.Graphics.setRotation(id, r0 + (a - a0) * 180 / Math.PI); applyP(p, window.Graphics.get(id)); };
        const upf = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', upf); };
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', upf);
      });
    }
    function select(id) {
      selId = id;
      stageInner.querySelectorAll('.fb-proxy').forEach(p => { const on = +p.dataset.id === id; p.classList.toggle('selected', on); if (on) ensureHandles(p); else removeHandles(p); });
      const o = id != null ? window.Graphics.get(id) : null;
      if (o) opR.value = String(o.opacity == null ? 1 : o.opacity);
      renderLayers();
    }
    function renderLayers() {
      layers.innerHTML = '';
      const lst = window.Graphics?.list() || [];
      if (!lst.length) { layers.appendChild(el('span', 'fb-layers-empty', 'Nenhuma camada — adicione um PNG ou rodapé')); return; }
      layers.appendChild(el('span', 'fb-layers-lab', 'CAMADAS'));
      [...lst].reverse().forEach(o => {
        const chip = el('div', 'fb-layer' + (o.id === selId ? ' active' : '') + (o.visible === false ? ' off' : ''));
        const eye = el('button', 'fb-layer-eye'); eye.innerHTML = o.visible === false ? EYEOFF : EYE; eye.title = 'Mostrar / ocultar';
        eye.onclick = ev => { ev.stopPropagation(); window.Graphics.setVisible(o.id, o.visible === false); renderProxies(); };
        chip.append(eye, el('span', 'fb-layer-nm', TYPE[o.type] || 'Camada'));
        chip.onclick = () => select(o.id);
        layers.appendChild(chip);
      });
    }
    function renderProxies() {
      stageInner.querySelectorAll('.fb-proxy').forEach(n => n.remove());
      (window.Graphics?.list() || []).forEach(o => { if (o.visible === false) return; stageInner.appendChild(proxyFor(o)); });
      paintHead(); select(selId);
    }
    // clicar no fundo do palco deseleciona
    stageInner.addEventListener('pointerdown', e => { if (e.target === stageInner || (e.target.classList && e.target.classList.contains('fb-prev-video'))) select(null); });

    renderProxies(); syncVideo();

    /* ---- 2. CRONÔMETRO ---- */
    const cClock = panel('CRONÔMETRO');
    const cl = el('div', 'fb-row');
    const bStart = el('button', 'btn-soft fb-prim', '&#9654; Iniciar / Pausar');
    bStart.onclick = () => { startPause(); paintHead(); };
    const bZero = el('button', 'btn-soft', 'Zerar');
    bZero.onclick = () => { zero(); paintHead(); };
    cl.append(bStart, bZero);
    cClock.appendChild(cl);
    const cp = el('div', 'fb-seg');
    [['1º TEMPO', 0, true], ['INTERVALO', 45 * 60, false], ['2º TEMPO', 45 * 60, true], ['PRORROGAÇÃO', 90 * 60, true], ['ENCERRADO', null, false]]
      .forEach(([s, t, r]) => { const b = el('button', '', s); b.onclick = () => { preset(s, t, r); paintHead(); }; cp.appendChild(b); });
    cClock.appendChild(el('div', 'fb-card-sub', 'Período (ajusta o relógio e mostra no placar)'));
    cClock.appendChild(cp);
    // acréscimos (+N no placar)
    cClock.appendChild(el('div', 'fb-card-sub', 'Acréscimos (mostra +N no placar)'));
    const ad = el('div', 'fb-seg');
    [1, 2, 3, 4, 5].forEach(n => { const b = el('button', '', '+' + n); b.onclick = () => { up({ added: n }); paintHead(); }; ad.appendChild(b); });
    const adClr = el('button', '', 'Limpar'); adClr.onclick = () => { up({ added: 0 }); paintHead(); }; ad.appendChild(adClr);
    cClock.appendChild(ad);
    root.appendChild(cClock);

    /* ---- 3. PLACAR (times) ---- */
    const cScore = panel('PLACAR & TIMES');
    const teams = el('div', 'fb-teams');
    ['h', 'a'].forEach(side => {
      const isH = side === 'h';
      const col = el('div', 'fb-team-col');
      const nm = el('input'); nm.type = 'text'; nm.value = isH ? d.home : d.away;
      nm.oninput = () => { up(isH ? { home: nm.value } : { away: nm.value }); paintHead(); };
      const cor = el('input'); cor.type = 'color'; cor.value = isH ? (d.ch || '#1a3a7a') : (d.ca || '#7a1a1a');
      cor.oninput = () => { up(isH ? { ch: cor.value } : { ca: cor.value }); paintHead(); };
      const shield = el('button', 'btn-soft', 'Escudo&hellip;');
      shield.onclick = () => pick('image/*', src => { up(isH ? { homeLogo: src } : { awayLogo: src }); paintHead(); });
      const sc = el('div', 'fb-scorebtns');
      const minus = el('button', 'fb-sb', '&minus;'); minus.onclick = () => { G().score(sbId, side, -1); paintHead(); };
      const plus = el('button', 'fb-sb fb-sb-plus', '+'); plus.onclick = () => { G().score(sbId, side, +1); paintHead(); };
      sc.append(minus, plus);
      col.append(field(isH ? 'Time da casa' : 'Visitante', nm),
        el('div', 'fb-row2').appendChild ? (() => { const r = el('div', 'fb-row2'); r.append(field('Cor', cor), field('', shield)); return r; })() : cor,
        field('Gols', sc));
      teams.appendChild(col);
    });
    cScore.appendChild(teams);
    const comp = el('input'); comp.type = 'text'; comp.placeholder = 'Ex.: Campeonato Mineiro — Rodada 5'; comp.value = d.comp || '';
    comp.oninput = () => { up({ comp: comp.value }); paintHead(); };
    cScore.appendChild(field('Competição (texto no placar)', comp));
    const vis = el('button', 'btn-soft', 'Mostrar / ocultar placar no ar');
    vis.onclick = () => { const o = ov(); setVisible(!(o && o.visible !== false)); };
    cScore.appendChild(vis);
    root.appendChild(cScore);

    /* ---- 3b. MODELOS DE PLACAR ---- */
    const cM = panel('MODELOS DE PLACAR', ' <small>(troca o design no ar)</small>');
    cM.classList.add('full');
    const MODELS = [['modern', 'Moderno'], ['lateral', 'Lateral Clean'], ['central', 'Central'], ['transparent', 'Transparente'],
      ['premium', 'Premium'], ['vertical', 'Vertical'], ['esportivo', 'Esportivo'], ['classico', 'Clássico']];
    const grid = el('div', 'fb-models');
    function renderModels() {
      grid.innerHTML = '';
      const cur = data().design || 'modern';
      MODELS.forEach(([k, lab], i) => {
        const b = el('button', 'fb-model fb-model-' + k + (k === cur ? ' active' : ''),
          '<span class="fb-model-prev sb-' + k + '"><b class="fb-mp-h"></b><b class="fb-mp-s">2</b><b class="fb-mp-c">45:00</b><b class="fb-mp-s">1</b><b class="fb-mp-a"></b></span>' +
          '<span class="fb-model-tag"><i>' + (i + 1) + '</i>' + lab + '</span>');
        b.onclick = () => { up({ design: k }); renderModels(); paintHead(); };
        grid.appendChild(b);
      });
    }
    renderModels();
    cM.appendChild(grid);
    root.appendChild(cM);

    /* ---- 4. EVENTOS ---- */
    const cEv = panel('EVENTOS', ' <small>(aparecem no ar)</small>');
    const teamSel = () => { const s = el('select'); s.innerHTML = '<option value="h">' + esc(d.home) + '</option><option value="a">' + esc(d.away) + '</option>'; return s; };
    // GOL
    const gWrap = el('div', 'fb-ev');
    const gSel = teamSel(); const gName = el('input'); gName.type = 'text'; gName.placeholder = 'Nome do artilheiro (opcional)';
    const gBtn = el('button', 'fb-ev-btn fb-ev-goal', 'GOL'); gBtn.onclick = () => { goal(gSel.value === 'h' ? 'h' : 'a', gName.value); gName.value = ''; paintHead(); };
    gWrap.append(el('span', 'fb-ev-lab', 'Gol'), gSel, gName, gBtn);
    cEv.appendChild(gWrap);
    // CARTÃO
    const kWrap = el('div', 'fb-ev');
    const kSel = teamSel(); const kName = el('input'); kName.type = 'text'; kName.placeholder = 'Jogador';
    const ky = el('button', 'fb-ev-btn fb-ev-yellow', 'Amarelo'); ky.onclick = () => card2(kSel.value, 'yellow', kName.value, kName);
    const kr = el('button', 'fb-ev-btn fb-ev-red', 'Vermelho'); kr.onclick = () => card2(kSel.value, 'red', kName.value, kName);
    kWrap.append(el('span', 'fb-ev-lab', 'Cartão'), kSel, kName, ky, kr);
    cEv.appendChild(kWrap);
    // SUBSTITUIÇÃO
    const sWrap = el('div', 'fb-ev');
    const sSel = teamSel(); const sOut = el('input'); sOut.type = 'text'; sOut.placeholder = 'Sai'; const sIn = el('input'); sIn.type = 'text'; sIn.placeholder = 'Entra';
    const sBtn = el('button', 'fb-ev-btn', 'Trocar'); sBtn.onclick = () => { sub(sSel.value, sOut.value, sIn.value); sOut.value = ''; sIn.value = ''; };
    sWrap.append(el('span', 'fb-ev-lab', 'Subst.'), sSel, sOut, sIn, sBtn);
    cEv.appendChild(sWrap);
    root.appendChild(cEv);
    function card2(side, kind, player, inp) { card(side, kind, player); if (inp) inp.value = ''; }

    /* ---- 5. JOGOS DO DIA ---- */
    const cG = panel('JOGOS DO DIA');
    const list = el('div', 'fb-games');
    function renderGames() {
      list.innerHTML = '';
      const gs = games();
      if (!gs.length) list.appendChild(el('div', 'hint', 'Nenhum jogo salvo. Configure os times acima e clique em "Salvar este jogo".'));
      gs.forEach((g, i) => {
        const row = el('div', 'fb-game');
        row.innerHTML = '<span class="fb-game-nm">' + esc(g.home) + ' <i>x</i> ' + esc(g.away) + '</span>' +
          (g.comp ? '<span class="fb-game-comp">' + esc(g.comp) + '</span>' : '');
        const load = el('button', 'btn-soft', 'Carregar'); load.onclick = () => { loadGame(i); paintHead(); };
        const del = el('button', 'fb-game-x', '&times;'); del.onclick = () => { delGame(i); renderGames(); };
        row.append(load, del); list.appendChild(row);
      });
    }
    renderGames();
    const saveBtn = el('button', 'btn-soft fb-prim', 'Salvar este jogo'); saveBtn.onclick = () => { saveCurrent(); renderGames(); };
    cG.append(saveBtn, list);
    root.appendChild(cG);

    /* ---- pintura dinâmica do cabeçalho ---- */
    function paintHead() {
      const dd = data();
      const sb = root.querySelector('.fb-prevstage .sb'); if (!sb) return;
      sb.className = 'sb sb-' + (dd.design || 'modern');
      const q = s => sb.querySelector(s);
      q('.sb-h .sb-nm').textContent = dd.home || '';
      q('.sb-a .sb-nm').textContent = dd.away || '';
      q('.sb-hs').textContent = dd.hs || 0;
      q('.sb-as').textContent = dd.as || 0;
      q('.sb-h').style.setProperty('--tc', dd.ch || '#1a3a7a');
      q('.sb-a').style.setProperty('--tc', dd.ca || '#7a1a1a');
      q('.sb-clock').textContent = fmt(dd.clock || 0);
      const stg = q('.sb-stage'); stg.textContent = dd.stage || ''; stg.style.display = dd.stage ? '' : 'none';
      const add = q('.sb-added'); add.textContent = dd.added ? '+' + dd.added : ''; add.style.display = dd.added ? '' : 'none';
      const cmp = q('.sb-comp'); cmp.textContent = dd.comp || ''; cmp.style.display = dd.comp ? '' : 'none';
      const hl = q('.sb-hl'), al = q('.sb-al');
      hl.src = dd.homeLogo || ''; hl.style.display = dd.homeLogo ? '' : 'none';
      al.src = dd.awayLogo || ''; al.style.display = dd.awayLogo ? '' : 'none';
    }
    paintHead(); syncVideo();
    tick = setInterval(() => { if (!root.isConnected) { clearInterval(tick); tick = null; return; } syncVideo(); paintHead(); }, 1000);

    return root;
  }

  return { renderPage, ensure, goal, card, sub, celebrate, hideGoal, titleCard, hideTitle, golGet, golSet, golStyles: GOL_STYLES, golDemo: (hostEl) => golBig('h', '', hostEl) };
})();
window.Futebol = Futebol;
