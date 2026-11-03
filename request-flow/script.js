(function () {
  // --- Fill shared parts -------------------------------------------
  function fill(slot, tplId) {
    document
      .querySelectorAll('[data-slot="' + slot + '"]')
      .forEach(function (el) {
        el.appendChild(
          document.getElementById(tplId).content.cloneNode(true),
        );
      });
  }
  fill("progress", "tpl-progress");
  fill("summary", "tpl-summary");
  fill("logo", "tpl-logo");

  // The two request frames export slightly different upload icons
  document.querySelector("#screen-design [data-upload-icon]").src =
    "assets/icon-upload-design.svg";
  document.querySelector("#screen-quote [data-upload-icon]").src =
    "assets/icon-upload-quote.svg";

  var track = document.getElementById("compare-track");
  for (var i = 0; i < 5; i++)
    track.appendChild(
      document.getElementById("tpl-card").content.cloneNode(true),
    );
  var fade = document.createElement("span");
  fade.className = "compare-fade";
  track.appendChild(fade);

  // --- Configuration handed over by the PDP (../index.html) ---------
  // The PDP's Free design / Free quote buttons open this page with the
  // chosen options in the query string, e.g.
  // ?color=Black&position=Front%20(30×70%20mm)&printing=1%20colour&qty=250&img=assets/product/black.jpg#quote
  (function applyPdpConfig() {
    var p = new URLSearchParams(location.search);
    if (![...p.keys()].length) return;
    var txt = function (sel, val) {
      if (!val) return;
      document.querySelectorAll(sel).forEach(function (el) {
        // keep trailing spacer/caret children, replace the text only
        var t = [...el.childNodes].find(function (n) {
          return n.nodeType === 3 && n.textContent.trim();
        });
        if (t) t.textContent = val;
        else el.prepend(val);
      });
    };
    var color = p.get("color"), qty = p.get("qty"), img = p.get("img");
    var qtyLabel = qty && qty + " pieces";
    var product = "Thermos bottle | Stainless steel | 500 ml";
    txt(".summary-block .s-value", product + (color ? " | " + color : ""));
    txt('.sdd[data-kind="color"] .sdd-current', color);
    txt('.sdd[data-kind="qty"] .sdd-current', qtyLabel);
    document.querySelectorAll(".s-static").forEach(function (box) {
      var label = box.querySelector(".s-label").textContent.trim();
      var val =
        label === "Print position" ? (p.get("position") || "Not chosen yet")
        : label === "Printing in" ? (p.get("printing") || "Not chosen yet") : "";
      if (val) box.querySelector("p:not(.s-label)").textContent = val;
    });
    document.querySelectorAll(".rsm-field").forEach(function (f) {
      var label = f.querySelector(".rsm-label").textContent.trim();
      var val = { "Color": color, "Quantity": qtyLabel,
        "Print position": p.get("position") || "Not chosen yet",
        "Printing in": p.get("printing") || "Not chosen yet" }[label];
      if (!val) return;
      var target = f.querySelector(".rsm-select, .rsm-value");
      var t = [...target.childNodes].find(function (n) {
        return n.nodeType === 3 && n.textContent.trim();
      });
      if (t) t.textContent = val;
    });
    if (img) {
      var src = "../" + img.replace(/^\.?\//, "");
      document
        .querySelectorAll(
          ".summary-img img, .s-select-val .s-swatch img, .rsm-row > img",
        )
        .forEach(function (el) { el.src = src; });
    }

    // Several colours and / or print positions (Figma 1899:11158, the
    // multi-colour variant of Request summary 497:10999). The PDP sends
    // cfg = {colors: [{name, slug, qty}], positions: [{name, printing}]}.
    var cfg = {};
    try { cfg = JSON.parse(p.get("cfg") || "{}"); } catch (e) { cfg = {}; }
    var colors = cfg.colors || [];
    var positions = cfg.positions || [];
    var esc = function (s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    };
    var photo = function (slug) { return "../assets/product/" + slug + ".jpg"; };
    var printingLine = function (pos) {
      return pos.printing
        ? '<span class="s-reg">' + esc(pos.name) + ":</span> " + esc(pos.printing)
        : esc(pos.name);
    };
    var lines = function (html) {
      return '<div class="s-lines">' + html.map(function (h) {
        return "<p>" + h + "</p>";
      }).join("") + "</div>";
    };
    document.querySelectorAll(".summary-panel").forEach(function (panel) {
      var specs = panel.querySelector(".summary-specs");
      if (colors.length > 1) {
        // one colour select per colour, stacked under one COLOR label
        var first = panel.querySelector('.sdd[data-kind="color"]');
        first.classList.add("is-multi");
        var setColour = function (field, c) {
          field.querySelector(".sdd-current").textContent = c.name;
          field.querySelector(".s-select-val .s-swatch img").src = photo(c.slug);
        };
        setColour(first, colors[0]);
        var after = first;
        colors.slice(1).forEach(function (c) {
          var extra = first.cloneNode(true);
          extra.classList.remove("is-multi");
          extra.classList.add("is-extra");
          setColour(extra, c);
          after.after(extra);
          after = extra;
        });
        // COLOR DIVISION: pieces per colour
        var division = document.createElement("div");
        division.className = "s-static is-list";
        division.innerHTML =
          '<p class="s-label">Color division</p>' +
          lines(colors.map(function (c) {
            return '<span class="s-reg">' + esc(c.name) + ":</span> " + (Number(c.qty) || 0);
          }));
        // after the colour + quantity selects, before PRINT POSITION
        var firstStatic = panel.querySelector(".s-static");
        firstStatic.before(division);
      }
      if (positions.length > 1 || colors.length > 1) {
        panel.querySelectorAll(".s-static:not(.is-list)").forEach(function (box) {
          var label = box.querySelector(".s-label").textContent.trim();
          if (!positions.length) return;
          box.classList.add("is-list");
          var value = box.querySelector("p:not(.s-label)");
          var html =
            label === "Print position"
              ? lines(positions.map(function (pos) { return esc(pos.name); }))
              : positions.length > 1
                ? lines(positions.map(printingLine))
                : lines([esc(positions[0].printing || "Not chosen yet")]);
          value.outerHTML = html;
        });
      }
    });
    // phones + thank-you page: the same choices as one line per field
    if (colors.length > 1) color = colors.map(function (c) { return c.name; }).join(", ");
    var posText = positions.length > 1 && positions.map(function (x) { return x.name; }).join(", ");
    var printText = positions.length > 1 && positions.map(function (x) {
      return x.printing ? x.name + ": " + x.printing : x.name;
    }).join(", ");
    if (colors.length > 1 || positions.length > 1) {
      // phone request summary (.rsm): same layout as the desktop variant —
      // one select per colour (with its photo), COLOR DIVISION, then the
      // positions and colours per position as lines
      var setText = function (el, val) {
        var t = [...el.childNodes].find(function (n) {
          return n.nodeType === 3 && n.textContent.trim();
        });
        if (t) t.textContent = val;
      };
      document.querySelectorAll(".rsm-details").forEach(function (box) {
        var field = function (name) {
          return [...box.querySelectorAll(".rsm-field")].find(function (f) {
            return f.querySelector(".rsm-label").textContent.trim() === name;
          });
        };
        if (colors.length > 1) {
          var cf = field("Color");
          var sel = cf.querySelector(".rsm-select");
          cf.classList.add("is-multi");
          colors.forEach(function (c, i) {
            var s = i ? sel.cloneNode(true) : sel;
            setText(s, c.name);
            var sw = s.querySelector(".rsm-sw") || document.createElement("img");
            sw.className = "rsm-sw";
            sw.alt = "";
            sw.src = photo(c.slug);
            if (!sw.parentNode) s.prepend(sw);
            if (i) cf.append(s);
          });
          var div = document.createElement("div");
          div.className = "rsm-field is-list";
          div.innerHTML =
            '<p class="rsm-label">Color division</p>' +
            lines(colors.map(function (c) {
              return '<span class="s-reg">' + esc(c.name) + ":</span> " + (Number(c.qty) || 0);
            }));
          field("Quantity").after(div);
        }
        if (positions.length) {
          var pf = field("Print position"), rf = field("Printing in");
          pf.classList.add("is-list");
          rf.classList.add("is-list");
          pf.querySelector(".rsm-value").outerHTML =
            lines(positions.map(function (pos) { return esc(pos.name); }));
          rf.querySelector(".rsm-value").outerHTML = positions.length > 1
            ? lines(positions.map(printingLine))
            : lines([esc(positions[0].printing || "Not chosen yet")]);
        }
      });
      txt(".summary-block .s-value", product + " | " + color);
      if (posText) p.set("position", posText);
      if (printText) p.set("printing", printText);
    }

    // Thank-you page "Your request": first product = the PDP configuration
    document
      .querySelectorAll(".ty-plist > .ty-product:first-child, .yrq-list > .yrq-product:first-child")
      .forEach(function (card) {
        card.querySelector(".ty-product-name, .yrq-name").textContent =
          product + (color ? " | " + color : "");
        if (img) card.querySelector(".ty-product-card > img, .yrq-card > img").src =
          "../" + img.replace(/^\.?\//, "");
        card.querySelectorAll(".ty-pd > div").forEach(function (row) {
          var val = { "Color": color, "Quantity": qtyLabel,
            "Print position": p.get("position") || "Not chosen yet",
            "Printing in": p.get("printing") || "Not chosen yet",
            "Productnumber": "6383162" }[row.querySelector("dt").textContent.trim()];
          if (val) row.querySelector("dd").textContent = val;
        });
      });
  })();

  // --- Routing -----------------------------------------------------
  var ROUTES = {
    pdp: { screen: "pdp", title: "Thermos bottle | Loopper" },
    design: { screen: "design", title: "Get your free Design | Loopper" },
    quote: { screen: "quote", title: "Get your free Quote | Loopper" },
    thanks: { screen: "thanks", title: "Request sent | Loopper" },
  };

  function route() {
    var key = location.hash.replace("#", "") || "pdp";
    // This copy lives inside the PDP prototype repo: every "product page"
    // link goes back to the real PDP instead of the old #pdp mock screen.
    if (key === "pdp" || !ROUTES[key]) {
      location.href = "../";
      return;
    }
    var r = ROUTES[key] || ROUTES.pdp;
    document.body.dataset.screen = r.screen;
    document.title = r.title;
    document.querySelectorAll(".proto nav a").forEach(function (a) {
      if (a.getAttribute("href") === "#" + (ROUTES[key] ? key : "pdp"))
        a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();

  // --- PDP configurator --------------------------------------------
  document.querySelectorAll(".cfg-open").forEach(function (card) {
    card
      .querySelector(".cfg-head")
      .addEventListener("click", function () {
        var collapsed = card.classList.toggle("is-collapsed");
        this.setAttribute("aria-expanded", String(!collapsed));
      });
  });

  // --- Request forms ------------------------------------------------
  document.querySelectorAll("[data-deadline]").forEach(function (input) {
    var name = input.dataset.deadline;
    function pickDeadline() {
      document.querySelector(
        'input[name="' + name + '"][value="deadline"]',
      ).checked = true;
    }
    input.addEventListener("focus", pickDeadline);
    // Auto-insert dashes: 120926 -> 12-09-26
    input.addEventListener("input", function () {
      var d = input.value.replace(/\D/g, "").slice(0, 6);
      input.value = d.replace(
        /^(\d{2})(\d{1,2})?(\d{1,2})?$/,
        function (_, a, b, c) {
          return a + (b ? "-" + b : "") + (c ? "-" + c : "");
        },
      );
    });
    document
      .querySelectorAll('input[name="' + name + '"][value="deadline"]')
      .forEach(function (radio) {
        radio.addEventListener("change", function () {
          input.focus();
        });
      });
  });

  document
    .querySelectorAll(".logo-upload input[type=file]")
    .forEach(function (fileInput) {
      fileInput.addEventListener("change", function () {
        var later = fileInput
          .closest(".logo-up")
          .querySelector(".logo-later");
        if (fileInput.files.length)
          later.textContent = "✓ " + fileInput.files[0].name;
      });
    });

  document
    .querySelectorAll(".form-card, .mrq-form")
    .forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = function (n) {
          var el = form.querySelector('[name="' + n + '"]');
          return el ? el.value.trim() : "";
        };
        var sal = form.querySelector('input[name^="sal-"]:checked');
        var name = [v("first"), v("last")].filter(Boolean).join(" ");
        var set = function (key, val) {
          if (val)
            document
              .querySelectorAll('[data-ty="' + key + '"]')
              .forEach(function (el) {
                el.textContent = val;
              });
        };
        set("email", v("email"));
        set("company", v("company"));
        set("name", name && (sal ? sal.value + " " : "") + name);
        set("phone", v("phone"));
        location.hash = "thanks";
      });
    });

  // --- Mobile ------------------------------------------------------
  var mTrack = document.getElementById("m-compare-track");
  for (var j = 0; j < 3; j++)
    mTrack.appendChild(
      document.getElementById("tpl-mcard").content.cloneNode(true),
    );

  // Collapsible cards: mobile request summary + "Your request"
  document.querySelectorAll("[data-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.parentElement;
      var open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      card.classList.toggle("is-open", open);
      card.classList.toggle("is-closed", !open);
    });
  });
  // Request Summary Mobile: collapsed (864:7297) <-> expanded (864:7387)
  var rsm = document.querySelector(".rsm");
  var rsmToggle = rsm.querySelector(".rsm-toggle");
  var rsmExtra = rsm.querySelector(".rsm-extra");
  function setRsm(open) {
    rsm.classList.toggle("is-open", open);
    rsmToggle.setAttribute("aria-expanded", String(open));
    rsmExtra.inert = !open;
  }
  setRsm(false);
  rsmToggle.addEventListener("click", function () {
    setRsm(!rsm.classList.contains("is-open"));
  });
  // "Add extra product" shows the two-product variant (933:20875)
  document.querySelector(".madd").addEventListener("click", function (e) {
    e.preventDefault();
    rsm.classList.add("has-two");
    rsm.querySelector(".rsm-second").removeAttribute("aria-hidden");
  });

  // Review carousels: move the active dot while swiping
  document.querySelectorAll(".mrev").forEach(function (sec) {
    var track = sec.querySelector(".mrev-track");
    var dots = sec.querySelectorAll(".mrev-dots i");
    track.addEventListener("scroll", function () {
      var max = track.scrollWidth - track.clientWidth;
      var i =
        max > 0
          ? Math.round((track.scrollLeft / max) * (dots.length - 1))
          : 0;
      dots.forEach(function (d, k) {
        d.classList.toggle("is-active", k === i);
      });
    });
  });

  // --- Deadline section (mobile): ASAP / deadline / date picker ------
  (function () {
    var dl = document.querySelector(".dl");
    var dateWrap = dl.querySelector(".dl-datewrap");
    var pickWrap = dl.querySelector(".dl-pickerwrap");
    var dateBtn = dl.querySelector(".dl-date");
    var dateText = dl.querySelector(".dl-date-text");
    var monthName = dl.querySelector(".dl-month-name");
    var grid = dl.querySelector(".dl-grid");
    var prev = dl.querySelector(".dl-prev");
    var MONTHS = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    var picked = null;
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };

    // Clip while a wrapper animates, unclip once it is fully open
    [dateWrap, pickWrap].forEach(function (w) {
      w.addEventListener("transitionend", function (e) {
        if (e.target === w && e.propertyName === "opacity")
          w.classList.toggle(
            "is-settled",
            getComputedStyle(w).opacity === "1",
          );
      });
    });
    function setState(deadline, picking) {
      if (!deadline) picking = false;
      if (!picking) pickWrap.classList.remove("is-settled");
      if (!deadline) dateWrap.classList.remove("is-settled");
      dl.classList.toggle("is-deadline", deadline);
      dl.classList.toggle("is-picking", picking);
      dateBtn.setAttribute("aria-expanded", String(picking));
      dateWrap.inert = !deadline;
      pickWrap.inert = !picking;
    }

    function render() {
      monthName.textContent =
        MONTHS[view.getMonth()] + " " + view.getFullYear();
      prev.disabled =
        view <= new Date(today.getFullYear(), today.getMonth(), 1);
      var first = view.getDay();
      var days = new Date(
        view.getFullYear(),
        view.getMonth() + 1,
        0,
      ).getDate();
      var cells = [];
      for (var i = 0; i < first; i++) cells.push(null);
      for (var d = 1; d <= days; d++) cells.push(d);
      while (cells.length % 7) cells.push(null);
      grid.innerHTML = "";
      for (var w = 0; w < cells.length; w += 7) {
        var row = document.createElement("div");
        row.className = "dl-week";
        cells.slice(w, w + 7).forEach(function (day) {
          var cell = document.createElement(day ? "button" : "span");
          cell.className = "dl-day";
          if (day) {
            var date = new Date(view.getFullYear(), view.getMonth(), day);
            cell.type = "button";
            cell.dataset.day = day;
            cell.setAttribute("aria-label", date.toDateString());
            cell.innerHTML = "<span>" + day + "</span>";
            if (date < today) cell.disabled = true;
            if (+date === +today) cell.classList.add("is-today");
            if (picked && +date === +picked) {
              cell.classList.add("is-picked");
              cell.insertAdjacentHTML(
                "afterbegin",
                '<img src="assets/m-day-selected.svg" width="38.7676" height="38.7676" alt="" />',
              );
            }
          }
          row.appendChild(cell);
        });
        grid.appendChild(row);
      }
    }

    dl.querySelectorAll('input[name="when-m"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        setState(radio.value === "deadline", false);
      });
    });
    dateBtn.addEventListener("click", function () {
      setState(true, !dl.classList.contains("is-picking"));
    });
    prev.addEventListener("click", function () {
      view.setMonth(view.getMonth() - 1);
      render();
    });
    dl.querySelector(".dl-next").addEventListener("click", function () {
      view.setMonth(view.getMonth() + 1);
      render();
    });
    grid.addEventListener("click", function (e) {
      var cell = e.target.closest(".dl-day[data-day]");
      if (!cell || cell.disabled) return;
      picked = new Date(
        view.getFullYear(),
        view.getMonth(),
        +cell.dataset.day,
      );
      dateText.textContent =
        pad(picked.getDate()) +
        "-" +
        pad(picked.getMonth() + 1) +
        "-" +
        String(picked.getFullYear()).slice(2);
      dateText.classList.add("has-value");
      render();
      setTimeout(function () {
        setState(true, false);
      }, 200);
    });

    render();
    // start from whichever option is checked (browsers restore it on reload)
    var checked = dl.querySelector('input[name="when-m"]:checked');
    setState(!!checked && checked.value === "deadline", false);
  })();

  // Account CTA mobile: show the "pressing" variant while the finger is down
  // (iOS Safari doesn't apply :active on a tap without a touch listener)
  document.querySelectorAll(".acta").forEach(function (btn) {
    var on = function () {
      btn.classList.add("is-pressing");
    };
    var off = function () {
      btn.classList.remove("is-pressing");
    };
    btn.addEventListener("pointerdown", on);
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      btn.addEventListener(ev, off);
    });
  });

  // Survey dropdowns (mobile confirmation): open/close, pick, show the choice
  document.querySelectorAll(".mdd").forEach(function (dd) {
    var head = dd.querySelector(".mdd-head");
    var value = dd.querySelector(".mdd-value");
    var panel = dd.querySelector(".mdd-collapse");
    function setOpen(open) {
      dd.classList.toggle("is-open", open);
      head.setAttribute("aria-expanded", String(open));
      panel.inert = !open;
    }
    setOpen(false);
    head.addEventListener("click", function () {
      var open = !dd.classList.contains("is-open");
      document.querySelectorAll(".mdd.is-open").forEach(function (other) {
        if (other !== dd) other.querySelector(".mdd-head").click();
      });
      setOpen(open);
    });
    dd.querySelectorAll(".mdd-item").forEach(function (item) {
      item.addEventListener("click", function () {
        dd.querySelectorAll(".mdd-item").forEach(function (i) {
          i.setAttribute("aria-selected", String(i === item));
        });
        value.textContent = item.textContent.trim();
        value.classList.add("has-value");
        setOpen(false);
      });
    });
    dd.querySelectorAll(".mdd-check input").forEach(function (box) {
      box.addEventListener("change", function () {
        var picked = Array.from(
          dd.querySelectorAll(".mdd-check input:checked"),
        ).map(function (b) {
          return b.closest("label").textContent.trim();
        });
        value.textContent = picked.length ? picked.join(", ") : "Select";
        value.classList.toggle("has-value", picked.length > 0);
      });
    });
  });

  // "Your request" card (mobile confirmation): closed <-> open
  (function () {
    var card = document.querySelector(".mty-req");
    // toggle sits under the content: "Show product details" opens the
    // product details above it, "Hide product details" closes them again
    var btn = card.querySelector(".yrq-toggle");
    var label = btn.querySelector(".yrq-toggle-label");
    var more = card.querySelector(".yrq-collapse");
    function setOpen(open) {
      card.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      label.textContent = open ? "Hide product details" : "Show product details";
      more.inert = !open;
    }
    setOpen(false);
    btn.addEventListener("click", function () {
      setOpen(!card.classList.contains("is-open"));
    });
  })();

  // Alternatives checklist: default -> active ("Input saved") -> deactivated ("removed")
  document
    .querySelectorAll(".mty-checks label, .ty-checks label")
    .forEach(function (row) {
      row.querySelector("input").addEventListener("change", function (e) {
        row.dataset.state = e.target.checked ? "active" : "deactivated";
      });
    });

  document.addEventListener("click", function (e) {
    document.querySelectorAll(".mdd.is-open").forEach(function (dd) {
      if (!dd.contains(e.target)) dd.querySelector(".mdd-head").click();
    });
  });

  // Desktop summary dropdowns: colour + quantity
  document.querySelectorAll(".sdd").forEach(function (dd) {
    var btn = dd.querySelector(".s-select");
    var summary = dd.closest(".summary");
    var current = dd.querySelector(".sdd-current");
    function setOpen(open) {
      dd.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      summary.classList.toggle(
        "has-open",
        !!summary.querySelector(".sdd.is-open"),
      );
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !dd.classList.contains("is-open");
      document.querySelectorAll(".sdd.is-open").forEach(function (o) {
        if (o !== dd) o.querySelector(".s-select").click();
      });
      setOpen(open);
    });
    dd.querySelector(".sdd-chev").addEventListener("click", function () {
      setOpen(false);
    });
    dd.querySelectorAll("[role=option]").forEach(function (opt) {
      opt.addEventListener("click", function () {
        dd.querySelectorAll("[role=option]").forEach(function (o) {
          var on = o === opt;
          o.classList.toggle("is-selected", on);
          o.setAttribute("aria-selected", String(on));
        });
        if (dd.dataset.kind === "color") {
          current.textContent = opt.dataset.value;
          dd.querySelector(".s-swatch img").src = opt.dataset.img;
        } else {
          current.textContent = opt.dataset.value + " pieces";
        }
        setOpen(false);
      });
    });
    var custom = dd.querySelector(".sdd-custom input");
    if (custom)
      custom.addEventListener("change", function () {
        var n = parseInt(custom.value, 10);
        if (n > 0) {
          dd.querySelectorAll("[role=option]").forEach(function (o) {
            o.classList.remove("is-selected");
            o.setAttribute("aria-selected", "false");
          });
          current.textContent = n + " pieces";
          setOpen(false);
        }
      });
  });
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".sdd.is-open").forEach(function (dd) {
      if (!dd.contains(e.target)) dd.querySelector(".s-select").click();
    });
  });

  // Send Request hover: slide the arrow to where Figma's hover state puts it
  document.querySelectorAll(".form-card .send-btn").forEach(function (b) {
    b.addEventListener("mouseenter", function () {
      var icon = b.querySelector("img");
      var r = b.getBoundingClientRect();
      var ir = icon.getBoundingClientRect();
      var target = r.left + r.width * (575 / 639); // icon centre in the 639px Figma button
      b.style.setProperty(
        "--send-shift",
        target - (ir.left + ir.width / 2) + "px",
      );
    });
  });

  // "Add text logo" modal: opens from "Add tekst" / "Add text"
  (function () {
    var modal = document.getElementById("text-logo-modal");
    var text = modal.querySelector("#tlm-text");
    var own = modal.querySelector("#tlm-pms-own");
    var prev = modal.querySelector(".tlm-preview-txt");
    var prevBox = modal.querySelector(".tlm-preview");
    var fontDd = modal.querySelector('.tlm-dd[data-kind="font"]');
    var pmsDd = modal.querySelector('.tlm-dd[data-kind="pms"]');
    var state = { family: "", font: "", color: "", pms: "" };
    var opener = null;
    var closeTimer = null;
    var saved = {};

    function setDd(dd, open) {
      dd.classList.toggle("is-open", open);
      dd.querySelector(".tlm-dd-head").setAttribute(
        "aria-expanded",
        String(open),
      );
      dd.querySelector(".tlm-dd-collapse").inert = !open;
    }
    function closeDds(except) {
      modal.querySelectorAll(".tlm-dd.is-open").forEach(function (dd) {
        if (dd !== except) setDd(dd, false);
      });
    }
    function render() {
      var t = text.value.trim();
      prev.classList.toggle("is-empty", !t);
      prev.textContent = t || "Your text preview will appear here";
      prev.style.fontFamily = t ? state.family : "";
      prev.style.color = t ? state.color : "";
      prevBox.classList.toggle(
        "is-light",
        !!t && /^(#fff(fff)?|white)$/i.test(state.color),
      );
    }
    function cssColor(v) {
      var probe = new Option().style;
      probe.color = v;
      return probe.color ? v : "";
    }

    modal.querySelectorAll(".tlm-dd").forEach(function (dd) {
      setDd(dd, false);
      dd.querySelector(".tlm-dd-head").addEventListener(
        "click",
        function () {
          var open = !dd.classList.contains("is-open");
          closeDds(dd);
          setDd(dd, open);
        },
      );
    });

    fontDd.querySelectorAll(".tlm-font").forEach(function (opt) {
      opt.addEventListener("click", function () {
        fontDd.querySelectorAll(".tlm-font").forEach(function (o) {
          var on = o === opt;
          o.classList.toggle("is-active", on);
          o.setAttribute("aria-selected", String(on));
        });
        state.font = opt.dataset.value;
        state.family = opt.dataset.family || "";
        var val = fontDd.querySelector(".tlm-dd-val");
        val.textContent = state.font || "Select Font";
        val.style.fontFamily = state.family;
        fontDd.classList.toggle("has-value", !!state.font);
        if (state.font) fontDd.classList.remove("is-invalid");
        setDd(fontDd, false);
        render();
      });
    });

    function pickPms(opt) {
      pmsDd.querySelectorAll(".tlm-sw").forEach(function (o) {
        var on = o === opt;
        o.classList.toggle("is-selected", on);
        o.setAttribute("aria-selected", String(on));
      });
      pmsDd.classList.toggle("has-value", !!opt);
      pmsDd.querySelector(".tlm-dd-txt").textContent = opt
        ? opt.dataset.value
        : "Select your PMS/Color";
      pmsDd.querySelector(".tlm-dd-dot").style.background = opt
        ? opt.dataset.color
        : "";
    }
    pmsDd.querySelectorAll(".tlm-sw").forEach(function (opt) {
      opt.addEventListener("click", function () {
        pickPms(opt);
        state.pms = opt.dataset.value;
        state.color = opt.dataset.color;
        own.value = "";
        setDd(pmsDd, false);
        render();
      });
    });
    own.addEventListener("input", function () {
      var v = own.value.trim();
      if (v) pickPms(null);
      state.pms = v;
      state.color = cssColor(v);
      render();
    });

    text.addEventListener("input", function () {
      if (text.value.trim()) text.classList.remove("is-invalid");
      render();
    });

    function open(btn) {
      opener = btn;
      clearTimeout(closeTimer);
      var data = saved[btn.dataset.tlmFor] || {};
      text.value = data.text || "";
      modal.querySelector("#tlm-remarks").value = data.remarks || "";
      own.value = data.own || "";
      var fontOpt = fontDd.querySelector(
        '.tlm-font[data-value="' + (data.font || "") + '"]',
      );
      fontOpt.click();
      var sw =
        data.pmsSwatch &&
        pmsDd.querySelector(
          '.tlm-sw[data-value="' + data.pmsSwatch + '"]',
        );
      if (sw) sw.click();
      else {
        pickPms(null);
        state.pms = data.own || "";
        state.color = cssColor(state.pms);
      }
      text.classList.remove("is-invalid");
      fontDd.classList.remove("is-invalid");
      closeDds();
      render();
      modal.hidden = false;
      document.body.classList.add("tlm-lock");
      modal.offsetWidth; // start the enter transition from the hidden state
      modal.classList.add("is-open");
      text.focus({ preventScroll: true });
    }
    function close() {
      if (modal.hidden) return;
      closeDds();
      modal.classList.remove("is-open");
      document.body.classList.remove("tlm-lock");
      var ms =
        parseFloat(
          getComputedStyle(modal).getPropertyValue("--tlm-dur"),
        ) || 0;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) ms = 0;
      closeTimer = setTimeout(function () {
        modal.hidden = true;
      }, ms);
      if (opener) opener.focus({ preventScroll: true });
    }

    document
      .querySelectorAll(".logo-text, .mlogo-text")
      .forEach(function (btn, i) {
        btn.dataset.tlmFor = "t" + i;
        btn.setAttribute("aria-haspopup", "dialog");
        btn.addEventListener("click", function () {
          open(btn);
        });
      });
    modal.querySelectorAll("[data-tlm-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    modal.addEventListener("click", function (e) {
      if (!e.target.closest(".tlm-dd")) closeDds();
    });
    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") {
        if (modal.querySelector(".tlm-dd.is-open")) closeDds();
        else close();
      } else if (e.key === "Tab") {
        // keep focus inside the dialog
        var f = Array.prototype.filter.call(
          modal.querySelectorAll("button, textarea, input"),
          function (el) {
            return !el.closest("[inert]") && el.offsetParent !== null;
          },
        );
        var first = f[0],
          last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    modal
      .querySelector(".tlm-save")
      .addEventListener("click", function () {
        var t = text.value.trim();
        text.classList.toggle("is-invalid", !t);
        fontDd.classList.toggle("is-invalid", !state.font);
        if (!t) return text.focus();
        if (!state.font)
          return fontDd.querySelector(".tlm-dd-head").click();
        var sel = pmsDd.querySelector(".tlm-sw.is-selected");
        saved[opener.dataset.tlmFor] = {
          text: t,
          font: state.font,
          pmsSwatch: sel ? sel.dataset.value : "",
          own: own.value.trim(),
          remarks: modal.querySelector("#tlm-remarks").value,
        };
        var later = opener
          .closest(".logo-up, .mbox")
          .querySelector(".logo-later, .mlogo-later");
        later.textContent =
          "✓ Text logo: \u201c" +
          t +
          "\u201d (" +
          state.font +
          (state.pms ? ", " + state.pms : "") +
          ")";
        opener.textContent = opener.classList.contains("mlogo-text")
          ? "Edit text"
          : "Edit tekst";
        close();
      });
  })();

  // Close the screen picker after choosing a screen
  document.querySelectorAll(".proto nav a").forEach(function (a) {
    a.addEventListener("click", function () {
      a.closest("details").open = false;
    });
  });
})();
