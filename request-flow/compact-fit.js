/* compact.html — fit the form to the window (desktop / tablet, >= 768px).
   The request page is drawn at fixed Figma sizes, so on a 1080p screen
   (or with Windows display scaling) the bottom of the form fell below the
   fold. The form section (.req) is scaled down just enough that the
   bottom of the form card, plus a 16px margin, fits in the window.
   Never enlarged, never below 70% so text stays readable. */
(function () {
  var MIN = 0.7, MARGIN = 16;
  function fit() {
    document.querySelectorAll(".req").forEach(function (req) {
      req.style.zoom = "";
      if (innerWidth < 768 || !req.offsetParent) return;
      var form = req.querySelector(".form-card");
      if (!form) return;
      var top = req.getBoundingClientRect().top + scrollY;
      var bottom = form.getBoundingClientRect().bottom + scrollY + MARGIN;
      var z = Math.min(1, (innerHeight - top) / (bottom - top));
      req.style.zoom = String(Math.max(MIN, Math.round(z * 1000) / 1000));
    });
  }
  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", function () { setTimeout(fit, 0); });
  window.addEventListener("load", fit);
  if (document.fonts) document.fonts.ready.then(fit);
  fit();
})();
