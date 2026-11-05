/* Request form type scale (desktop request screens, .req).
   User rule (2026-11-04): the smallest text is 15px — anything smaller
   becomes 15px — and every size above 15px grows by 2px; 15px stays.
   Applies to the title, progress bar, request summary (incl. its dropdown
   panels) and the form. Runs after script.js / pdp-header.js have built
   the content and before compact-fit.js measures the form. */
(function () {
  var MIN = 15, STEP = 2;
  function next(px) {
    if (px < MIN) return MIN;
    if (px > MIN) return px + STEP;
    return px;
  }
  var els = [];
  document.querySelectorAll(".req").forEach(function (req) {
    els.push(req);
    req.querySelectorAll("*").forEach(function (el) { els.push(el); });
  });
  // read every size first (children inherit), then write
  var sizes = els.map(function (el) {
    return parseFloat(getComputedStyle(el).fontSize);
  });
  els.forEach(function (el, i) {
    var px = sizes[i];
    if (!px) return; // font-size 0 (icon-only elements) stays 0
    // progress step labels are set to the PDP CTA size (18px) in
    // compact.css; only their number circles follow the rule
    if (el.closest(".progress .step") && !el.closest(".step-circle")) return;
    el.style.fontSize = Math.round(next(px) * 100) / 100 + "px";
  });
})();
