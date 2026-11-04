/* Fit the request form to the window (desktop / tablet, >= 768px).
   The request page is drawn at fixed Figma sizes, so on a 1080p screen
   (or with Windows display scaling) the bottom of the form fell below the
   fold. The form section (.req) is scaled down just enough that the
   bottom of the form card, plus a 16px margin, fits in the window.
   Never enlarged, never below 70% so text stays readable.
   The thank-you page is scaled so the same content as in Figma
   1232:21317 is above the fold. */
(function () {
  var MIN = 0.7, MARGIN = 16, TY_ABOVE_FOLD = 940;
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
    // thank-you page: Figma 1232:21317 shows 940px of content between the
    // header and the fold (grey line) — intro, "Your request" with both
    // products and the full "We'd like to know you better" card. Scale so
    // the same content is above the fold in this window.
    document.querySelectorAll(".ty").forEach(function (ty) {
      ty.style.zoom = "";
      if (innerWidth < 768 || !ty.offsetParent) return;
      var top = ty.getBoundingClientRect().top + scrollY;
      var z = Math.min(1, (innerHeight - top) / TY_ABOVE_FOLD);
      ty.style.zoom = String(Math.max(MIN, Math.round(z * 1000) / 1000));
    });
  }
  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", function () { setTimeout(fit, 0); });
  window.addEventListener("load", fit);
  if (document.fonts) document.fonts.ready.then(fit);
  fit();
})();
