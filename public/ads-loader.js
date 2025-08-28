/* public/ads-loader.js */
(function () {
  try {
    // Jangan load iklan di halaman admin
    var p = (location.pathname || '').toLowerCase();
    if (p.startsWith('/admin')) return;

    // ====== Script iklan Adsterra ======
    var SOCIAL_BAR_JS = "//pl27528520.effectivecpmrate.com/50/fc/b0/50fcb0851ba2e6f04e98b3058b421693.js";
    var POPUNDER_JS   = "//pl27528539.effectivecpmrate.com/24/e5/3f/24e53f9b46e63b6c19a43ce8e5afc0d5.js";

    function load(src) {
      if (!src) return;
      var s = document.createElement('script');
      s.setAttribute('data-cfasync', 'false');
      s.async = true;
      s.src = src;
      (document.head || document.documentElement).appendChild(s);
    }

    // Muat Social Bar + Popunder
    load(SOCIAL_BAR_JS);
    load(POPUNDER_JS);
  } catch (e) {
    console && console.warn && console.warn('ads-loader error:', e);
  }
})();
