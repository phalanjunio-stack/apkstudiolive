/* ============================================
   CONFIGURAÇÕES DE ÁUDIO — entrada (microfone) e saída do FONE/monitor.
   Abre pela engrenagem do topo. Escolhe a porta de entrada e a de saída
   (notebook / USB). A saída usa AudioContext.setSinkId quando suportado.
   ============================================ */
(function () {
  const q = (s, r) => (r || document).querySelector(s);
  function esc(e) { if (e.key === 'Escape') close(); }
  function close() { const m = document.getElementById('acfgModal'); if (m) m.remove(); document.removeEventListener('keydown', esc, true); }

  async function open() {
    close();
    const M = window.Mixer;
    const ov = document.createElement('div'); ov.id = 'acfgModal'; ov.className = 'acfg-ov';
    ov.innerHTML =
      '<div class="acfg-card">' +
        '<div class="acfg-head"><b>Configurações de áudio</b><button class="acfg-x" title="Fechar">&times;</button></div>' +
        '<div class="acfg-body">' +
          '<div class="acfg-row"><label>Entrada — microfone / auxiliar (porta que entra)</label>' +
            '<div class="acfg-inline"><select id="acfgIn"><option>Carregando…</option></select>' +
            '<button class="acfg-add" id="acfgAddMic">+ usar</button></div></div>' +
          '<div class="acfg-row"><label>Áudio do computador (desktop)</label>' +
            '<button class="acfg-add" id="acfgDesk">+ capturar áudio do PC</button></div>' +
          '<div class="acfg-row"><label>Fone de ouvido — saída do monitor (notebook ou USB)</label>' +
            '<select id="acfgOut"><option>Carregando…</option></select></div>' +
          '<div class="acfg-hint" id="acfgHint">A saída do fone controla onde VOCÊ ouve (monitor). O programa/stream não muda.</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
    q('.acfg-x', ov).onclick = close;
    document.addEventListener('keydown', esc, true);

    if (!M || !M.listAudioDevices) { q('#acfgHint', ov).textContent = 'Mixer ainda não carregou — abra de novo em instantes.'; return; }
    const { inputs, outputs } = await M.listAudioDevices();
    const inSel = q('#acfgIn', ov), outSel = q('#acfgOut', ov);
    inSel.innerHTML = '';
    (inputs.length ? inputs : [{ deviceId: '', label: 'Microfone padrão' }]).forEach((d, i) => {
      const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || ('Entrada ' + (i + 1)); inSel.appendChild(o);
    });
    outSel.innerHTML = '';
    const supported = M.monitorOutputSupported && M.monitorOutputSupported();
    if (!supported) {
      const o = document.createElement('option'); o.textContent = 'Saída padrão do sistema'; outSel.appendChild(o); outSel.disabled = true;
      q('#acfgHint', ov).textContent = 'Aqui a saída usa o padrão do sistema — pra trocar a porta (USB/notebook), escolha nas Configurações de Som do Windows.';
    } else {
      const cur = M.getMonitorOutput ? M.getMonitorOutput() : '';
      (outputs.length ? outputs : [{ deviceId: '', label: 'Saída padrão' }]).forEach((d, i) => {
        const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || ('Saída ' + (i + 1)); if (d.deviceId === cur) o.selected = true; outSel.appendChild(o);
      });
      outSel.onchange = () => { M.setMonitorOutput(outSel.value); };
    }
    q('#acfgAddMic', ov).onclick = () => {
      if (M.addMic) { const opt = inSel.options[inSel.selectedIndex]; M.addMic(inSel.value, opt ? opt.textContent : ''); }
      close();
    };
    const deskBtn = q('#acfgDesk', ov);
    if (deskBtn) deskBtn.onclick = () => { if (M.addDesktop) { M.addDesktop(); close(); } };
  }

  function wire() {
    const g = [...document.querySelectorAll('.icon-btn')].find(b => (b.getAttribute('title') || '') === 'Configurações');
    if (g && !g.__acfg) { g.__acfg = true; g.addEventListener('click', open); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.AudioCfg = { open };
})();
