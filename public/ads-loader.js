/* public/ads-loader.js */
(function () {
  // ====== JANGAN TAMPILKAN IKLAN DI HALAMAN ADMIN ======
  var path = (location.pathname || '').toLowerCase();
  if (path.startsWith('/admin')) return;

  // ====== GANTI DUA URL DI BAWAH DENGAN URL DARI ADSTERRA ======
  var SOCIAL_BAR_JS = 'https://YOUR-SOCIAL-BAR-SCRIPT-URL.js';
  var POPUNDER_JS   = 'https://YOUR-POPUNDER-SCRIPT-URL.js';

  function loadJS(src, async) {
    var s = document.createElement('script');
    s.setAttribute('data-cfasync', 'false');
    s.async = async !== true; // default true
    s.src = src;
    document.body.appendChild(s);
  }

  // ====== LOAD IKLAN ======
  // Social Bar (1x per page)
  loadJS(<script type='text/javascript' src='//pl27528520.effectivecpmrate.com/50/fc/b0/50fcb0851ba2e6f04e98b3058b421693.js'></script>, true);

  // Popunder
  // (biarkan default dari Adsterra, mereka trigger sesuai aturan frekuensi)
  loadJS(<script type='text/javascript' src='//pl27528539.effectivecpmrate.com/24/e5/3f/24e53f9b46e63b6c19a43ce8e5afc0d5.js'></script>, true);
})();
