/* Fit the request form to the window (desktop / tablet, >= 768px).
   The request page is drawn at fixed Figma sizes, so on a 1080p screen
   (or with Windows display scaling) the bottom of the form fell below the
   fold. The form section (.req) is scaled down just enough that the
   bottom of the form card, plus a 16px margin, fits in the window.
   Never enlarged, never below 70% so text stays readable.
   The thank-you page (.ty) is too long to fit, so it gets the same scale
   as the request form, keeping both pages the same size. */
(function () {
  var MIN = 0.7, MARGIN = 16;

  function fitReq(req) {
    req.style.zoom = "";
    var form = req.querySelector(".form-card");
    if (!form) return 1;
    var top = req.getBoundingClientRect().top + scrollY;
    var bottom = form.getBoundingClientRect().bottom + scrollY + MARGIN;
    var z = Math.min(1, (innerHeight - top) / (bottom - top));
    z = Math.max(MIN, Math.round(z * 1000) / 1000);
    req.style.zoom = String(z);
    return z;
  }

  function fit() {
    var body = document.body;
    var reqs = document.querySelectorAll(".req");
    var tys = document.querySelectorAll(".ty");
    reqs.forEach(function (r) { r.style.zoom = ""; });
    tys.forEach(function (t) { t.style.zoom = ""; });
    if (innerWidth < 768) return;

    var visible = [].find.call(reqs, function (r) { return r.offsetParent; });
    if (visible) { fitReq(visible); return; }

    var ty = [].find.call(tys, function (t) { return t.offsetParent; });
    if (!ty) return;
    // measure the request form's scale on the (hidden) design screen:
    // switch to it, measure, switch back — all before the next paint
    var screen = body.dataset.screen, y = scrollY;
    body.dataset.screen = "design";
    var req = document.querySelector("#screen-design .req");
    var z = req && req.offsetParent ? fitReq(req) : 1;
    if (req) req.style.zoom = "";
    body.dataset.screen = screen;
    scrollTo(0, y);
    ty.style.zoom = String(z);
  }

  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", function () { setTimeout(fit, 0); });
  window.addEventListener("load", fit);
  if (document.fonts) document.fonts.ready.then(fit);
  fit();
})();
