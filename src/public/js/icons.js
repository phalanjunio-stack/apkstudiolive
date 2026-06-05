/* ============================================================
   ÍCONES — conjunto ÚNICO de ícones SVG de TRAÇO (estilo Lucide),
   currentColor, sem emoji. Padrão do NOVODESIGN/sitelocal.
   Uso: el.innerHTML = kicon('rotate-cw');  // herda a cor do contexto
   ============================================================ */
(function () {
  const I = {
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    'rotate-cw': '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    'straighten': '<path d="M3 12h18"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M6 9l-3 3 3 3"/><path d="M18 9l3 3-3 3"/>',
    'reset': '<path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-9 9"/><path d="M3 3v6h6"/>',
    'crop': '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
    'crop-clear': '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/><path d="M3 3l18 18"/>',
    'front': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    'back': '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/>',
    'up': '<path d="m18 15-6-6-6 6"/>',
    'down': '<path d="m6 9 6 6 6-6"/>',
    'close': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'fullscreen': '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    'fit': '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
    'duplicate': '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    'trim': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'unlock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    'trash': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'flip-h': '<path d="M12 3v18"/><path d="M16 7l4 5-4 5"/><path d="M8 7l-4 5 4 5"/>',
    'flip-v': '<path d="M3 12h18"/><path d="M7 8l5-4 5 4"/><path d="M7 16l5 4 5-4"/>',
    'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a16 16 0 0 1-2.2 3.2M6.6 6.6A16 16 0 0 0 2 11s3.5 7 10 7a10 10 0 0 0 3.4-.6"/><path d="m2 2 20 20"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 21"/>',
    'video': '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>',
    'text': '<path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M9 20h6"/>',
    'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M6 4v6a6 6 0 0 0 12 0V4Z"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    'ticker': '<rect x="2" y="13" width="20" height="7" rx="1.5"/><path d="M5 16.5h7"/>',
    'template': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    'slideshow': '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
    'play': '<path d="m7 4 13 8-13 8V4Z"/>',
    'pause': '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  };
  window.kicon = function (name, cls) {
    return '<svg class="kic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || '') + '</svg>';
  };
  window.KICONS = I;
})();
