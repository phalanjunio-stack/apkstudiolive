// MIXER — mesa de áudio (Web Audio). Cada canal: volume (dB), MUTE (M), SOLO (S),
// FONE/monitor (PFL: ouve só no seu fone, sem afetar o PROGRAM). Fader é um controle
// próprio (arrastável), não <input range> — pra funcionar igual mesa de verdade.
const Mixer = (function () {
  const MAX = 1.5, H = 150, CAP = 14, USABLE = H - CAP;
  let ac, programBus, programDest, masterGain, monitorBus, progMon, masterAn, masterData, masterMeterEl;
  let channels = [], seq = 0, host, headEl, raf = 0, masterVol = 1, masterMuted = false, masterMon = true;

  function ensureAC() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    programBus = ac.createGain();
    masterGain = ac.createGain(); masterGain.gain.value = 1;
    programBus.connect(masterGain);
    programDest = ac.createMediaStreamDestination(); masterGain.connect(programDest);
    monitorBus = ac.createGain(); monitorBus.connect(ac.destination);
    progMon = ac.createGain(); progMon.gain.value = 1; masterGain.connect(progMon); progMon.connect(monitorBus);
    masterAn = ac.createAnalyser(); masterAn.fftSize = 512; masterData = new Uint8Array(masterAn.fftSize); masterGain.connect(masterAn);
    loop();
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); }

  function addChannel(node, kind, label, color) {
    ensureAC(); resume();
    const fader = ac.createGain(); fader.gain.value = 1.0;
    const cue = ac.createGain(); cue.gain.value = 0;     // monitor de VÍDEO no fone (pre-fader) — ouve mesmo mudo do ar
    const pfl = ac.createGain(); pfl.gain.value = 0;
    const an = ac.createAnalyser(); an.fftSize = 512;
    node.connect(fader); fader.connect(programBus);       // LIVE (o MUTE controla se vai pro ar)
    node.connect(cue); cue.connect(monitorBus);           // FONE (pre-fader)
    node.connect(pfl); pfl.connect(monitorBus);           // PFL manual (botão fone)
    node.connect(an);
    const ch = { id: ++seq, kind, label, node, fader, cue, pfl, an, data: new Uint8Array(an.fftSize), vol: 1.0, mute: false, solo: false, monitor: false, isVideo: false, color: color || null };
    channels.push(ch); applyMix(); render();
    return ch;
  }
  function applyMix() {
    const anySolo = channels.some(c => c.solo), anyPfl = channels.some(c => c.monitor);
    channels.forEach(c => {
      const on = !c.mute && (!anySolo || c.solo);
      c.fader.gain.value = on ? c.vol : 0.0001;
      c.pfl.gain.value = c.monitor ? 1 : 0; // FONE só quando você aperta o 🎧 (manual)
    });
    if (progMon) progMon.gain.value = (masterMon && !anyPfl) ? 1 : 0;
  }
  function removeChannel(id) { const i = channels.findIndex(c => c.id === id); if (i < 0) return; try { channels[i].node.disconnect(); } catch {} channels.splice(i, 1); applyMix(); render(); }
  // acende um canal (quando você clica na fonte de vídeo)
  function flashEl(el, color) { if (!el) return; if (color) el.style.setProperty('--fc', color); el.classList.remove('kv-flash'); void el.offsetWidth; el.classList.add('kv-flash'); setTimeout(() => el.classList.remove('kv-flash'), 2400); }
  function flashChannel(node) { const c = channels.find(x => x.node === node); if (c) flashEl(c.stripEl, c.color); }
  // seleção persistente: o canal selecionado acende com glow na cor; tira dos outros
  function selectChannel(node) { channels.forEach(c => { if (c.stripEl) c.stripEl.classList.toggle('kv-sel', !!(node && c.node === node && c.color)); }); }
  // desmutar/mutar um canal por código (ex.: TAKE + Play manda o áudio do vídeo pro ar)
  function refreshStripAir(c) {
    const el = c.stripEl; if (!el) return;
    const m = el.querySelector('.cb.m'); if (m) m.classList.toggle('on', c.mute);
    el.dataset.air = c.isVideo ? (!c.mute ? 'program' : (c.monitor ? 'preview' : '')) : '';
    const a = el.querySelector('.ch-air'); if (a) a.textContent = c.isVideo ? (!c.mute ? 'AR' : (c.monitor ? 'FONE' : '')) : '';
  }
  // ao desmutar um vídeo, muta os OUTROS vídeos (só 1 no ar — sem áudio de 2 vídeos)
  function muteOtherVideos(except) {
    let changed = false;
    channels.forEach(x => { if (x.isVideo && x !== except && !x.mute) { x.mute = true; refreshStripAir(x); changed = true; } });
    if (changed) applyMix();
  }
  function setChannelMuted(node, muted) {
    const c = channels.find(x => x.node === node); if (!c) return;
    c.mute = !!muted; applyMix();
    if (c.isVideo && !c.mute) muteOtherVideos(c);
    refreshStripAir(c);
  }

  // ── fontes ──
  async function addMic(deviceId, label) {
    try { ensureAC(); const s = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true }); addChannel(ac.createMediaStreamSource(s), 'mic', label || 'Microfone'); }
    catch (e) { toast('Mic: ' + e.message); }
  }
  async function addDesktop() {
    try {
      ensureAC();
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      s.getVideoTracks().forEach(t => t.stop());
      if (!s.getAudioTracks().length) return toast('Marque "compartilhar audio" na janela.');
      addChannel(ac.createMediaStreamSource(new MediaStream(s.getAudioTracks())), 'desktop', 'Audio do PC');
    } catch (e) { toast('Audio PC: ' + e.message); }
  }
  function musicDecks() { const B = window.BgMusic; if (!B) return []; return (B.decks && B.decks()) || (B.audio ? [B.audio] : []); }
  function buildMusicNode() { const musicIn = ac.createGain(); musicDecks().forEach(el => { try { ac.createMediaElementSource(el).connect(musicIn); } catch {} }); return musicIn; }
  function addMusic() {
    if (channels.some(c => c.kind === 'music')) return toast('Musica ja esta no mixer.');
    if (!musicDecks().length) return toast('Sem playlist. Va em Audio > Musica de fundo.');
    ensureAC(); resume();
    try { addChannel(buildMusicNode(), 'music', 'Musica'); } catch (e) { toast('Nao consegui ligar a musica.'); }
  }
  // roteia a musica de fundo pelo MASTER automaticamente (silencioso, idempotente)
  // — assim voce ouve a musica SO pelo master, nao mais crua no alto-falante.
  function ensureMusic() {
    if (channels.some(c => c.kind === 'music')) return;
    if (!musicDecks().length) return;
    try { ensureAC(); resume(); addChannel(buildMusicNode(), 'music', 'Musica'); } catch {}
  }
  function addStreamAudio(stream, label) { if (!stream || !stream.getAudioTracks().length) return; ensureAC(); addChannel(ac.createMediaStreamSource(stream), 'cam', label); }
  // áudio de um <video>/<audio> direto no mixer (volume controlado pela mesa). Retorna o canal (pra remover depois).
  function addMediaElement(elem, label, color) { try { ensureAC(); resume(); const ch = addChannel(ac.createMediaElementSource(elem), 'media', label || 'Vídeo', color); if (ch) { ch.isVideo = true; ch.mute = true; applyMix(); render(); } return ch; } catch (e) { return null; } }
  function removeChannelByNode(node) { const c = channels.find(x => x.node === node); if (c) removeChannel(c.id); }

  async function micMenu(ev) {
    document.getElementById('mixMenu')?.remove();
    let devs = [];
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch (e) { return toast('Mic: ' + e.message); }
    const menu = document.createElement('div'); menu.className = 'add-menu'; menu.id = 'mixMenu';
    (devs.length ? devs : [{ deviceId: '', label: 'Microfone padrao' }]).forEach(d => {
      const b = document.createElement('button'); b.textContent = d.label || 'Entrada de audio'; b.onclick = () => { menu.remove(); addMic(d.deviceId, d.label); }; menu.appendChild(b);
    });
    document.body.appendChild(menu);
    if (window.placeMenu) window.placeMenu(menu, ev.currentTarget || ev.target);
    else { const r = (ev.currentTarget || ev.target).getBoundingClientRect(); menu.style.left = Math.max(8, Math.min(r.left, innerWidth - 248)) + 'px'; menu.style.top = (r.bottom + 6) + 'px'; }
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
  }

  // ── fader próprio (arrastável) ──
  function makeFader(value, onChange) {
    const track = document.createElement('div'); track.className = 'ch-fader';
    const fill = document.createElement('div'); fill.className = 'ch-fill';
    const cap = document.createElement('div'); cap.className = 'ch-cap';
    track.append(fill, cap);
    function place(v) { const capTop = (1 - v / MAX) * USABLE; cap.style.top = capTop + 'px'; fill.style.height = (H - capTop - CAP / 2) + 'px'; }
    function fromY(clientY) { const r = track.getBoundingClientRect(); let t = clientY - r.top - CAP / 2; t = Math.max(0, Math.min(USABLE, t)); return (1 - t / USABLE) * MAX; }
    let dragging = false;
    const upd = (e) => { value = fromY(e.clientY); place(value); onChange(value); };
    track.addEventListener('pointerdown', (e) => { dragging = true; try { track.setPointerCapture(e.pointerId); } catch {} upd(e); });
    track.addEventListener('pointermove', (e) => { if (dragging) upd(e); });
    track.addEventListener('pointerup', () => { dragging = false; });
    track.addEventListener('pointercancel', () => { dragging = false; });
    place(value);
    return track;
  }
  function fmtDb(v) { return v <= 0.001 ? '-∞ dB' : (20 * Math.log10(v)).toFixed(1) + ' dB'; }
  const SCALE = '<div class="ch-scale"><span>0</span><span>20</span><span>40</span><span>60</span></div>';

  // ── UI ──
  function renderHead() {
    if (!headEl) return;
    headEl.innerHTML = '';
    [['+ Mic', micMenu], ['+ Audio PC', addDesktop], ['+ Musica', addMusic]].forEach(([l, fn]) => {
      const b = document.createElement('button'); b.className = 'mixbtn'; b.textContent = l; b.onclick = fn; headEl.appendChild(b);
    });
  }
  function render() {
    if (!host) return;
    host.innerHTML = '';
    if (!channels.length) { host.innerHTML = '<div class="mixer-empty">Nenhum canal ainda. Adicione Mic, Audio do PC ou Musica acima.</div>'; return; }
    channels.forEach(c => host.appendChild(strip(c)));
    host.appendChild(masterStrip());
  }
  function strip(c) {
    const el = document.createElement('div'); el.className = 'ch'; el.dataset.id = c.id;
    if (c.color) { el.style.setProperty('--cc', c.color); if (c.isVideo) el.dataset.vid = '1'; } // cor de identificação (bate com o card da fonte)
    const airD = () => c.isVideo ? (!c.mute ? 'program' : (c.monitor ? 'preview' : '')) : '';
    const airT = () => c.isVideo ? (!c.mute ? 'AR' : (c.monitor ? 'FONE' : '')) : '';
    const airUpd = () => { el.dataset.air = airD(); const a = el.querySelector('.ch-air'); if (a) a.textContent = airT(); };
    el.dataset.air = airD();
    el.innerHTML =
      `<div class="ch-top"><span class="ch-name" title="${c.label}">${c.label}</span><span class="ch-air">${airT()}</span><button class="ch-x" title="Remover">&times;</button></div>` +
      `<div class="ch-db">${fmtDb(c.vol)}</div>` +
      '<div class="ch-body">' + SCALE + '<div class="ch-meter"><i></i></div></div>' +
      '<div class="ch-btns"><button class="cb s">S</button><button class="cb m">M</button><button class="cb fone" title="Monitorar no fone (ouco so isso)">&#127911;</button></div>';
    const db = el.querySelector('.ch-db');
    const fader = makeFader(c.vol, (v) => { c.vol = v; db.textContent = fmtDb(v); applyMix(); });
    el.querySelector('.ch-body').insertBefore(fader, el.querySelector('.ch-meter'));
    const sB = el.querySelector('.s'), mB = el.querySelector('.m'), fB = el.querySelector('.fone');
    sB.classList.toggle('on', c.solo); mB.classList.toggle('on', c.mute); fB.classList.toggle('on', c.monitor);
    sB.onclick = () => { c.solo = !c.solo; sB.classList.toggle('on', c.solo); applyMix(); };
    mB.onclick = () => { c.mute = !c.mute; mB.classList.toggle('on', c.mute); applyMix(); if (c.isVideo && !c.mute) muteOtherVideos(c); airUpd(); };
    fB.onclick = () => { c.monitor = !c.monitor; fB.classList.toggle('on', c.monitor); applyMix(); airUpd(); };
    el.querySelector('.ch-x').onclick = () => removeChannel(c.id);
    // clicar no canal acende a FONTE de vídeo correspondente
    el.addEventListener('click', e => { if (e.target.closest('button, .ch-body, .cb')) return; if (window.Studio && window.Studio.selectSourceByNode) window.Studio.selectSourceByNode(c.node); });
    c.meterEl = el.querySelector('.ch-meter i');
    c.stripEl = el;
    return el;
  }
  function masterStrip() {
    const el = document.createElement('div'); el.className = 'ch ch-master';
    el.innerHTML =
      '<div class="ch-top"><span class="ch-name">MASTER</span></div>' +
      `<div class="ch-db">${fmtDb(masterMuted ? 0 : masterVol)}</div>` +
      '<div class="ch-body">' + SCALE + '<div class="ch-meter"><i></i></div></div>' +
      '<div class="ch-btns"><button class="cb m">M</button><button class="cb fone" title="Monitorar o MASTER no fone (referencia)">&#127911;</button></div>';
    const db = el.querySelector('.ch-db'), mB = el.querySelector('.m'), fB = el.querySelector('.fone');
    const fader = makeFader(masterVol, (v) => { masterVol = v; if (!masterMuted) masterGain.gain.value = v; db.textContent = fmtDb(v); });
    el.querySelector('.ch-body').insertBefore(fader, el.querySelector('.ch-meter'));
    mB.classList.toggle('on', masterMuted);
    mB.onclick = () => { masterMuted = !masterMuted; masterGain.gain.value = masterMuted ? 0.0001 : masterVol; mB.classList.toggle('on', masterMuted); };
    fB.classList.toggle('on', masterMon);
    fB.title = 'Monitorar o MASTER no fone (referencia)';
    fB.onclick = () => { masterMon = !masterMon; fB.classList.toggle('on', masterMon); applyMix(); };
    masterMeterEl = el.querySelector('.ch-meter i');
    return el;
  }
  function loop() {
    const rms = (an, data) => { an.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / data.length) * 2.4); };
    function frame() {
      channels.forEach(c => { if (c.meterEl) c.meterEl.style.height = (rms(c.an, c.data) * 100) + '%'; });
      if (masterAn) {
        const ml = rms(masterAn, masterData);
        if (masterMeterEl) masterMeterEl.style.height = (ml * 100) + '%';
        const v = Math.round(ml * 100) + '%';
        document.querySelectorAll('.mon .meter').forEach(m => m.style.setProperty('--vu', v)); // VU nos monitores
      }
      raf = requestAnimationFrame(frame);
    }
    if (!raf) frame();
  }
  function toast(m) { const t = document.createElement('div'); t.className = 'toast show'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }

  function boot() {
    host = document.getElementById('mixer'); headEl = document.getElementById('mixerAdd');
    if (host) { renderHead(); render(); }
    window.addEventListener('pointerdown', resume);
  }
  return { addMic, addDesktop, addMusic, ensureMusic, addStreamAudio, addMediaElement, removeChannel, removeChannelByNode, flashChannel, selectChannel, setChannelMuted, boot, get programStream() { return programDest ? programDest.stream : null; } };
})();
window.Mixer = Mixer;
Mixer.boot();
