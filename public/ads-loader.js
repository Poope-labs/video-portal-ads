/* public/ads-loader.js */
(function () {
  try {
    var p = (location.pathname || '').toLowerCase();
    if (p.startsWith('/admin')) return; // skip di halaman admin

    var SOCIAL_BAR_JS = "//pl27528520.effectivecpmrate.com/50/fc/b0/50fcb0851ba2e6f04e98b3058b421693.js";
    var POPUNDER_JS   = "//pl27528539.effectivecpmrate.com/24/e5/3f/24e53f9b46e63b6c19a43ce8e5afc0d5.js";

    function load(src) {
      var s = document.createElement('script');
      s.setAttribute('data-cfasync', 'false');
      s.async = true;
      s.src = src;
      (document.head || document.documentElement).appendChild(s);
    }

    load(SOCIAL_BAR_JS);
    load(POPUNDER_JS);
  } catch (e) {}
})();
