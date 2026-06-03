/* ============================================
   PERFIL — avatar + nome no topbar (editável).
   ============================================ */
(function () {
  const KEY = 'sl-profile';
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const set = p => localStorage.setItem(KEY, JSON.stringify(p));
  const initials = n => ((n || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'KS');
  let btn;

  function paint() { const p = get(); btn.innerHTML = p.avatar ? '<img src="' + p.avatar + '" alt="">' : initials(p.name); btn.title = p.name || 'Perfil'; }

  function openMenu() {
    document.getElementById('profileMenu')?.remove();
    const p = get();
    const m = document.createElement('div'); m.className = 'add-menu profile-menu'; m.id = 'profileMenu';
    const av = document.createElement('div'); av.className = 'pm-av';
    const name = document.createElement('input'); name.id = 'pmName'; name.placeholder = 'Seu nome / canal'; name.value = p.name || '';
    const head = document.createElement('div'); head.className = 'pm-head'; head.append(av, name);
    const photo = document.createElement('button'); photo.className = 'pm-btn'; photo.textContent = 'Trocar foto';
    const saveB = document.createElement('button'); saveB.className = 'pm-btn pm-save'; saveB.textContent = 'Salvar';
    m.append(head, photo, saveB);
    function av0() { const pp = get(); if (pp.avatar) av.innerHTML = '<img src="' + pp.avatar + '" alt="">'; else av.textContent = initials(name.value); }
    av0(); name.addEventListener('input', av0);
    photo.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const pp = get(); pp.avatar = r.result; set(pp); av0(); }; r.readAsDataURL(f); }; i.click(); };
    saveB.onclick = () => { const pp = get(); pp.name = name.value.trim(); set(pp); paint(); m.remove(); };
    document.body.appendChild(m);
    if (window.placeMenu) window.placeMenu(m, btn);
    else { const r = btn.getBoundingClientRect(); m.style.left = Math.max(8, r.right - 240) + 'px'; m.style.top = (r.bottom + 6) + 'px'; }
    setTimeout(() => document.addEventListener('click', function h(e) { if (!m.contains(e.target) && e.target !== btn) { m.remove(); document.removeEventListener('click', h); } }), 0);
  }

  function init() {
    btn = document.querySelector('.dtop-right [title="Perfil"]');
    if (!btn) { setTimeout(init, 300); return; }
    btn.classList.add('profile-btn'); paint();
    btn.addEventListener('click', e => { e.stopPropagation(); openMenu(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
