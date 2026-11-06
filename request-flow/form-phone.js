/* Phone number: country code dropdown + an example number for that country
   (desktop and mobile request forms).
   Every phone input gets a country box on its left: flag, dial code and
   chevron. The real control is a native <select> laid over that box (see
   form-phone.css), so the keyboard, screen readers and the phone's own
   picker all work. The list shows full country names; the box shows only
   the flag and code. script.js adds the code to the number it sends. */
(function () {
  "use strict";

  var FLAGS = "https://www.loopper.co.uk/storage/flags/";
  // United Kingdom first: the default on loopper.co.uk
  var COUNTRIES = [
    { c: "gb", name: "United Kingdom", code: "+44", eg: "7400 123456" },
    { c: "ie", name: "Ireland", code: "+353", eg: "85 012 3456" },
    { c: "nl", name: "Netherlands", code: "+31", eg: "6 12345678" },
    { c: "be", name: "Belgium", code: "+32", eg: "470 12 34 56" },
    { c: "lu", name: "Luxembourg", code: "+352", eg: "628 123 456" },
    { c: "de", name: "Germany", code: "+49", eg: "151 23456789" },
    { c: "at", name: "Austria", code: "+43", eg: "664 123456" },
    { c: "ch", name: "Switzerland", code: "+41", eg: "78 123 45 67" },
    { c: "fr", name: "France", code: "+33", eg: "6 12 34 56 78" },
    { c: "es", name: "Spain", code: "+34", eg: "612 34 56 78" },
    { c: "pt", name: "Portugal", code: "+351", eg: "912 345 678" },
    { c: "it", name: "Italy", code: "+39", eg: "312 345 6789" },
    { c: "dk", name: "Denmark", code: "+45", eg: "20 12 34 56" },
    { c: "se", name: "Sweden", code: "+46", eg: "70 123 45 67" },
    { c: "pl", name: "Poland", code: "+48", eg: "512 345 678" },
    { c: "us", name: "United States", code: "+1", eg: "201 555 0123" },
  ];

  window.loopperPhoneCountries = COUNTRIES; // example numbers for form-phone-search.js

  document.querySelectorAll('input[type="tel"][name="phone"]').forEach(function (input) {
    var wrap = document.createElement("div");
    wrap.className = "f-phone";
    input.parentNode.insertBefore(wrap, input);

    var box = document.createElement("span");
    box.className = "f-cc";
    box.innerHTML =
      '<img class="f-cc-flag" width="18" height="18" alt="" />' +
      '<span class="f-cc-code" aria-hidden="true"></span>' +
      '<img class="f-cc-chev" src="../assets/imgVector142.svg" width="10" height="17" alt="" />';

    var select = document.createElement("select");
    select.name = "phone-code";
    select.setAttribute("aria-label", "Country code");
    select.setAttribute("autocomplete", "tel-country-code");
    COUNTRIES.forEach(function (country, i) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = country.name + " (" + country.code + ")";
      select.appendChild(opt);
    });
    box.appendChild(select);
    wrap.appendChild(box);
    wrap.appendChild(input);

    function update() {
      var country = COUNTRIES[+select.value];
      box.querySelector(".f-cc-flag").src = FLAGS + country.c + ".svg";
      box.querySelector(".f-cc-code").textContent = country.code;
      input.placeholder = "e.g. " + country.eg;
      input.dataset.dialCode = country.code;
    }
    select.addEventListener("change", function () {
      update();
      input.focus();
    });
    update();
  });
})();
