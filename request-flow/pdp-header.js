/* PDP header behaviour for the request form + thank-you page: the USP
   bar's X, the country (GB) and currency (£) pickers. Same logic as
   ../nav.js (SHARED: uspClose, curSwitch, langSwitch); nav.js itself needs
   the whole PDP menu, so only these parts are copied. Keep in sync. */
(function () {
  var $ = function (s) { return document.querySelector(s); };

  $("#uspClose")?.addEventListener("click", function () {
    $("#usp").remove();
  });

  var lb = $("#langBtn"), lm = $("#langMenu");
  var cb = $("#curBtn"), cm = $("#curMenu"), sym = $("#curSym");
  if (!lb || !cb) return;

  // currency: prototype only, updates the symbol in the header
  function setCur(open, focus) {
    cm.hidden = !open;
    cb.setAttribute("aria-expanded", open);
    if (open) {
      lm.hidden = true;
      lb.setAttribute("aria-expanded", "false");
      if (focus) cm.querySelector("a").focus();
    }
  }
  cb.addEventListener("click", function (e) { setCur(cm.hidden, e.detail === 0); });
  lb.addEventListener("click", function () { setCur(false); });
  cm.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-cur]");
    if (!a) return;
    e.preventDefault();
    cm.querySelectorAll("a").forEach(function (x) { x.removeAttribute("aria-current"); });
    a.setAttribute("aria-current", "true");
    sym.textContent = a.dataset.sym;
    cb.setAttribute("aria-label", "Currency: " + a.dataset.cur + ". Change currency");
    setCur(false);
    cb.focus();
  });
  document.addEventListener("click", function (e) {
    if (!cm.hidden && !e.target.closest(".cur")) setCur(false);
  });

  // country: opens on hover (mouse) or click / keyboard
  function setLang(open, focus) {
    lm.hidden = !open;
    lb.setAttribute("aria-expanded", open);
    if (open && focus) lm.querySelector("a").focus();
  }
  var wrap = lb.closest(".lang");
  var hoverable = matchMedia("(hover: hover)");
  wrap.addEventListener("mouseenter", function () { if (hoverable.matches) setLang(true); });
  wrap.addEventListener("mouseleave", function () { if (hoverable.matches) setLang(false); });
  lb.addEventListener("click", function (e) {
    setLang(hoverable.matches && e.detail !== 0 ? true : lm.hidden, e.detail === 0);
  });
  document.addEventListener("click", function (e) {
    if (!lm.hidden && !e.target.closest(".lang")) setLang(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!cm.hidden) { setCur(false); cb.focus(); }
    if (!lm.hidden) { setLang(false); lb.focus(); }
  });
})();
