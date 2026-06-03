/* ============================================
   PAINÉIS RETRÁTEIS (coluna direita)
   Fechados por padrão · abrem ao passar o mouse ·
   📌 fixa o painel aberto (persiste no localStorage).
   ============================================ */
(function () {
  const KEY = 'sl-pinned-panels';
  let pinned;
  try { pinned = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { pinned = new Set(); }
  const PIN = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="16" x2="12" y2="22"/><path d="M9 2h6l-1 7 3 3v1H7v-1l3-3-1-7z"/></svg>';

  function save() { try { localStorage.setItem(KEY, JSON.stringify([...pinned])); } catch {} }

  function init() {
    const col = document.querySelector('.rightcol'); if (!col) return;
    // 1ª vez: já deixa TRANSMISSÃO e CENAS travados abertos
    if (!localStorage.getItem('kivo-rpanels-init')) { pinned.add('TRANSMISSÃO'); pinned.add('CENAS'); try { localStorage.setItem('kivo-rpanels-init', '1'); } catch {} save(); }
    [...col.querySelectorAll('.rpanel')].forEach((p, i) => {
      if (p.dataset.collap) return; p.dataset.collap = '1';
      let head = p.querySelector('h3');
      if (!head) { head = document.createElement('h3'); head.textContent = p.classList.contains('live-panel') ? 'TRANSMISSÃO' : ('PAINEL ' + (i + 1)); p.insertBefore(head, p.firstChild); }
      const id = (head.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) || ('p' + i);
      // move tudo depois do título pra um corpo retrátil
      const body = document.createElement('div'); body.className = 'rpanel-body';
      while (head.nextSibling) body.appendChild(head.nextSibling);
      p.appendChild(body);
      // botão de fixar
      const pin = document.createElement('button'); pin.type = 'button'; pin.className = 'rpanel-pin'; pin.title = 'Travar aberto'; pin.innerHTML = PIN;
      pin.addEventListener('click', e => {
        e.stopPropagation();
        if (pinned.has(id)) { pinned.delete(id); p.classList.remove('pinned'); pin.classList.remove('on'); }
        else { pinned.add(id); p.classList.add('pinned'); pin.classList.add('on'); }
        save();
      });
      head.insertBefore(pin, head.firstChild);
      p.classList.add('collapsible');
      if (pinned.has(id)) { p.classList.add('pinned'); pin.classList.add('on'); }
    });

    // FONTES — recolhível por CLIQUE/TOQUE (funciona no touch); cabeçalho sempre visível
    const fontes = document.querySelector('.fontes');
    if (fontes && !fontes.dataset.collap) {
      fontes.dataset.collap = '1';
      const head = fontes.querySelector('.sec-head');
      const FKEY = 'kivo-fontes-open';
      fontes.classList.add('collapsible');
      let open = true; try { const v = localStorage.getItem(FKEY); if (v != null) open = v === '1'; } catch {}
      fontes.classList.toggle('fz-open', open);
      if (head) {
        const chev = document.createElement('button'); chev.type = 'button'; chev.className = 'fz-chev'; chev.title = 'Mostrar / ocultar fontes';
        chev.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
        head.appendChild(chev);
        const toggle = () => { open = !fontes.classList.contains('fz-open'); fontes.classList.toggle('fz-open', open); try { localStorage.setItem(FKEY, open ? '1' : '0'); } catch {} };
        head.addEventListener('click', e => { if (e.target.closest('a, input, select')) return; toggle(); });
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
