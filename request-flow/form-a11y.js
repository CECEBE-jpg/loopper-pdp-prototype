/* Request form accessibility (WCAG 2.2 AA), desktop and mobile forms.
   1. Sections: "My logo", "Delivery" and "My details" are named groups for
      screen readers (role=group, labelled by their visible label); the
      delivery radios are a radiogroup named by "When do you need this
      product?".
   2. Required fields (email, first name, surname): on "Send request" every
      empty or invalid one gets an error under it (icon + text, not colour
      alone), aria-invalid and aria-describedby, and focus moves to the first
      one. The request is only sent when they are all filled in. An error
      goes away as soon as the field is fixed.
   3. Logo upload: after choosing a file, a "Remove" button appears next to
      the file name; the status line is announced (aria-live in the markup).
   Loaded after script.js; its submit handler only runs when the form is
   valid (this one listens on the document, in the capture phase). */
(function () {
  "use strict";

  var uid = 0;
  function idFor(el, prefix) {
    if (!el.id) el.id = prefix + "-" + ++uid;
    return el.id;
  }

  // ---------- 1. named groups ----------
  document
    .querySelectorAll(".req .f-logo, .req .f-when, .req .f-details")
    .forEach(function (section) {
      var label = section.querySelector(":scope > .f-h");
      if (!label) return;
      section.setAttribute("role", "group");
      section.setAttribute("aria-labelledby", idFor(label, "f-sec"));
    });
  document.querySelectorAll(".req .f-when").forEach(function (when) {
    var q = when.querySelector(".f-q");
    var row = when.querySelector(".f-when-row");
    if (!q || !row) return;
    row.setAttribute("role", "radiogroup");
    row.setAttribute("aria-labelledby", idFor(q, "f-q"));
  });

  // ---------- 2. required fields ----------
  var MESSAGES = {
    email: "Please enter your email address",
    emailFormat: "Please enter a valid email address, for example name@company.com",
    first: "Please enter your first name",
    last: "Please enter your surname",
  };

  function problem(input) {
    var value = input.value.trim();
    if (input.name === "email") {
      if (!value) return MESSAGES.email;
      if (input.validity && input.validity.typeMismatch) return MESSAGES.emailFormat;
      return "";
    }
    return value ? "" : MESSAGES[input.name] || "Please fill in this field";
  }

  function errorFor(input) {
    return document.getElementById(input.id + "-error");
  }

  function showError(input, text) {
    var err = errorFor(input);
    if (!err) {
      err = document.createElement("p");
      err.className = "f-error";
      err.id = input.id + "-error";
      err.innerHTML = '<span class="f-error-icon" aria-hidden="true">!</span><span class="f-error-text"></span>';
      input.insertAdjacentElement("afterend", err);
      var described = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      if (described.indexOf(err.id) < 0) described.push(err.id);
      input.setAttribute("aria-describedby", described.join(" "));
    }
    err.querySelector(".f-error-text").textContent = text;
    input.setAttribute("aria-invalid", "true");
  }

  function clearError(input) {
    var err = errorFor(input);
    if (err) err.remove();
    input.removeAttribute("aria-invalid");
    var described = (input.getAttribute("aria-describedby") || "")
      .split(" ")
      .filter(function (id) {
        return id && id !== input.id + "-error";
      });
    if (described.length) input.setAttribute("aria-describedby", described.join(" "));
    else input.removeAttribute("aria-describedby");
  }

  // runs before script.js's own submit handler (document, capture phase)
  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!form.matches || !form.matches(".form-card, .mrq-form")) return;
      var first = null;
      form.querySelectorAll("[required]").forEach(function (input) {
        var text = problem(input);
        if (text) {
          showError(input, text);
          if (!first) first = input;
        } else {
          clearError(input);
        }
      });
      if (first) {
        e.preventDefault();
        e.stopImmediatePropagation();
        first.focus();
      }
    },
    true,
  );

  // fixed as you type; the format check waits until you leave the field
  document.querySelectorAll(".form-card [required], .mrq-form [required]").forEach(function (input) {
    input.addEventListener("input", function () {
      if (input.getAttribute("aria-invalid") !== "true") return;
      var text = problem(input);
      if (!text) clearError(input);
      else if (text !== MESSAGES.emailFormat) showError(input, text);
    });
    input.addEventListener("blur", function () {
      if (input.getAttribute("aria-invalid") !== "true") return;
      var text = problem(input);
      if (text) showError(input, text);
      else clearError(input);
    });
  });

  // ---------- 3. logo upload: remove the chosen file ----------
  document.querySelectorAll(".req .logo-upload input[type=file]").forEach(function (fileInput) {
    var up = fileInput.closest(".logo-up");
    var later = up && up.querySelector(".logo-later");
    if (!later) return;
    var original = later.textContent;
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "logo-remove";
    remove.textContent = "Remove";
    remove.hidden = true;
    later.insertAdjacentElement("afterend", remove);

    fileInput.addEventListener("change", function () {
      // script.js has just written "✓ file name" into the status line
      if (fileInput.files.length) {
        remove.hidden = false;
        remove.setAttribute("aria-label", "Remove " + fileInput.files[0].name);
      }
    });
    remove.addEventListener("click", function () {
      fileInput.value = "";
      later.textContent = "Logo removed. " + original;
      remove.hidden = true;
      fileInput.focus();
    });
  });
})();
