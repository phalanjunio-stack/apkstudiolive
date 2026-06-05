/* ============================================
   CONVIDADOS (Kivo Link) — convidado entra por LINK (mesma tecnologia do celular/WebRTC).
   "Copiar Link Kivo (Convite)" copia a URL /phone?room=… (mesma do QR) pro convidado entrar
   com câmera/microfone. As fontes kind:'phone' caem no grid REMOTOS (makeTile roteia).
   Mesma rede já funciona; internet precisa servidor público + TURN (passo de infra).
   ============================================ */
(function () {
  function toast(m, ok) { try { const t = document.createElement('div'); t.className = 'toast show' + (ok ? ' ok' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); } catch (e) {} }

  async function inviteUrl() {
    const room = new URLSearchParams(location.search).get('room') || 'cam1';
    let info = {}; try { info = await fetch('/api/info').then(r => r.json()); } catch (e) {}
    const base = info.public || ('https://' + location.hostname + ':' + (info.port || location.port));
    return (info.phoneUrl || (base + '/phone')) + '?room=' + encodeURIComponent(room);
  }
  async function copyInvite() {
    const url = await inviteUrl();
    try { await navigator.clipboard.writeText(url); toast('Link do convidado copiado ✓ — cola no WhatsApp/Telegram', true); }
    catch (e) {
      try { const ta = document.createElement('textarea'); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Link copiado ✓', true); }
      catch (e2) { toast('Copie manualmente: ' + url); }
    }
  }

  function refresh() {
    const grid = document.getElementById('remotosGrid'), head = document.getElementById('remotosHead'), cnt = document.getElementById('remotosCount');
    if (!grid) return;
    const n = grid.querySelectorAll('.fcard').length;
    if (head) head.hidden = n === 0;
    if (cnt) cnt.textContent = n + (n === 1 ? ' online' : ' online');
  }

  function init() {
    const btn = document.getElementById('copyKivoLink');
    if (btn) btn.addEventListener('click', copyInvite);
    const grid = document.getElementById('remotosGrid');
    if (grid && window.MutationObserver) new MutationObserver(refresh).observe(grid, { childList: true });
    refresh();
    window.Guests = { copyInvite, inviteUrl, refresh };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
