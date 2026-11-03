/* PDP header behaviour on the request form and thank-you page.
   Copied from ../script.js (compactHeader, searchSuggest, phone
   breadcrumbs, fitSearchText) so the header acts like on the product page.
   Keep in sync with ../script.js. */
(function () {
  var hd = document.getElementById("hd");
  if (!hd) return;
  var phone = matchMedia("(width < 768px)");

  /* ---------- breadcrumb: current page follows the screen ---------- */
  var CRUMB = {
    design: "Free design request",
    quote: "Free quote request",
    thanks: "Request sent",
  };
  function setCrumb() {
    var key = location.hash.replace("#", "");
    var el = document.getElementById("crumb-current");
    if (el && CRUMB[key]) el.textContent = CRUMB[key];
  }
  window.addEventListener("hashchange", setCrumb);
  setCrumb();

  document
    .querySelector(".crumbs-more button")
    ?.addEventListener("click", function (e) {
      var trail = e.currentTarget.closest(".crumbs");
      trail.classList.add("is-expanded");
      e.currentTarget.setAttribute("aria-expanded", "true");
      trail.querySelector(".crumb-mid a")?.focus();
    });

  /* ---------- compact header on scroll (fixed header + spacer) ---------- */
  var spacer = document.createElement("div");
  spacer.className = "hd-spacer";
  spacer.setAttribute("aria-hidden", "true");
  hd.after(spacer);
  function sizeSpacer() {
    if (hd.classList.contains("is-compact") || hd.classList.contains("hd-anim"))
      return;
    spacer.style.height = hd.getBoundingClientRect().height + "px";
  }
  new ResizeObserver(sizeSpacer).observe(hd);
  window.addEventListener("resize", sizeSpacer);
  sizeSpacer();

  var root = document.documentElement;
  function measure() {
    if (hd.classList.contains("is-compact")) return;
    var usp = hd.querySelector(".usp");
    var cat = hd.querySelector(".cat");
    root.style.setProperty("--usp-h", (usp ? usp.scrollHeight : 0) + "px");
    root.style.setProperty("--cat-h", (cat ? cat.scrollHeight : 0) + "px");
  }
  measure();
  window.addEventListener("resize", measure);
  if (document.fonts) document.fonts.ready.then(measure);

  var lastY = window.scrollY;
  var animTimer;
  function set(on) {
    if (hd.classList.contains("is-compact") === on) return;
    if (on) measure();
    hd.classList.add("hd-anim");
    clearTimeout(animTimer);
    animTimer = setTimeout(function () {
      hd.classList.remove("hd-anim");
      sizeSpacer();
    }, 400);
    hd.classList.toggle("is-compact", on);
  }
  window.addEventListener(
    "scroll",
    function () {
      var y = Math.max(0, window.scrollY);
      var dy = y - lastY;
      lastY = y;
      var drawer = document.getElementById("drawer");
      if ((drawer && drawer.classList.contains("open")) || y <= 0) set(false);
      else if (dy > 0) set(true);
      else if (dy < -4 && !phone.matches) set(false);
    },
    { passive: true },
  );
  // screen switches scroll to the top: show the full header again
  window.addEventListener("hashchange", function () {
    requestAnimationFrame(function () {
      if (window.scrollY <= 0) set(false);
    });
  });
  if (window.scrollY > 0) set(true);

  /* ---------- header search suggestions (menu A–Z) ---------- */
  (function searchSuggest() {
    var input = document.getElementById("q");
    var list = (window.LP_MENU && window.LP_MENU.az) || [];
    if (!input || !list.length) return;
    var form = input.closest("form");
    var box = document.createElement("ul");
    box.className = "search-suggest";
    box.id = "search-suggest";
    box.setAttribute("role", "listbox");
    box.hidden = true;
    form.append(box);
    input.setAttribute("aria-controls", "search-suggest");
    input.setAttribute("aria-autocomplete", "list");
    var active = -1;
    function render() {
      var q = input.value.trim().toLowerCase();
      active = -1;
      if (!q) return (box.hidden = true);
      var hits = list
        .filter(function (x) {
          return x.href && x.label.toLowerCase().includes(q);
        })
        .slice(0, 8);
      box.innerHTML = hits.length
        ? hits
            .map(function (x) {
              return '<li role="option"><a href="' + x.href + '">' + x.label + "</a></li>";
            })
            .join("")
        : '<li class="search-empty">No product types match “' +
          input.value.trim().replace(/[<>&]/g, "") +
          "”</li>";
      box.hidden = false;
    }
    function move(d) {
      var items = [].slice.call(box.querySelectorAll("a"));
      if (!items.length) return;
      active = (active + d + items.length) % items.length;
      items.forEach(function (a, i) {
        a.parentElement.classList.toggle("active", i === active);
      });
      items[active].parentElement.scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("input", render);
    input.addEventListener("focus", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Escape") box.hidden = true;
    });
    form.addEventListener("submit", function () {
      var items = box.querySelectorAll("a");
      var target = items[Math.max(active, 0)];
      if (target) window.location.href = target.href;
    });
    document.addEventListener("click", function (e) {
      if (!form.contains(e.target)) box.hidden = true;
    });
  })();

  /* ---------- header search: placeholder never cropped ---------- */
  (function fitSearchText() {
    var input = document.getElementById("q");
    if (!input) return;
    var desktopNav = matchMedia("(min-width: 992px)");
    var canvas = document.createElement("canvas").getContext("2d");
    var BASE = 18, STEP = 2, MIN = 10;
    function fit() {
      input.style.fontSize = "";
      if (!desktopNav.matches) return;
      var cs = getComputedStyle(input);
      var room =
        input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var size = BASE;
      function width(px) {
        canvas.font = cs.fontWeight + " " + px + "px " + cs.fontFamily;
        return canvas.measureText(input.placeholder).width;
      }
      while (size > MIN && width(size) > room) size -= STEP;
      if (size !== BASE) input.style.fontSize = size + "px";
    }
    window.addEventListener("resize", fit);
    desktopNav.addEventListener("change", function () { requestAnimationFrame(fit); });
    if (document.fonts) document.fonts.ready.then(fit);
    fit();
  })();
})();
