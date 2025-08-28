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
    s.async = async !== false; // default true
    s.src = src;
    document.body.appendChild(s);
  }

  // ====== LOAD IKLAN ======
  // Social Bar (1x per page)
  loadJS(SOCIAL_BAR_JS, true);

  // Popunder
  // (biarkan default dari Adsterra, mereka trigger sesuai aturan frekuensi)
  loadJS(POPUNDER_JS, true);
})();
