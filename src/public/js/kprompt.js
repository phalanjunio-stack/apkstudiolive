/* kprompt — substitui o window.prompt() (que o ELECTRON NÃO suporta → retornava null e
   quebrava "nova cena", renomear, colar link). Modal próprio, bonito (glow-shell + som de
   abrir/fechar via observador) e que retorna uma Promise<string|null>. */
(function () {
  function kprompt(message, defaultValue, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'modal-overlay kprompt-ov';
      var shell = document.createElement('div');
      shell.className = 'glow-shell';
      shell.setAttribute('role', 'dialog');
      shell.setAttribute('aria-modal', 'true');
      shell.innerHTML =
        '<div class="glow-modal kprompt-card">' +
          '<div class="gm-head"><h2></h2></div>' +
          '<div class="gm-body">' +
            '<input class="kprompt-input" type="text" autocomplete="off" spellcheck="false" />' +
            '<div class="kprompt-btns">' +
              '<button type="button" class="btn-soft kprompt-cancel">Cancelar</button>' +
              '<button type="button" class="fb-prim kprompt-ok">OK</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      shell.querySelector('h2').textContent = message || '';
      ov.appendChild(shell);
      document.body.appendChild(ov);

      var input = shell.querySelector('.kprompt-input');
      input.value = defaultValue != null ? defaultValue : '';
      if (opts.placeholder) input.placeholder = opts.placeholder;

      var done = false;
      function finish(val) { if (done) return; done = true; ov.remove(); resolve(val); }
      shell.querySelector('.kprompt-ok').addEventListener('click', function () { finish(input.value); });
      shell.querySelector('.kprompt-cancel').addEventListener('click', function () { finish(null); });
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) finish(null); }); // clicar fora = cancela
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      });
      setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 30);
    });
  }
  window.kprompt = kprompt;
})();
