// MIXER — mesa de áudio (Web Audio). Cada canal: volume (dB), MUTE (M), SOLO (S),
// FONE/monitor (PFL: ouve só no seu fone, sem afetar o PROGRAM). Fader é um controle
// próprio (arrastável), não <input range> — pra funcionar igual mesa de verdade.
const Mixer = (function () {
  const MAX = 1.5, H = 150, CAP = 14, USABLE = H - CAP;
  let ac, programBus, programDest, masterGain, monitorBus, progMon, masterAn, masterData, masterMeterEl;
  let channels = [], seq = 0, host, headEl, raf = 0, masterVol = 1, masterMuted = false;

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

  function addChannel(node, kind, label) {
    ensureAC(); resume();
    const fader = ac.createGain(); fader.gain.value = 1.0;
    const pfl = ac.createGain(); pfl.gain.value = 0;
    const an = ac.createAnalyser(); an.fftSize = 512;
    node.connect(fader); fader.connect(programBus);
    node.connect(pfl); pfl.connect(monitorBus);
    node.connect(an);
    const ch = { id: ++seq, kind, label, node, fader, pfl, an, data: new Uint8Array(an.fftSize), vol: 1.0, mute: false, solo: false, monitor: false };
    channels.push(ch); applyMix(); render();
    return ch;
  }
  function applyMix() {
    const anySolo = channels.some(c => c.solo), anyPfl = channels.some(c => c.monitor);
    channels.forEach(c => {
      const on = !c.mute && (!anySolo || c.solo);
      c.fader.gain.value = on ? c.vol : 0.0001;
      c.pfl.gain.value = c.monitor ? 1 : 0;
    });
    if (progMon) progMon.gain.value = anyPfl ? 0 : 1;
  }
  function removeChannel(id) { const i = channels.findIndex(c => c.id === id); if (i < 0) return; try { channels[i].node.disconnect(); } catch {} channels.splice(i, 1); applyMix(); render(); }

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
  function addMusic() {
    if (channels.some(c => c.kind === 'music')) return toast('Musica ja esta no mixer.');
    const a = window.BgMusic && window.BgMusic.audio;
    if (!a) return toast('Sem playlist. Va em Audio > Musica de fundo.');
    ensureAC(); resume();
    try { addChannel(ac.createMediaElementSource(a), 'music', 'Musica'); } catch (e) { toast('Nao consegui ligar a musica.'); }
  }
  function addStreamAudio(stream, label) { if (!stream || !stream.getAudioTracks().length) return; ensureAC(); addChannel(ac.createMediaStreamSource(stream), 'cam', label); }

  async function micMenu(ev) {
    document.getElementById('mixMenu')?.remove();
    let devs = [];
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch (e) { return toast('Mic: ' + e.message); }
    const menu = document.createElement('div'); menu.className = 'add-menu'; menu.id = 'mixMenu';
    (devs.length ? devs : [{ deviceId: '', label: 'Microfone padrao' }]).forEach(d => {
      const b = document.createElement('button'); b.textContent = d.label || 'Entrada de audio'; b.onclick = () => { menu.remove(); addMic(d.deviceId, d.label); }; menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = (ev.currentTarget || ev.target).getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - 248)) + 'px'; menu.style.top = (r.bottom + 6) + 'px';
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
    el.innerHTML =
      `<div class="ch-top"><span class="ch-name" title="${c.label}">${c.label}</span><button class="ch-x" title="Remover">&times;</button></div>` +
      `<div class="ch-db">${fmtDb(c.vol)}</div>` +
      '<div class="ch-body">' + SCALE + '<div class="ch-meter"><i></i></div></div>' +
      '<div class="ch-btns"><button class="cb s">S</button><button class="cb m">M</button><button class="cb fone" title="Monitorar no fone (ouco so isso)">&#127911;</button></div>';
    const db = el.querySelector('.ch-db');
    const fader = makeFader(c.vol, (v) => { c.vol = v; db.textContent = fmtDb(v); applyMix(); });
    el.querySelector('.ch-body').insertBefore(fader, el.querySelector('.ch-meter'));
    const sB = el.querySelector('.s'), mB = el.querySelector('.m'), fB = el.querySelector('.fone');
    sB.classList.toggle('on', c.solo); mB.classList.toggle('on', c.mute); fB.classList.toggle('on', c.monitor);
    sB.onclick = () => { c.solo = !c.solo; sB.classList.toggle('on', c.solo); applyMix(); };
    mB.onclick = () => { c.mute = !c.mute; mB.classList.toggle('on', c.mute); applyMix(); };
    fB.onclick = () => { c.monitor = !c.monitor; fB.classList.toggle('on', c.monitor); applyMix(); };
    el.querySelector('.ch-x').onclick = () => removeChannel(c.id);
    c.meterEl = el.querySelector('.ch-meter i');
    return el;
  }
  function masterStrip() {
    const el = document.createElement('div'); el.className = 'ch ch-master';
    el.innerHTML =
      '<div class="ch-top"><span class="ch-name">MASTER</span></div>' +
      `<div class="ch-db">${fmtDb(masterMuted ? 0 : masterVol)}</div>` +
      '<div class="ch-body">' + SCALE + '<div class="ch-meter"><i></i></div></div>' +
      '<div class="ch-btns"><button class="cb m">M</button></div>';
    const db = el.querySelector('.ch-db'), mB = el.querySelector('.m');
    const fader = makeFader(masterVol, (v) => { masterVol = v; if (!masterMuted) masterGain.gain.value = v; db.textContent = fmtDb(v); });
    el.querySelector('.ch-body').insertBefore(fader, el.querySelector('.ch-meter'));
    mB.classList.toggle('on', masterMuted);
    mB.onclick = () => { masterMuted = !masterMuted; masterGain.gain.value = masterMuted ? 0.0001 : masterVol; mB.classList.toggle('on', masterMuted); };
    masterMeterEl = el.querySelector('.ch-meter i');
    return el;
  }
  function loop() {
    const rms = (an, data) => { an.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / data.length) * 2.4); };
    function frame() {
      channels.forEach(c => { if (c.meterEl) c.meterEl.style.height = (rms(c.an, c.data) * 100) + '%'; });
      if (masterAn && masterMeterEl) masterMeterEl.style.height = (rms(masterAn, masterData) * 100) + '%';
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
  return { addMic, addDesktop, addMusic, addStreamAudio, removeChannel, boot, get programStream() { return programDest ? programDest.stream : null; } };
})();
window.Mixer = Mixer;
Mixer.boot();
