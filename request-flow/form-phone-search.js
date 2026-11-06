/* Desktop request forms: the phone country box opens a searchable list
   styled like the request summary dropdowns, instead of the native list.
   - every country is in the list (Popular first, then A-Z), each with its
     flag and dial code
   - search by country name, by common name (UK, Holland, USA) or by code
     (31 or +31)
   - nothing found? Typing a code offers "Use +371", so any code can be
     entered by hand
   - keyboard: the search box is a combobox; arrows move, Enter chooses, Esc
     closes; screen readers hear how many results there are
   Runs after form-phone.js and replaces its native select. The phone-sized
   form keeps the native list: it is the better picker on a phone. */
(function () {
  "use strict";

  var FLAGS = "https://www.loopper.co.uk/storage/flags/";
  var POPULAR = ["gb", "ie", "nl", "be", "de", "fr", "es", "it", "us"];
  var ALIASES = {
    gb: "uk britain great britain england scotland wales",
    nl: "holland nederland",
    de: "deutschland",
    es: "espana",
    us: "usa america",
    ae: "uae emirates",
    ch: "schweiz suisse",
    be: "belgie belgique",
    at: "osterreich",
    cz: "czech republic",
  };
  var DATA =
    "Afghanistan|af|93;Albania|al|355;Algeria|dz|213;Andorra|ad|376;Angola|ao|244;Antigua and Barbuda|ag|1268;" +
    "Argentina|ar|54;Armenia|am|374;Australia|au|61;Austria|at|43;Azerbaijan|az|994;Bahamas|bs|1242;Bahrain|bh|973;" +
    "Bangladesh|bd|880;Barbados|bb|1246;Belarus|by|375;Belgium|be|32;Belize|bz|501;Benin|bj|229;Bhutan|bt|975;" +
    "Bolivia|bo|591;Bosnia and Herzegovina|ba|387;Botswana|bw|267;Brazil|br|55;Brunei|bn|673;Bulgaria|bg|359;" +
    "Burkina Faso|bf|226;Burundi|bi|257;Cambodia|kh|855;Cameroon|cm|237;Canada|ca|1;Cape Verde|cv|238;" +
    "Central African Republic|cf|236;Chad|td|235;Chile|cl|56;China|cn|86;Colombia|co|57;Comoros|km|269;Congo|cg|242;" +
    "Costa Rica|cr|506;Croatia|hr|385;Cuba|cu|53;Cyprus|cy|357;Czechia|cz|420;DR Congo|cd|243;Denmark|dk|45;" +
    "Djibouti|dj|253;Dominica|dm|1767;Dominican Republic|do|1809;Ecuador|ec|593;Egypt|eg|20;El Salvador|sv|503;" +
    "Equatorial Guinea|gq|240;Eritrea|er|291;Estonia|ee|372;Eswatini|sz|268;Ethiopia|et|251;Fiji|fj|679;Finland|fi|358;" +
    "France|fr|33;Gabon|ga|241;Gambia|gm|220;Georgia|ge|995;Germany|de|49;Ghana|gh|233;Greece|gr|30;Grenada|gd|1473;" +
    "Guatemala|gt|502;Guinea|gn|224;Guinea-Bissau|gw|245;Guyana|gy|592;Haiti|ht|509;Honduras|hn|504;Hong Kong|hk|852;" +
    "Hungary|hu|36;Iceland|is|354;India|in|91;Indonesia|id|62;Iran|ir|98;Iraq|iq|964;Ireland|ie|353;Israel|il|972;" +
    "Italy|it|39;Ivory Coast|ci|225;Jamaica|jm|1876;Japan|jp|81;Jordan|jo|962;Kazakhstan|kz|7;Kenya|ke|254;" +
    "Kiribati|ki|686;Kosovo|xk|383;Kuwait|kw|965;Kyrgyzstan|kg|996;Laos|la|856;Latvia|lv|371;Lebanon|lb|961;" +
    "Lesotho|ls|266;Liberia|lr|231;Libya|ly|218;Liechtenstein|li|423;Lithuania|lt|370;Luxembourg|lu|352;Macau|mo|853;" +
    "Madagascar|mg|261;Malawi|mw|265;Malaysia|my|60;Maldives|mv|960;Mali|ml|223;Malta|mt|356;Marshall Islands|mh|692;" +
    "Mauritania|mr|222;Mauritius|mu|230;Mexico|mx|52;Micronesia|fm|691;Moldova|md|373;Monaco|mc|377;Mongolia|mn|976;" +
    "Montenegro|me|382;Morocco|ma|212;Mozambique|mz|258;Myanmar|mm|95;Namibia|na|264;Nauru|nr|674;Nepal|np|977;" +
    "Netherlands|nl|31;New Zealand|nz|64;Nicaragua|ni|505;Niger|ne|227;Nigeria|ng|234;North Korea|kp|850;" +
    "North Macedonia|mk|389;Norway|no|47;Oman|om|968;Pakistan|pk|92;Palau|pw|680;Palestine|ps|970;Panama|pa|507;" +
    "Papua New Guinea|pg|675;Paraguay|py|595;Peru|pe|51;Philippines|ph|63;Poland|pl|48;Portugal|pt|351;Qatar|qa|974;" +
    "Romania|ro|40;Russia|ru|7;Rwanda|rw|250;Saint Kitts and Nevis|kn|1869;Saint Lucia|lc|1758;" +
    "Saint Vincent and the Grenadines|vc|1784;Samoa|ws|685;San Marino|sm|378;Sao Tome and Principe|st|239;" +
    "Saudi Arabia|sa|966;Senegal|sn|221;Serbia|rs|381;Seychelles|sc|248;Sierra Leone|sl|232;Singapore|sg|65;" +
    "Slovakia|sk|421;Slovenia|si|386;Solomon Islands|sb|677;Somalia|so|252;South Africa|za|27;South Korea|kr|82;" +
    "South Sudan|ss|211;Spain|es|34;Sri Lanka|lk|94;Sudan|sd|249;Suriname|sr|597;Sweden|se|46;Switzerland|ch|41;" +
    "Syria|sy|963;Taiwan|tw|886;Tajikistan|tj|992;Tanzania|tz|255;Thailand|th|66;Timor-Leste|tl|670;Togo|tg|228;" +
    "Tonga|to|676;Trinidad and Tobago|tt|1868;Tunisia|tn|216;Turkey|tr|90;Turkmenistan|tm|993;Tuvalu|tv|688;Uganda|ug|256;" +
    "Ukraine|ua|380;United Arab Emirates|ae|971;United Kingdom|gb|44;United States|us|1;Uruguay|uy|598;Uzbekistan|uz|998;" +
    "Vanuatu|vu|678;Vatican City|va|379;Venezuela|ve|58;Vietnam|vn|84;Yemen|ye|967;Zambia|zm|260;Zimbabwe|zw|263";

  var examples = {};
  (window.loopperPhoneCountries || []).forEach(function (x) {
    examples[x.c] = x.eg;
  });
  function plain(text) {
    return text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }
  var ALL = DATA.split(";").map(function (row) {
    var p = row.split("|");
    return {
      name: p[0],
      c: p[1],
      code: "+" + p[2],
      eg: examples[p[1]] || "",
      search: plain(p[0] + " " + (ALIASES[p[1]] || "")),
    };
  });
  var BY_ISO = {};
  ALL.forEach(function (x) {
    BY_ISO[x.c] = x;
  });

  var uid = 0;
  document.querySelectorAll(".req .f-phone").forEach(function (wrap) {
    var input = wrap.querySelector('input[type="tel"]');
    var box = wrap.querySelector(".f-cc");
    var field = wrap.closest(".f-field");
    if (!input || !box || !field) return;
    var native = box.querySelector("select");
    if (native) native.remove();

    var id = "fcc-" + ++uid;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "f-cc-btn";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", id + "-panel");
    box.appendChild(button);

    var panel = document.createElement("div");
    panel.className = "fcc-panel";
    panel.id = id + "-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<div class="fcc-search-wrap"><input class="fcc-search" type="text" role="combobox" ' +
      'aria-expanded="true" aria-autocomplete="list" autocomplete="off" spellcheck="false" ' +
      'aria-controls="' + id + '-list" aria-label="Search by country or code" ' +
      'placeholder="Search country or code" /></div>' +
      '<div class="fcc-list" id="' + id + '-list" role="listbox" aria-label="Country code"></div>' +
      '<p class="fcc-status vh" aria-live="polite"></p>';
    field.appendChild(panel);

    var search = panel.querySelector(".fcc-search");
    var list = panel.querySelector(".fcc-list");
    var status = panel.querySelector(".fcc-status");
    var flag = box.querySelector(".f-cc-flag");
    var codeText = box.querySelector(".f-cc-code");
    var current = BY_ISO.gb;
    var items = [];
    var active = -1;

    function apply(country) {
      current = country;
      if (country.c) {
        flag.src = FLAGS + country.c + ".svg";
        flag.hidden = false;
      } else {
        flag.hidden = true;
      }
      codeText.textContent = country.code;
      input.placeholder = country.eg ? "e.g. " + country.eg : "Your phone number";
      input.dataset.dialCode = country.code;
      button.setAttribute(
        "aria-label",
        "Country code: " + (country.c ? country.name + " " : "") + country.code + ". Change",
      );
    }

    function option(country, text) {
      var el = document.createElement("div");
      var index = items.length;
      el.id = id + "-opt-" + index;
      el.className = "fcc-opt";
      el.setAttribute("role", "option");
      var selected = country.code === current.code && country.c === current.c;
      el.setAttribute("aria-selected", String(selected));
      if (selected) el.classList.add("is-selected");
      el.innerHTML =
        (country.c
          ? '<img class="fcc-flag" loading="lazy" width="18" height="18" alt="" src="' + FLAGS + country.c + '.svg" />'
          : '<span class="fcc-flag is-empty" aria-hidden="true">+</span>') +
        '<span class="fcc-name"></span>' +
        (country.c ? '<span class="fcc-code">' + country.code + "</span>" : "");
      el.querySelector(".fcc-name").textContent = text || country.name;
      el.addEventListener("mousedown", function (e) {
        e.preventDefault(); // keeps focus in the search box until chosen
      });
      el.addEventListener("click", function () {
        choose(country);
      });
      el.addEventListener("mousemove", function () {
        setActive(index, false);
      });
      items.push({ el: el, country: country });
      return el;
    }

    function heading(text) {
      var el = document.createElement("div");
      el.className = "fcc-group";
      el.setAttribute("role", "presentation");
      el.textContent = text;
      return el;
    }

    function setActive(index, scroll) {
      if (items[active]) items[active].el.classList.remove("is-active");
      active = index;
      if (items[active]) {
        items[active].el.classList.add("is-active");
        search.setAttribute("aria-activedescendant", items[active].el.id);
        if (scroll) items[active].el.scrollIntoView({ block: "nearest" });
      } else {
        search.removeAttribute("aria-activedescendant");
      }
    }

    function render() {
      var raw = search.value.trim();
      var q = plain(raw);
      var digits = /^\+?\d{1,4}$/.test(raw) ? raw.replace("+", "") : "";
      list.textContent = "";
      items = [];
      active = -1;

      if (!q) {
        list.appendChild(heading("Popular"));
        POPULAR.forEach(function (c) {
          list.appendChild(option(BY_ISO[c]));
        });
        list.appendChild(heading("All countries"));
        ALL.forEach(function (x) {
          list.appendChild(option(x));
        });
      } else {
        var found = ALL.filter(function (x) {
          return digits ? x.code.slice(1).indexOf(digits) === 0 : x.search.indexOf(q) >= 0;
        });
        // exact code first: "31" puts the Netherlands above +310...
        found.sort(function (a, b) {
          if (!digits) {
            var an = a.search.indexOf(q) === 0 ? 0 : 1;
            var bn = b.search.indexOf(q) === 0 ? 0 : 1;
            return an - bn;
          }
          return a.code.length - b.code.length;
        });
        found.forEach(function (x) {
          list.appendChild(option(x));
        });
        var exact = found.some(function (x) {
          return x.code === "+" + digits;
        });
        if (digits && !exact) {
          list.appendChild(option({ c: "", name: "", code: "+" + digits, eg: "" }, "Use +" + digits));
        }
        if (!items.length) {
          var none = document.createElement("p");
          none.className = "fcc-none";
          none.textContent = "No country found. Type your country code instead, for example +371.";
          list.appendChild(none);
        }
      }
      var chosen = -1;
      items.forEach(function (it, i) {
        if (chosen < 0 && it.el.classList.contains("is-selected")) chosen = i;
      });
      setActive(q ? (items.length ? 0 : -1) : Math.max(chosen, 0), true);
      if (q) status.textContent = items.length + (items.length === 1 ? " result" : " results");
      else status.textContent = "";
    }

    function open() {
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      box.classList.add("is-open");
      search.value = "";
      render();
      list.scrollTop = 0;
      if (items[active]) items[active].el.scrollIntoView({ block: "nearest" });
      search.focus({ preventScroll: true });
      // the whole list in view when it would run past the window
      panel.scrollIntoView({ block: "nearest" });
    }
    function close(focusTo) {
      if (panel.hidden) return;
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
      box.classList.remove("is-open");
      if (focusTo) focusTo.focus();
    }
    function choose(country) {
      apply(country);
      close(input);
    }

    button.addEventListener("click", function () {
      if (panel.hidden) open();
      else close(button);
    });
    search.addEventListener("input", render);
    search.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        var step = e.key === "ArrowDown" ? 1 : -1;
        setActive((active + step + items.length) % items.length, true);
      } else if (e.key === "Enter") {
        e.preventDefault(); // never sends the form from here
        if (items[active]) choose(items[active].country);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close(button);
      } else if (e.key === "Tab") {
        close();
      }
    });
    document.addEventListener("mousedown", function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !box.contains(e.target)) close();
    });

    apply(BY_ISO.gb);
  });
})();
