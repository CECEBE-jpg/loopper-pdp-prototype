/* form-v2.html, desktop: calendar under the deadline date field.
   Opens when the field or its calendar icon is clicked (or focused, also
   when "I have a deadline" is chosen, because script.js focuses the field
   then). Choosing a day fills in DD-MM-YY; typing still works and moves the
   calendar along. Days before today can't be chosen.
   Keyboard: arrow down from the field goes into the calendar, arrows move a
   day / week, Page Up / Down a month, Enter chooses, Esc closes. */
(function () {
  "use strict";

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var ARROW = '<img src="../assets/imgVector142.svg" width="8" height="14" alt="" />';

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function midnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function same(a, b) {
    return !!a && !!b && a.getTime() === b.getTime();
  }
  function format(d) {
    return pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getFullYear() % 100);
  }
  function weekday(d) {
    return (d.getDay() + 6) % 7; // Monday = 0
  }
  function parse(text) {
    var m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(text.trim());
    if (!m) return null;
    var d = new Date(2000 + +m[3], +m[2] - 1, +m[1]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }

  var uid = 0;
  document.querySelectorAll(".req .f-date input[data-deadline]").forEach(function (input) {
    var host = input.closest(".f-when-right");
    if (!host) return;
    var id = "fdp-" + ++uid;

    var panel = document.createElement("div");
    panel.className = "fdp";
    panel.id = id;
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Choose a deadline date");
    panel.innerHTML =
      '<div class="fdp-head">' +
      '<button type="button" class="fdp-nav is-prev" aria-label="Previous month">' + ARROW + "</button>" +
      '<p class="fdp-month" aria-live="polite"></p>' +
      '<button type="button" class="fdp-nav is-next" aria-label="Next month">' + ARROW + "</button>" +
      "</div>" +
      '<div class="fdp-grid" role="grid"></div>';
    host.appendChild(panel);

    input.setAttribute("role", "combobox"); // allows aria-expanded on the field
    input.setAttribute("aria-haspopup", "dialog");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", id);
    input.setAttribute("autocomplete", "off");

    var grid = panel.querySelector(".fdp-grid");
    var title = panel.querySelector(".fdp-month");
    var prev = panel.querySelector(".is-prev");
    var next = panel.querySelector(".is-next");
    var selected = null;
    var view = midnight(new Date());
    view.setDate(1);
    var focusDay = null; // the day that can take keyboard focus
    var skipOpen = false; // focus coming back from the calendar

    function today() {
      return midnight(new Date());
    }

    function render(moveFocus) {
      var now = today();
      title.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
      prev.disabled = view.getFullYear() === now.getFullYear() && view.getMonth() === now.getMonth();
      grid.textContent = "";

      var head = document.createElement("div");
      head.className = "fdp-row is-head";
      head.setAttribute("role", "row");
      DAYS.forEach(function (name, i) {
        var cell = document.createElement("span");
        cell.setAttribute("role", "columnheader");
        cell.setAttribute("aria-label", DAY_NAMES[i]);
        cell.textContent = name.slice(0, 2);
        head.appendChild(cell);
      });
      grid.appendChild(head);

      var inMonth = focusDay && focusDay.getMonth() === view.getMonth() && focusDay.getFullYear() === view.getFullYear();
      if (!inMonth) {
        focusDay = selected && selected.getMonth() === view.getMonth() && selected.getFullYear() === view.getFullYear() ? selected : null;
      }
      if (!focusDay) {
        var first = new Date(view);
        focusDay = first < now && view.getMonth() === now.getMonth() ? now : first;
      }

      var total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var row = null;
      var target = null;
      function newRow() {
        row = document.createElement("div");
        row.className = "fdp-row";
        row.setAttribute("role", "row");
        grid.appendChild(row);
      }
      newRow();
      for (var e = 0; e < weekday(view); e++) {
        var blank = document.createElement("span");
        blank.setAttribute("role", "gridcell");
        row.appendChild(blank);
      }
      for (var n = 1; n <= total; n++) {
        var date = new Date(view.getFullYear(), view.getMonth(), n);
        if (n > 1 && weekday(date) === 0) newRow();
        var cell = document.createElement("span");
        cell.setAttribute("role", "gridcell");
        var b = document.createElement("button");
        b.type = "button";
        b.className = "fdp-day";
        b.textContent = n;
        b.dataset.time = String(date.getTime());
        b.setAttribute("aria-label", DAY_NAMES[weekday(date)] + " " + n + " " + MONTHS[date.getMonth()] + " " + date.getFullYear());
        b.tabIndex = same(date, focusDay) ? 0 : -1;
        if (date < now) b.disabled = true;
        if (same(date, now)) {
          b.classList.add("is-today");
          b.setAttribute("aria-current", "date");
        }
        if (same(date, selected)) {
          b.classList.add("is-selected");
          b.setAttribute("aria-selected", "true");
        }
        if (same(date, focusDay)) target = b;
        cell.appendChild(b);
        row.appendChild(cell);
      }
      if (moveFocus && target) target.focus();
    }

    function open() {
      if (!panel.hidden) return;
      var typed = parse(input.value);
      selected = typed;
      view = new Date((typed && typed >= today() ? typed : today()).getTime());
      view.setDate(1);
      focusDay = null;
      render(false);
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    function close(backToField) {
      if (panel.hidden) return;
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
      if (backToField) {
        skipOpen = true;
        input.focus();
        skipOpen = false;
      }
    }
    function month(step, moveFocus) {
      view = new Date(view.getFullYear(), view.getMonth() + step, 1);
      focusDay = null;
      render(moveFocus);
    }
    function move(from, days) {
      var d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
      if (d < today()) return;
      focusDay = d;
      view = new Date(d.getFullYear(), d.getMonth(), 1);
      render(true);
    }

    input.addEventListener("focus", function () {
      if (!skipOpen) open();
    });
    input.addEventListener("click", open);
    input.addEventListener("input", function () {
      var typed = parse(input.value);
      if (typed && typed >= today() && !panel.hidden) {
        selected = typed;
        focusDay = typed;
        view = new Date(typed.getFullYear(), typed.getMonth(), 1);
        render(false);
      }
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        open();
        render(true);
      } else if (e.key === "Escape") {
        close();
      } else if (e.key === "Enter") {
        e.preventDefault(); // never sends the form from here
        close();
      } else if (e.key === "Tab" && !e.shiftKey && !panel.hidden) {
        close();
      } else if (e.key === "Tab") {
        close();
      }
    });

    prev.addEventListener("click", function () {
      month(-1, false);
    });
    next.addEventListener("click", function () {
      month(1, false);
    });
    // keep focus where it is when a month arrow is clicked with the mouse
    [prev, next].forEach(function (b) {
      b.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
    });

    grid.addEventListener("click", function (e) {
      var b = e.target.closest(".fdp-day");
      if (!b || b.disabled) return;
      selected = new Date(+b.dataset.time);
      input.value = format(selected);
      close(true);
    });
    grid.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
        return;
      }
      var b = e.target.closest && e.target.closest(".fdp-day");
      if (!b) return;
      var from = new Date(+b.dataset.time);
      var steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (steps[e.key]) {
        e.preventDefault();
        move(from, steps[e.key]);
      } else if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        if (e.key === "PageUp" && prev.disabled) return;
        month(e.key === "PageUp" ? -1 : 1, true);
      } else if (e.key === "Tab" && !e.shiftKey) {
        close();
      }
    });

    document.addEventListener("mousedown", function (e) {
      if (panel.hidden) return;
      if (panel.contains(e.target) || e.target.closest(".f-date") === input.closest(".f-date")) return;
      close();
    });
  });
})();
