/* Controles de janela custom (Electron frameless): min/max/close + topbar arrastável +
   SELETOR DE MONITOR (envia a janela pra outra tela). Liga no bridge window.kivoWin
   (preload.cjs). Funciona no Studio (#winCtrls) e no editor Montar Cena (.window-controls).
   Em navegador comum (sem kivoWin) não faz nada. */
(function () {
  if (!window.kivoWin) return; // só dentro do app desktop
  document.body.classList.add('electron');

  var st = document.createElement('style');
  st.textContent =
    '.kivo-dragbar{-webkit-app-region:drag}' +
    '.kivo-dragbar button,.kivo-dragbar a,.kivo-dragbar input,.kivo-dragbar select,' +
    '.kivo-dragbar [contenteditable],.kivo-dragbar .net,.win-ctrls,.window-controls{-webkit-app-region:no-drag}' +
    '.kw-mon{position:relative;-webkit-app-region:no-drag;width:36px;height:30px;display:inline-grid;place-items:center;border:0;background:transparent;color:#9fb2cf;border-radius:8px;cursor:pointer;transition:background .15s,color .15s}' +
    '.kw-mon:hover{background:rgba(140,165,225,.16);color:#eaf1ff}' +
    '.kw-mon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.kw-mon-menu{position:fixed;min-width:215px;background:#0e1828;border:1px solid rgba(130,140,255,.22);border-radius:11px;box-shadow:0 18px 44px rgba(0,0,0,.55);padding:6px;z-index:99999;display:flex;flex-direction:column;gap:2px}' +
    '.kw-mon-item{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;background:transparent;border:0;color:#e9effc;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;text-align:left}' +
    '.kw-mon-item:hover{background:rgba(120,150,255,.16)}' +
    '.kw-mon-item svg{width:15px;height:15px;flex:none;fill:none;stroke:#7fa0e6;stroke-width:2}' +
    '.kw-mon-item small{margin-left:auto;color:#8090b4;font-weight:500;font-size:11px}' +
    '.kw-mon-empty{padding:9px 10px;color:#8090b4;font-size:12px}';
  document.head.appendChild(st);

  function wireDisplayPicker(ctrls) {
    if (!ctrls || !window.kivoWin.listDisplays) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'kw-mon'; btn.title = 'Enviar pra outra tela / monitor';
    btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
    ctrls.insertBefore(btn, ctrls.firstChild);

    var menu = null;
    function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener('pointerdown', onDoc, true); } }
    function onDoc(e) { if (menu && !menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); }
    function openMenu() {
      closeMenu();
      window.kivoWin.listDisplays().then(function (list) {
        menu = document.createElement('div'); menu.className = 'kw-mon-menu';
        if (!list || !list.length) { var em = document.createElement('div'); em.className = 'kw-mon-empty'; em.textContent = 'Nenhuma tela detectada'; menu.appendChild(em); }
        else if (list.length === 1) { var e1 = document.createElement('div'); e1.className = 'kw-mon-empty'; e1.textContent = 'Só 1 tela conectada'; menu.appendChild(e1); }
        (list || []).forEach(function (d) {
          var it = document.createElement('button'); it.type = 'button'; it.className = 'kw-mon-item';
          it.innerHTML = '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/></svg><span></span><small></small>';
          it.querySelector('span').textContent = d.label + (d.primary ? ' (principal)' : '');
          it.querySelector('small').textContent = d.w + '×' + d.h;
          it.addEventListener('click', function () { window.kivoWin.moveToDisplay(d.id); closeMenu(); });
          menu.appendChild(it);
        });
        document.body.appendChild(menu);   // no body pra não ser cortado pela topbar
        var r = btn.getBoundingClientRect();
        menu.style.top = (r.bottom + 6) + 'px';
        menu.style.right = Math.max(6, window.innerWidth - r.right) + 'px';
        setTimeout(function () { document.addEventListener('pointerdown', onDoc, true); }, 0);
      });
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (menu) closeMenu(); else openMenu(); });
    if (window.kivoWin.onDisplaysChanged) window.kivoWin.onDisplaysChanged(function () { if (menu) openMenu(); });   // monitor (des)conectou → atualiza a lista aberta
  }

  function wire() {
    var ctrls = document.querySelector('#winCtrls, .window-controls');
    var bar = ctrls ? ctrls.closest('header, .dtop, .topbar') : document.querySelector('.dtop');
    if (bar) bar.classList.add('kivo-dragbar');

    var sc = document.getElementById('winCtrls');
    if (sc) sc.hidden = false;

    // resolve os 3 controles ANTES de inserir o botão de monitor (senão a ordem muda)
    var min, max, cl;
    if (document.getElementById('wcMin')) {
      min = document.getElementById('wcMin'); max = document.getElementById('wcMax'); cl = document.getElementById('wcClose');
    } else if (ctrls) {
      var b = ctrls.querySelectorAll('button'); min = b[0]; max = b[1]; cl = b[2];
    }
    if (min) min.addEventListener('click', function (e) { e.preventDefault(); window.kivoWin.minimize(); });
    if (max) max.addEventListener('click', function (e) { e.preventDefault(); window.kivoWin.maximize(); });
    if (cl) cl.addEventListener('click', function () { window.kivoWin.close(); });
    if (window.kivoWin.onMaxChange) {
      window.kivoWin.onMaxChange(function (isMax) { document.body.classList.toggle('win-max', isMax); if (max) max.title = isMax ? 'Restaurar' : 'Maximizar'; });
    }

    if (ctrls) wireDisplayPicker(ctrls);   // adiciona o botão de monitor
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
