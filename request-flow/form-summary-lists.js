/* Request summary, Color and Quantity: the same list style as the phone
   number country list (form-phone.css).
   Desktop and tablet: script.js keeps opening and choosing; this adds the
   active row, the keyboard, and (only when the list does not fit in one
   view) the search box for colours and the scrollbar.
   Phone: the two summary buttons open the same lists as a full-screen sheet.
   Runs after script.js. */
(function () {
  "use strict";

  var SEARCH_LABEL = "Search color";

  // search and scrollbar only when not every option fits in one view
  function fitPanel(panel, list, isSheet) {
    panel.classList.remove("is-long");
    var long = isSheet
      ? list.scrollHeight > list.clientHeight + 1
      : panel.getBoundingClientRect().height > window.innerHeight - 24;
    panel.classList.toggle("is-long", long);
    return long;
  }

  function setActive(rows, row, scroll) {
    rows().forEach(function (r) {
      r.classList.toggle("is-active", r === row);
    });
    if (row && scroll) row.scrollIntoView({ block: "nearest" });
  }
  function visibleRows(list) {
    return Array.prototype.filter.call(list.querySelectorAll("[role=option]"), function (r) {
      return !r.hidden;
    });
  }
  function searchBox() {
    var wrap = document.createElement("div");
    wrap.className = "fcc-search-wrap";
    wrap.innerHTML =
      '<input class="fcc-search" type="text" autocomplete="off" spellcheck="false" ' +
      'placeholder="' + SEARCH_LABEL + '" aria-label="' + SEARCH_LABEL + '" />';
    return wrap;
  }
  function filter(list, query) {
    var q = query.trim().toLowerCase();
    var count = 0;
    list.querySelectorAll("[role=option]").forEach(function (r) {
      var match = r.dataset.value.toLowerCase().indexOf(q) >= 0;
      r.hidden = !match;
      if (match) count++;
      else r.classList.remove("is-active");
    });
    var none = list.querySelector(".fcc-none");
    if (!none) {
      none = document.createElement("p");
      none.className = "fcc-none";
      none.textContent = "No color found";
      list.appendChild(none);
    }
    none.hidden = count > 0;
    return count;
  }
  // arrows, Enter and hover shared by the desktop panel and the phone sheet
  function wire(list, search) {
    function rows() {
      return visibleRows(list);
    }
    list.addEventListener("mousemove", function (e) {
      var row = e.target.closest("[role=option]");
      if (row) setActive(rows, row, false);
    });
    function onKey(e) {
      if (e.target.closest(".sdd-custom")) return; // typing a quantity
      var typing = search && document.activeElement === search;
      var all = rows();
      var index = all.indexOf(list.querySelector(".is-active"));
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!all.length) return;
        var step = e.key === "ArrowDown" ? 1 : -1;
        var next = all[(index + step + all.length) % all.length];
        setActive(rows, next, true);
        if (!typing) next.focus();
      } else if (e.key === "Enter" && typing) {
        e.preventDefault(); // never sends the form from here
        if (all[index]) all[index].click();
      }
    }
    list.addEventListener("keydown", onKey);
    if (search) {
      search.addEventListener("keydown", onKey);
      search.addEventListener("input", function () {
        filter(list, search.value);
        var first = rows()[0];
        setActive(rows, search.value.trim() ? first : list.querySelector(".is-selected") || first, true);
      });
    }
    return rows;
  }

  // ---------- desktop and tablet ----------
  document.querySelectorAll(".sdd").forEach(function (dd) {
    var btn = dd.querySelector(".s-select");
    var panel = dd.querySelector(".sdd-panel");
    var list = dd.querySelector(".sdd-list");
    var search = null;
    if (dd.dataset.kind === "color") {
      var wrap = searchBox();
      panel.insertBefore(wrap, list);
      search = wrap.querySelector("input");
      search.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
    var rows = wire(list, search);
    btn.addEventListener("click", function () {
      if (!dd.classList.contains("is-open")) return;
      if (search) {
        search.value = "";
        filter(list, "");
      }
      var selected = list.querySelector(".is-selected") || rows()[0];
      var long = fitPanel(panel, list, false);
      setActive(rows, selected, true);
      (search && long ? search : selected).focus({ preventScroll: true });
      panel.scrollIntoView({ block: "nearest" });
    });
    dd.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dd.classList.contains("is-open")) {
        e.preventDefault();
        btn.click();
        btn.focus();
      }
    });
  });

  // ---------- phone: full-screen sheet ----------
  function textNode(btn) {
    return Array.prototype.find.call(btn.childNodes, function (n) {
      return n.nodeType === 3 && n.textContent.trim();
    });
  }
  var sheetId = 0;

  function makeSheet(kind, title) {
    var source = document.querySelector('.sdd[data-kind="' + kind + '"] .sdd-list');
    if (!source) return null;
    var id = "fsum-" + ++sheetId;
    var panel = document.createElement("div");
    panel.className = "fcc-panel is-sheet fsum-sheet";
    panel.hidden = true;
    panel.tabIndex = -1;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", id);
    panel.innerHTML =
      '<div class="fcc-sheet-head"><h2 class="fcc-sheet-title" id="' + id + '">' + title + "</h2>" +
      '<button class="fcc-sheet-x" type="button" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>';
    var search = null;
    if (kind === "color") {
      var wrap = searchBox();
      panel.appendChild(wrap);
      search = wrap.querySelector("input");
    }
    var list = source.cloneNode(true);
    list.classList.add("fcc-list");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", title);
    panel.appendChild(list);
    document.body.appendChild(panel);
    return { panel: panel, list: list, search: search, rows: wire(list, search) };
  }

  document.querySelectorAll(".rsm-field").forEach(function (field) {
    var labelEl = field.querySelector(".rsm-label");
    var title = labelEl ? labelEl.textContent.trim() : "";
    var kind = title === "Color" ? "color" : title === "Quantity" ? "qty" : "";
    if (!kind) return;
    var sheet = makeSheet(kind, title);
    if (!sheet) return;
    var panel = sheet.panel;
    var list = sheet.list;
    var search = sheet.search;
    var rows = sheet.rows;
    var opener = null;
    var custom = list.querySelector(".sdd-custom input");
    var note = list.querySelector(".sdd-moq");

    var printing = new URLSearchParams(location.search).get("printing") || "";
    var moqFor = /4 colou?rs/i.test(printing) ? "4 colours" : /3 colou?rs/i.test(printing) ? "3 colours" : "";
    var moq = moqFor === "4 colours" ? 100 : moqFor === "3 colours" ? 50 : 25;
    function setMoqError(on) {
      if (!custom) return;
      note.classList.toggle("is-error", on);
      custom.closest(".sdd-custom").classList.toggle("is-invalid", on);
      custom.setAttribute("aria-invalid", String(on));
      note.textContent = on
        ? moqFor
          ? moqFor + " printing needs at least " + moq + " pieces — choose a larger quantity"
          : "Please enter at least " + moq + " pieces — the minimum order quantity"
        : "Minimum order quantity is at least " + moq + " pieces" + (moqFor ? " (" + moqFor + " printing)" : "");
    }

    function close() {
      if (panel.hidden) return;
      panel.hidden = true;
      document.body.classList.remove("fcc-lock");
      if (custom && custom.getAttribute("aria-invalid") === "true") {
        custom.value = custom.defaultValue;
        setMoqError(false);
      }
      if (opener) opener.focus();
    }
    function setText(value) {
      var node = textNode(opener);
      if (node) node.textContent = value;
    }
    function open(btn) {
      opener = btn;
      var now = textNode(btn).textContent.trim();
      var selected = null;
      list.querySelectorAll("[role=option]").forEach(function (r) {
        var text = kind === "qty" ? r.dataset.value + " pieces" : r.dataset.value;
        var on = !selected && text === now;
        if (on) selected = r;
        r.classList.toggle("is-selected", on);
        r.setAttribute("aria-selected", String(on));
      });
      if (search) {
        search.value = "";
        filter(list, "");
      }
      panel.style.right = "auto";
      panel.style.width = document.documentElement.clientWidth + "px";
      panel.hidden = false;
      document.body.classList.add("fcc-lock");
      fitPanel(panel, list, true);
      setActive(rows, selected, true);
      panel.focus({ preventScroll: true }); // no keyboard until search is tapped
    }

    field.addEventListener("click", function (e) {
      var btn = e.target.closest(".rsm-select");
      if (btn) open(btn);
    });
    field.querySelectorAll(".rsm-select").forEach(function (btn) {
      btn.setAttribute("aria-haspopup", "dialog");
    });
    list.querySelectorAll("[role=option]").forEach(function (row) {
      row.addEventListener("click", function () {
        setText(kind === "qty" ? row.dataset.value + " pieces" : row.dataset.value);
        var swatch = opener.querySelector(".rsm-sw");
        if (swatch && row.dataset.img) swatch.src = row.dataset.img;
        close();
      });
    });
    panel.querySelector(".fcc-sheet-x").addEventListener("click", close);
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    if (custom) {
      custom.min = String(moq);
      setMoqError(false);
      custom.addEventListener("input", function () {
        var n = parseInt(custom.value, 10) || 0;
        if (n === 0 || n >= moq) setMoqError(false);
      });
      // Enter or leaving the box saves; under the minimum nothing is saved
      var save = function () {
        var n = parseInt(custom.value, 10);
        if (n > 0 && n < moq) return setMoqError(true);
        if (n > 0 && !panel.hidden) {
          setText(n + " pieces");
          close();
        }
      };
      custom.addEventListener("change", save);
      custom.addEventListener("blur", save);
    }
  });
})();
