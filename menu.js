(function () {
        const M = window.LP_MENU;
        const $ = (s, r = document) => r.querySelector(s);
        const esc = (s) =>
          String(s).replace(
            /[&<>"]/g,
            (c) =>
              ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
          );
        const ico = (id, cls = "") =>
          `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
        const BADGE =
          '<svg class="brand-tag" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3a1 1 0 0 1 1-1h8.6a1 1 0 0 1 .7.3l9.4 9.4a1 1 0 0 1 0 1.4l-8.6 8.6a1 1 0 0 1-1.4 0L2.3 12.3a1 1 0 0 1-.3-.7zm5 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill-rule="evenodd"/></svg>';
        const lbl = (i) => esc(i.label) + (i.badge ? BADGE : "");
        const iconFor = (id) =>
          document.getElementById("i-" + id) ? id : "grid";
        const CURRENT = null; // id of the category page the visitor is on (shows the Active state), e.g. "clothing"
        const DESKTOP = matchMedia("(min-width: 992px)");
        const q = $("#q");
        const setPh = () =>
          (q.placeholder = DESKTOP.matches
            ? "What are you looking for?"
            : "Search");
        setPh();
        DESKTOP.addEventListener("change", setPh);

        // Top level order: A–Z first, then categories as delivered by the CMS
        const cats = M.cats;
        const byId = Object.fromEntries(cats.map((c) => [c.id, c]));
        const count = (c) =>
          c.groups.reduce((n, g) => n + 1 + (g.items ? g.items.length : 0), 0);
        const isGrid = (c) =>
          c.groups.filter((g) => g.items && g.items.length).length <
          c.groups.length / 2;

        // Group A–Z by letter
        const azGroups = {};
        M.az.forEach((i) => {
          const L = i.label[0].toUpperCase();
          (azGroups[L] = azGroups[L] || []).push(i);
        });
        const letters = Object.keys(azGroups).sort();

        /* =========================== DESKTOP =========================== */
        const catList = $("#catList"),
          mega = $("#mega"),
          megaIn = $("#megaIn"),
          scrim = $("#scrim"),
          hd = $("#hd");

        // Items and order as in Figma 19:746. Sustainable lives only in the mobile menu and A–Z.
        // Bar order: Brands first, then categories by total search clicks (GSC, Oct 2026),
        // frozen here so no click numbers ship in the page. Sectors & Themes sits last.
        const BAR_IDS = ["brands", "giveaways", "food-drinkware", "clothing", "gadgets", "office", "bags", "themes"];
        const XMAS_SEASON = new Date().getMonth() >= 8;
        const CHRISTMAS = {
          label: "Christmas",
          href: "/personalised-christmas-giveaways",
        };
        // Categories with a page are real links (crawlable); Popular Categories / More are buttons
        const navBtn = (id, label, li) => {
          const href = byId[id] && byId[id].href;
          const attrs = `class="cat-btn" data-id="${id}" data-label="${esc(label)}" aria-expanded="false" aria-controls="mega"${id === CURRENT ? ' aria-current="true"' : ""}`;
          return href
            ? `<${li}><a ${attrs} href="${href}"><span>${esc(label)}</span></a></li>`
            : `<${li}><button ${attrs}><span>${esc(label)}</span></button></li>`;
        };
        catList.innerHTML =
          navBtn("all", "Popular Categories", "li") +
          BAR_IDS.map(
            (id) =>
              // in season Christmas takes the spot before Sectors & Themes, so Themes is first into "More"
              (id === "themes" && XMAS_SEASON
                ? `<li data-cat="christmas"><a class="cat-btn" href="${CHRISTMAS.href}" data-label="${CHRISTMAS.label}"><span>${CHRISTMAS.label}</span></a></li>`
                : "") +
              navBtn(id, id === "brands" ? "All Brands" : byId[id].label, `li data-cat="${id}"`),
          ).join("") +
          navBtn("more", "More", "li data-more hidden");

        const moreLi = $("[data-more]", catList);
        let hiddenCats = [];

        // Priority+ : move categories that don't fit into "More"
        function fitBar() {
          if (!DESKTOP.matches) return;
          const items = [...catList.querySelectorAll("li[data-cat]")];
          items.forEach((li) => (li.hidden = false));
          moreLi.hidden = true;
          if (catList.scrollWidth <= catList.clientWidth) {
            hiddenCats = [];
            return;
          }
          moreLi.hidden = false;
          for (
            let i = items.length - 1;
            i >= 0 && catList.scrollWidth > catList.clientWidth;
            i--
          )
            items[i].hidden = true;
          hiddenCats = items
            .filter((li) => li.hidden)
            .map((li) => li.dataset.cat);
        }

        const arrow =
          '<img src="assets/menu/icon-f5a93c56e4.svg" width="14" height="10" alt="">';
        const arrowW =
          '<img src="assets/menu/icon-8a58d53e54.svg" width="14" height="10" alt="">';
        const lower = (t) => t.toLowerCase();
        const viewAll = (label, href) =>
          `<a class="link-all" href="${href}">${esc(label)} ${arrow}</a>`;
        // Title is plain text; "View all" is the one link to the page (no duplicate link to the same URL)
        const mmHead = (label, href) =>
          `<div class="mm-head"><p class="mm-title">${esc(label)}</p>${href ? viewAll("View all " + lower(label), href) : ""}</div>`;
        const links = (items) =>
          items.map((i) => `<a href="${i.href}">${lbl(i)}</a>`).join("");
        const itemsGrid = (items, rows) =>
          rows
            ? `<div class="mm-items" style="grid-template-rows:repeat(${rows},auto);grid-template-columns:repeat(${Math.ceil(items.length / rows)},minmax(0,1fr))">${links(items)}</div>`
            : `<div class="mm-items" style="grid-template-rows:repeat(${Math.max(5, Math.ceil(items.length / 4))},auto)">${links(items)}</div>`;


        // Tabs panel (Figma 18:2471): kicker + Subcategory Tabs + View All Button | divider | header row + items grid
        // SEO: tabs are real links so Google can follow them. Panes are in the HTML only when keep(tab)
        // says so; the rest (incl. the first) are built on open, so subcategory links stay out of the HTML.
        const tabSets = {};
        // kickHref: category side menu, with a small "view all" next to the kicker and in every tab
        // tabAll: small "view all" link in every tab (on by default in category side menus)
        function tabsPanel(key, kicker, tabs, btnHtml, keep = () => false, kickHref = null, tabAll = !!kickHref, side = !!kickHref) {
          tabSets[key] = tabs;
          const first = Math.max(
            0,
            tabs.findIndex((t) => t.render),
          );
          const paneId = (i) => `mmp-${key}-${i}`;
          return `<div class="mm${side ? " mm-side" : ""}" data-key="${key}">
      <div class="mm-left">
        ${side ? "" : `<p class="mm-kicker">${esc(kicker)}</p>`}
        <div class="mm-tabs" role="tablist" aria-orientation="horizontal" aria-label="${esc(kicker)}">
        ${side && !(tabs[0] && tabs[0].top) ? `<div class="mm-kick"><p class="mm-kicker">${esc(kicker)}</p>${kickHref ? `<a class="g-all" href="${kickHref}">view all</a>` : ""}</div>` : ""}
        ${tabs
          .map((t, i) => {
            const inner = `${t.icon ? `<span class="g-ic">${ico(t.icon)}</span>` : ""}<span class="g-txt"><span class="g-label">${lbl(t)}</span>${t.count != null ? `<span class="g-count">${t.count}</span>` : ""}</span>${tabAll ? '<span class="g-all">view all</span>' : ""}<span class="g-chev"><img src="assets/menu/icon-2685aad9a6.svg" width="16" height="22" alt=""><img src="assets/menu/icon-9a61ca159d.svg" width="16" height="22" alt=""></span>`;
            return t.render
              ? `<a class="mm-g${t.top ? " is-top" : ""}" href="${t.href}" role="tab" data-gi="${i}" aria-selected="${i === first}" aria-controls="${paneId(i)}">${inner}</a>`
              : `<a class="mm-g" href="${t.href}">${inner}</a>`;
          })
          .join("")}
        </div>
        ${btnHtml}
      </div>
      <div class="mm-divider" aria-hidden="true"></div>
      ${tabs
        .map((t, i) =>
          t.render && keep(t)
            ? `<div class="mm-center" id="${paneId(i)}" data-pi="${i}" role="tabpanel" hidden>${t.render()}</div>`
            : "",
        )
        .join("")}
    </div>`;
        }
        // Popular subcategories (GSC: 500+ clicks in 12 months, all domains, Oct 2026). The only
        // subcategories linked from the menu HTML; all others stay reachable via the side menu.
        const POPULAR = [
          "/personalised-lighters/clipper-lighters",
          "/personalised-lighters/personalised-cigarette-cases",
          "/personalised-balls/personalised-tennis-balls",
          "/personalised-water-bottles/stanley",
          "/event-giveaways/personalised-condoms",
          "/personalised-footwear/personalised-slippers",
          "/personalised-games/lego",
          "/giveaways-for-kids",
        ];
        // Brands most clicked first (GSC, Oct 2026); an order only, no click numbers
        const BRAND_RANK = ["/personalised-lighters/clipper-lighters", "/personalised-candy/mms", "/personalised-water-bottles/stanley", "/personalised-games/lego", "/brands/adidas", "/personalised-sports-bottles/tacx", "/personalised-gadgets/jbl", "/brands/the-north-face", "/brands/puma", "/personalised-wine-gifts/tubes-gifts", "/personalised-clothing/roly", "/personalised-umbrellas/impliva", "/personalised-water-bottles/earth-water", "/personalised-notebooks/moleskine", "/brands/hugo-boss", "/personalised-water-bottles/camelbak", "/personalised-mugs/contigo", "/personalised-tools/victorinox", "/personalised-water-bottles/join-the-pipe", "/personalised-water-bottles/dopper", "/personalised-lighters/zippo", "/personalised-water-bottles/klean-kanteen", "/personalised-pens/stabilo", "/personalised-water-bottles/avira", "/personalised-towels/walra", "/personalised-luggages/delsey-paris", "/personalised-water-bottles/kambukka", "/personalised-clothing/iqoniq", "/personalised-candy/lindt", "/personalised-clothing/sols", "/personalised-candy/tony-chocolonely", "/personalised-clothing/stanley-stella", "/personalised-notebooks/moyu", "/personalised-pens/parker", "/personalised-pens/waterman", "/personalised-water-bottles/tefal", "/personalised-gadgets/fresh-n-rebel", "/personalised-pens/prodir", "/brands/kingcap", "/personalised-bags/bellroy", "/personalised-water-bottles/mepal", "/personalised-water-bottles/swing", "/personalised-mugs/circular-and-co", "/kitchen-giveaways/opinel", "/personalised-gadgets/sony", "/personalised-wellness-products/janzen", "/personalised-bags/cerruti", "/personalised-water-bottles/larq", "/brands/bic", "/brands/brandcharger", "/personalised-water-bottles/sagaform", "/brands/swiss-peak", "/brands/herschel", "/personalised-bags/case-logic", "/personalised-gadgets/urban-vitamin", "/personalised-gadgets/walter", "/personalised-bags/festibax", "/brands/reisenthel", "/kitchen-giveaways/gusta", "/personalised-wellness-products/personalised-treatments-products", "/brands/vinga", "/personalised-wellness-products/we-love-the-planet"];
        const byRank = (a, b) => BRAND_RANK.indexOf(a.href) - BRAND_RANK.indexOf(b.href);
        // Full category view: every group is a column with its subcategories underneath.
        // Group links and popular subcategories are in the HTML on load; the other subcategory
        // links are filled in when the panel opens, so the page source stays light.
        const FC_MAX = 6; // max links per pane; the pane's "View all" covers the rest
        const isPop = (i) => POPULAR.includes(i.href);
        // Brands per category: a brand belongs to a category when its URL sits under one of the
        // category's groups or it is one of its subcategories. Popular items stay in their column.
        const BRAND_LIST = byId.brands ? byId.brands.groups : [];
        const brandsFor = (c) => {
          const gh = c.groups.map((g) => g.href);
          const ih = new Set(c.groups.flatMap((g) => (g.items || []).map((i) => i.href)));
          return BRAND_LIST.filter(
            (b) =>
              !isPop(b) &&
              ((b.cats && b.cats.includes(c.id)) ||
                ih.has(b.href) ||
                gh.some((h) => b.href.startsWith(h + "/"))),
          ).sort(byRank);
        };
        const BRAND_HREFS = new Set(BRAND_LIST.map((b) => b.href));
        // subcategories shown for a group: brands get their own tab, so they are not listed twice
        const subsOf = (g) => {
          const items = (g.items || []).filter((i) => isPop(i) || !BRAND_HREFS.has(i.href));
          return [...items.slice(0, FC_MAX), ...items.slice(FC_MAX).filter((i) => i.keep || isPop(i))]; // sorted by clicks; keep/popular always shown
        };
        const hasItems = (g) => g.items && g.items.length;
        const twoCols = (list) => itemsGrid(list, Math.ceil(list.length / 2));
        // Category panels use the Popular Categories side menu: groups on the left, the selected
        // group's subcategories on the right (max FC_MAX), Brands as the last tab. Panes holding a
        // popular/keep subcategory are in the HTML on load, so those links stay crawlable.
        const paneLinks = (list, top) => `<div class="${top ? "pane-top" : "pane-low"}">${twoCols(list)}</div>`;
        const groupTab = (g, top = false) => ({
          top,
          label: g.label,
          href: g.href,
          keep: subsOf(g).some((i) => i.keep || isPop(i)),
          render: hasItems(g) ? () => paneLinks(subsOf(g), top) : null,
        });
        const catSide = (c) => {
          const br = brandsFor(c);
          // a group named like its category (Clothing > Clothing) is the top row, not a group below it
          const self = c.groups.filter((g) => g.label === c.label);
          const tabs = [...self, ...c.groups.filter((g) => !self.includes(g))].map((g) =>
            groupTab(g, self.includes(g)),
          );
          if (br.length)
            tabs.push({
              label: "Brands",
              badge: true,
              href: byId.brands.href,
              render: () => paneLinks(br.slice(0, FC_MAX), false),
            });
          return tabsPanel(c.id, c.label, tabs, "", (t) => t.keep, c.href, !!c.href, true);
        };
        // Popular Categories (22 Oct): real product groups (Mugs, Lighters...), not umbrella names,
        // most clicked first. Umbrella rows (Bags > Bags) and Brands/Themes/Sustainable are left out.
        // Top POP_MAX overall, plus groups with POP_MIN+ clicks from categories that are not in the bar.
        const POP_MAX = 12;
        const POP_MIN = 300;
        const POP_FROM = ["outdoor", "wellness"];
        // Most clicked product groups (GSC, Oct 2026), frozen so no click numbers ship in the page
        const POP_HREFS = ["/personalised-lighters", "/personalised-fans", "/personalised-sports-bottles", "/personalised-balls", "/event-giveaways/personalised-condoms", "/personalised-mugs", "/personalised-keyrings", "/personalised-winter-hats", "/giveaways-for-kids", "/personalised-portfolios", "/personalised-towels", "/personalised-caps", "/personalised-sunglasses", "/personalised-lip-balm"];
        const popularGroups = () => {
          const groups = cats.flatMap((c) => c.groups);
          return POP_HREFS.map((h) => groups.find((g) => g.href === h));
        };

        function panelFor(id) {
          if (id === "az") {
            return `<div class="az-bar">
          <button class="az-back" type="button" data-open="all">${ico("chev-l", "ico-sm")}Popular Categories</button>
          <div class="az-filter">${ico("search", "ico-sm")}<label for="azq" class="vh">Filter products A to Z</label><input id="azq" type="search" placeholder="Filter ${M.az.length} product types" autocomplete="off"></div>
          <nav class="az-letters" aria-label="Jump to letter">${letters.map((L) => `<a href="#az-${L}">${L}</a>`).join("")}</nav>
        </div>
        <div class="az-cols" id="azCols">${azCols("")}</div>`;
          }
          if (id === "all") {
            return tabsPanel(
              id,
              "Popular Categories",
              popularGroups().map((g) => groupTab(g)),
              `<button class="btn-all" type="button" data-open="az">Browse products A–Z ${arrowW}</button>`,
              (t) => t.keep,
              null,
              true,
            );
          }
          if (id === "more") {
            return `<div class="more-grid">${hiddenCats
              .map((cid) => {
                if (cid === "christmas")
                  return `<div><h4><a href="${CHRISTMAS.href}">${CHRISTMAS.label}</a></h4></div>`;
                const c = byId[cid];
                return `<div><h4>${c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : esc(c.label)}</h4><ul>${c.groups
                  .slice(0, 7)
                  .map(
                    (g) => `<li><a href="${g.href}">${lbl(g)}</a></li>`,
                  )
                  .join(
                    "",
                  )}</ul>${c.groups.length > 7 && c.href ? viewAll("View all", c.href) : ""}</div>`;
              })
              .join("")}</div>`;
          }
          const c = byId[id];
          if (isGrid(c)) {
            // Brands Mega Menu Panel (27:770)
            return `<div class="grid-panel">${mmHead(c.label, c.href)}
        <div class="grid-links">${c.groups.map((g) => `<a href="${g.href}">${lbl(g)}</a>`).join("")}</div></div>`;
          }
          return catSide(c);
        }

        function azCols(q) {
          const hl = (t) => {
            if (!q) return esc(t);
            const i = t.toLowerCase().indexOf(q);
            return i < 0
              ? esc(t)
              : esc(t.slice(0, i)) +
                  "<mark>" +
                  esc(t.slice(i, i + q.length)) +
                  "</mark>" +
                  esc(t.slice(i + q.length));
          };
          const html = letters
            .map((L) => {
              const items = azGroups[L].filter(
                (i) => !q || i.label.toLowerCase().includes(q),
              );
              return items.length
                ? `<div class="az-group"><h4 id="az-${L}">${L}</h4>${items.map((i) => `<a href="${i.href}">${hl(i.label)}</a>`).join("")}</div>`
                : "";
            })
            .join("");
          return (
            html ||
            `<p class="az-empty">No product types match “${esc(q)}”. Try the main search above.</p>`
          );
        }

        // SEO: category + group links are in the HTML from page load (hidden), not built on hover
        megaIn.innerHTML =
          ["all", ...BAR_IDS]
            .map((id) => `<div data-panel="${id}" hidden>${panelFor(id)}</div>`)
            .join("") + `<div data-panel="dyn" hidden></div>`;
        const dyn = megaIn.querySelector('[data-panel="dyn"]');

        let openId = null,
          openTimer = null,
          closeTimer = null;
        const btn = (id) => catList.querySelector(`.cat-btn[data-id="${id}"]`);

        function openPanel(id, focusFirst) {
          clearTimeout(closeTimer);
          if (openId === id) return;
          catList
            .querySelectorAll('[aria-expanded="true"]')
            .forEach((b) => b.setAttribute("aria-expanded", "false"));
          openId = id;
          (btn(id) || btn("all")).setAttribute("aria-expanded", "true");
          // Pre-rendered panels are only shown; "az" and "more" are still built on open
          const pre = megaIn.querySelector(`[data-panel="${id}"]`);
          const panel = pre || dyn;
          megaIn
            .querySelectorAll("[data-panel]")
            .forEach((p) => (p.hidden = p !== panel));
          if (!pre) dyn.innerHTML = panelFor(id);
          panel.hidden = false;
          mega.classList.toggle("is-tabs", !!panel.querySelector(".mm"));
          mega.classList.toggle("is-half", !!panel.querySelector(".mm")); // side-menu panels open half width
          const sel = panel.querySelector('.mm-g[role=tab][aria-selected="true"]');
          if (sel && !panel.querySelector(".mm-center:not([hidden])")) selectGroup(sel);
          mega.hidden = false;
          // a half-width dropdown opens under its own button, kept inside the bar
          mega.style.left = "";
          const ob = btn(id);
          if (ob && mega.classList.contains("is-half")) {
            const pr = mega.offsetParent.getBoundingClientRect();
            const x = ob.getBoundingClientRect().left - pr.left;
            mega.style.left = Math.max(27, Math.min(x, pr.width - 27 - mega.offsetWidth)) + "px";
          }
          scrim.hidden = false;
          scrim.classList.remove("for-drawer");
          mega.scrollTop = 0;
          if (id === "az") {
            const inp = $("#azq");
            inp.addEventListener("input", () => {
              $("#azCols").innerHTML = azCols(inp.value.trim().toLowerCase());
            });
          }
          if (focusFirst) {
            const f = panel.querySelector("input, a:not([tabindex='-1']), button");
            f && f.focus();
          }
        }
        function closePanel(returnFocus) {
          clearTimeout(openTimer);
          if (!openId) return;
          const b = btn(openId) || btn("all");
          catList
            .querySelectorAll('[aria-expanded="true"]')
            .forEach((x) => x.setAttribute("aria-expanded", "false"));
          openId = null;
          mega.hidden = true;
          scrim.hidden = true;
          dyn.innerHTML = "";
          if (returnFocus) b.focus();
        }

        // Click / keyboard
        // Prototype only: site-relative links open on live loopper.co.uk (production keeps relative URLs).
        // Runs after the menu handlers, so a first click that only selects a tab is left alone.
        const LIVE = "https://www.loopper.co.uk";
        const openLive = (e) => {
          const a = e.target.closest('a[href^="/"]');
          if (!a || e.defaultPrevented || (e.type === "auxclick" && e.button !== 1)) return;
          e.preventDefault();
          const url = LIVE + a.getAttribute("href");
          e.type === "auxclick" || e.ctrlKey || e.metaKey ? window.open(url, "_blank") : (location.href = url);
        };
        document.addEventListener("click", openLive);
        document.addEventListener("auxclick", openLive);
        catList.addEventListener("click", (e) => {
          const b = e.target.closest(".cat-btn[data-id]");
          if (!b) return;
          const id = b.dataset.id;
          // a category link follows its page once its panel is open; before that a click/tap opens the panel
          if (b.tagName === "A" && openId === id) return;
          e.preventDefault();
          openId === id ? closePanel() : openPanel(id, e.detail === 0);
        });
        catList.addEventListener("keydown", (e) => {
          const b = e.target.closest(".cat-btn");
          if (!b) return;
          const all = [...catList.querySelectorAll(".cat-btn")].filter(
            (x) => !x.closest("li").hidden,
          );
          const i = all.indexOf(b);
          if (e.key === "ArrowRight") {
            e.preventDefault();
            all[(i + 1) % all.length].focus();
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            all[(i - 1 + all.length) % all.length].focus();
          }
          if (e.key === "ArrowDown" && b.dataset.id) {
            e.preventDefault();
            openPanel(b.dataset.id, true);
          }
        });

        // Hover intent: small delay on first open, instant when moving between items
        catList.addEventListener("mouseover", (e) => {
          const b = e.target.closest(".cat-btn");
          if (!b) return;
          clearTimeout(openTimer);
          // plain link in the bar (Christmas): no panel of its own, so close the open one
          if (!b.dataset.id) return closePanel();
          clearTimeout(closeTimer);
          openTimer = setTimeout(
            () => openPanel(b.dataset.id),
            openId ? 0 : 140,
          );
        });
        $("#cat").addEventListener("mouseleave", () => {
          clearTimeout(openTimer);
          closeTimer = setTimeout(() => closePanel(), 260);
        });
        $("#cat").addEventListener("mouseenter", () =>
          clearTimeout(closeTimer),
        );

        // Group switching inside the mega menu (hover or click)
        function selectGroup(t) {
          const mm = t.closest(".mm"),
            i = +t.dataset.gi;
          mm.querySelectorAll(".mm-g[role=tab]").forEach((x) =>
            x.setAttribute("aria-selected", x === t),
          );
          const panes = [...mm.querySelectorAll(".mm-center")];
          panes.forEach((p) => (p.hidden = +p.dataset.pi !== i));
          if (!panes.some((p) => +p.dataset.pi === i))
            mm.insertAdjacentHTML(
              "beforeend",
              `<div class="mm-center" id="mmp-${mm.dataset.key}-${i}" data-pi="${i}" role="tabpanel">${tabSets[mm.dataset.key][i].render()}</div>`,
            );
        }
        let gTimer;
        megaIn.addEventListener("mouseover", (e) => {
          const t = e.target.closest(".mm-g[role=tab]");
          if (!t || t.getAttribute("aria-selected") === "true") return;
          clearTimeout(gTimer);
          gTimer = setTimeout(() => selectGroup(t), 90);
        });
        megaIn.addEventListener("mouseout", () => clearTimeout(gTimer));
        megaIn.addEventListener("click", (e) => {
          // First click selects the tab, a click on the selected tab (or its "view all") follows its link
          const t = e.target.closest(".mm-g[role=tab]");
          if (t && t.getAttribute("aria-selected") !== "true" && !e.target.closest(".g-all")) {
            e.preventDefault();
            selectGroup(t);
          }
          const o = e.target.closest("[data-open]");
          if (o) openPanel(o.dataset.open, true);
        });
        megaIn.addEventListener("keydown", (e) => {
          const t = e.target.closest(".mm-g[role=tab]");
          if (!t) return;
          const tabs = [...megaIn.querySelectorAll(".mm-g[role=tab]")];
          const i = tabs.indexOf(t);
          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault();
            const n = tabs[(i + 1) % tabs.length];
            n.focus();
            selectGroup(n);
          }
          if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault();
            const n = tabs[(i - 1 + tabs.length) % tabs.length];
            n.focus();
            selectGroup(n);
          }
        });

        scrim.addEventListener("click", () => {
          closePanel();
          closeDrawer();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            if (drawer.classList.contains("open")) closeDrawer();
            else closePanel(true);
          }
        });
        document.addEventListener("focusin", (e) => {
          if (openId && !$("#cat").contains(e.target)) closePanel();
        });

        /* =========================== MOBILE =========================== */
        const drawer = $("#drawer"),
          stage = $("#drStage"),
          burger = $("#burger");
        const chips = $("#chips");
        chips.innerHTML = cats
          .map(
            (c) =>
              c.href
                ? `<li><a class="chip" href="${c.href}" data-id="${c.id}"${c.id === CURRENT ? ' aria-current="page"' : ""}>${ico(iconFor(c.id))}${esc(c.label)}</a></li>`
                : `<li><button class="chip" type="button" data-id="${c.id}">${ico(iconFor(c.id))}${esc(c.label)}</button></li>`,
          )
          .join("");
        chips.addEventListener("click", (e) => {
          const a = e.target.closest(".chip");
          if (!a) return;
          e.preventDefault();
          openDrawer(a.dataset.id);
        });

        const row = (
          o,
        ) => `<${o.href ? 'a href="' + o.href + '"' : 'button type="button"'} class="row ${o.cls || ""}" ${o.data || ""}>
      ${o.icon ? `<span class="r-ic">${ico(o.icon)}</span>` : ""}
      <span class="r-txt">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>
      ${o.go ? `<span class="r-go">${ico(o.go, "ico-sm")}</span>` : ""}
    </${o.href ? "a" : "button"}>`;

        function rootPanel() {
          return `
      <div class="dp-section">
        <p class="dp-label">Shop by category</p>
        ${row({ label: "All products A–Z", sub: `${M.az.length} product types`, icon: "az", go: "chev-r", data: 'data-push="az"' })}
        ${cats
          .map((c) =>
            row({
              label: c.label,
              sub: c.groups
                .slice(0, 3)
                .map((g) => g.label)
                .join(", "),
              icon: iconFor(c.id),
              go: "chev-r",
              data: `data-push="${c.id}"`,
            }),
          )
          .join("")}
      </div>
      <div class="dp-section">
        <p class="dp-label">Loopper</p>
        ${row({ label: "Free digital design", icon: "pen-tool", href: "#", cls: "plain" })}
        ${row({ label: "Customer stories", icon: "stories", href: "/customer-stories", cls: "plain" })}
        ${row({ label: "Help & contact", icon: "chat", href: "/contact", cls: "plain" })}
        ${row({ label: "My account", icon: "user", href: "/login", cls: "plain" })}
        ${localeSection()}
      </div>
      <a class="dr-call" href="tel:+442045765960"><span class="r-ic">${ico("phone")}</span><span><b>+44 20 4576 5960</b><span>Personal service from our team</span></span></a>`;
        }

        function catPanel(c) {
          return `<div class="dp-title"><h2>${esc(c.label)}</h2></div>
      <div class="dp-section" style="padding-top:0">
        ${c.href ? row({ label: `View all ${c.label.toLowerCase()}`, href: c.href, cls: "all", go: "arrow" }) : ""}
        ${c.groups
          .map((g, i) =>
            g.items && g.items.length
              ? row({
                  label: g.label,
                  sub: `${g.items.length} types`,
                  go: "chev-r",
                  data: `data-push="${c.id}:${i}"`,
                })
              : row({ label: g.label, href: g.href, cls: "plain" }),
          )
          .join("")}
      </div>`;
        }
        function groupPanel(c, g) {
          return `<div class="dp-title"><h2>${esc(g.label)}</h2></div>
      <div class="dp-section" style="padding-top:0">
        ${row({ label: `View all ${g.label.toLowerCase()}`, href: g.href, cls: "all", go: "arrow" })}
        ${g.items.map((i) => row({ label: i.label, href: i.href, cls: "plain" })).join("")}
      </div>`;
        }
        function azPanel() {
          return `<div class="dp-title"><h2>All products A–Z</h2></div>
      <nav class="dp-az-letters" aria-label="Jump to letter">${letters.map((L) => `<a href="#daz-${L}" data-jump="daz-${L}">${L}</a>`).join("")}</nav>
      <div class="dp-az">${letters.map((L) => `<h3 id="daz-${L}">${L}</h3>${azGroups[L].map((i) => row({ label: i.label, href: i.href, cls: "plain" })).join("")}`).join("")}</div>`;
        }

        // Country + currency in the drawer (mobile / tablet). Data comes from the header menus,
        // so both places stay in sync.
        const flagOf = (a) =>
          a.querySelector(".lang-flag").style.backgroundImage;
        const CHECK_SVG = `<svg class="dp-check" width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true"><path d="M1.5 5.2L5.2 8.5L12.5 1.5" stroke="#00AED8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const countries = () =>
          [...document.querySelectorAll("#langMenu a")].map((a) => ({
            name: a.textContent.trim(),
            href: a.getAttribute("href"),
            flag: flagOf(a),
            current: a.hasAttribute("aria-current"),
          }));
        const currencies = () =>
          [...document.querySelectorAll("#curMenu [data-cur]")].map((a) => ({
            code: a.dataset.cur,
            sym: a.dataset.sym,
            name: a
              .querySelector(".cur-name")
              .textContent.replace(/^[\s·]+/, "")
              .trim(),
            current: a.hasAttribute("aria-current"),
          }));
        const flagIc = (bg) =>
          `<span class="r-ic r-flag"><span class="lang-flag lang-flag-lg" style='background-image: ${bg}'></span></span>`;
        const curIc = (sym) =>
          `<span class="r-ic r-cur"><span class="cur-sym">${esc(sym)}</span></span>`;
        function localeSection(open) {
          const cs = countries(),
            ms = currencies();
          const c = cs.find((x) => x.current) || cs[0];
          return `<div class="dp-locale">
        <button type="button" class="row plain loc-toggle" aria-expanded="${open ? "true" : "false"}" aria-controls="dpCountries">${flagIc(c.flag)}<span class="r-txt">${esc(c.name)}<small>Change country</small></span><span class="r-go loc-chev">${ico("chev-d", "ico-sm")}</span></button>
        <div class="loc-list" id="dpCountries"${open ? "" : " hidden"}>
          ${cs.map((x) => `<a class="row plain loc-opt${x.current ? " is-current" : ""}" href="${x.href}"${x.current ? ' aria-current="true"' : ""}>${flagIc(x.flag)}<span class="r-txt">${esc(x.name)}</span>${x.current ? CHECK_SVG : ""}</a>`).join("")}
        </div>
        <div class="row plain loc-cur">${curIc((ms.find((x) => x.current) || ms[0]).sym)}<span class="r-txt" id="dpCurLabel">Currency</span>
          <div class="seg" role="radiogroup" aria-labelledby="dpCurLabel">${ms.map((m) => `<button type="button" role="radio" aria-checked="${m.current}" data-pick-cur="${m.code}" title="${esc(m.name)}">${esc(m.sym)} ${m.code}</button>`).join("")}</div>
        </div>
      </div>`;
        }
        function countryPanel() {
          return `<div class="dp-title"><h2>Country</h2></div>
      <div class="dp-section" style="padding-top:0">
        ${countries()
          .map(
            (c) =>
              `<a class="row plain${c.current ? " is-current" : ""}" href="${c.href}"${c.current ? ' aria-current="true"' : ""}>${flagIc(c.flag)}<span class="r-txt">${esc(c.name)}</span>${c.current ? CHECK_SVG : ""}</a>`,
          )
          .join("")}
      </div>`;
        }
        function currencyPanel() {
          return `<div class="dp-title"><h2>Currency</h2></div>
      <div class="dp-section" style="padding-top:0">
        ${currencies()
          .map(
            (m) =>
              `<button type="button" class="row plain${m.current ? " is-current" : ""}" data-pick-cur="${m.code}"${m.current ? ' aria-current="true"' : ""}>${curIc(m.sym)}<span class="r-txt">${m.code} <span class="dp-cur-name">· ${esc(m.name)}</span></span>${m.current ? CHECK_SVG : ""}</button>`,
          )
          .join("")}
      </div>`;
        }

        const stack = [];
        function push(key, instant) {
          let html, back;
          if (key === "root") html = rootPanel();
          else if (key === "az") {
            html = azPanel();
            back = "Menu";
          } else if (key === "country" || key === "currency") {
            html = key === "country" ? countryPanel() : currencyPanel();
            back = "Menu";
          } else if (key.includes(":")) {
            const [cid, gi] = key.split(":");
            const c = byId[cid];
            html = groupPanel(c, c.groups[+gi]);
            back = c.label;
          } else {
            html = catPanel(byId[key]);
            back = "Menu";
          }
          const p = document.createElement("div");
          p.className = "dp" + (instant ? "" : " enter");
          p.innerHTML =
            (back
              ? `<button class="dp-back" data-back>${ico("chev-l", "ico-sm")}${esc(back)}</button>`
              : "") + html;
          stage.appendChild(p);
          const prev = stack[stack.length - 1];
          stack.push(p);
          if (!instant) {
            void p.offsetWidth;
            p.classList.remove("enter");
            prev && prev.classList.add("behind");
          } else if (prev) prev.classList.add("behind");
          if (prev) prev.inert = true;
          const f = p.querySelector("[data-back], .row");
          f &&
            setTimeout(
              () => f.focus({ preventScroll: true }),
              instant ? 0 : 280,
            );
        }
        function pop() {
          if (stack.length < 2) return;
          const p = stack.pop(),
            prev = stack[stack.length - 1];
          prev.inert = false;
          prev.classList.remove("behind");
          p.classList.add("enter");
          setTimeout(() => p.remove(), 300);
          const f = prev.querySelector(".row");
          f && f.focus({ preventScroll: true });
        }
        stage.addEventListener("click", (e) => {
          const b = e.target.closest("[data-push]");
          if (b) {
            push(b.dataset.push);
            return;
          }
          if (e.target.closest("[data-back]")) {
            pop();
            return;
          }
          const j = e.target.closest("[data-jump]");
          if (j) {
            e.preventDefault();
            const t = document.getElementById(j.dataset.jump);
            t.closest(".dp").scrollTo({
              top: t.offsetTop - 52,
              behavior: "smooth",
            });
          }
        });

        // Drawer locale controls: country dropdown opens in place; currency switch applies through the header switch
        stage.addEventListener("click", (e) => {
          const t = e.target.closest(".loc-toggle");
          if (t) {
            const open = t.getAttribute("aria-expanded") !== "true";
            t.setAttribute("aria-expanded", open);
            document.getElementById("dpCountries").hidden = !open;
            return;
          }
          const b = e.target.closest("[data-pick-cur]");
          if (!b) return;
          const a = document.querySelector(
            `#curMenu [data-cur="${b.dataset.pickCur}"]`,
          );
          if (a && !a.hasAttribute("aria-current")) a.click();
          document.getElementById("curMenu").hidden = true;
          const sec = stack[0] && stack[0].querySelector(".dp-locale");
          if (sec) {
            const open =
              sec.querySelector(".loc-toggle").getAttribute("aria-expanded") ===
              "true";
            sec.outerHTML = localeSection(open);
            const now = stack[0].querySelector(
              `.seg [data-pick-cur="${b.dataset.pickCur}"]`,
            );
            now && now.focus({ preventScroll: true });
          }
        });
        let lastFocus;
        function openDrawer(startAt) {
          lastFocus = document.activeElement;
          stage.innerHTML = "";
          stack.length = 0;
          push("root", true);
          if (startAt) push(startAt, true);
          drawer.classList.add("open");
          burger.setAttribute("aria-expanded", "true");
          scrim.hidden = false;
          scrim.classList.add("for-drawer");
          hd.inert = true;
          $("#main").inert = true;
          document.body.style.overflow = "hidden";
          setTimeout(() => $("#drClose").focus(), 50);
        }
        function closeDrawer() {
          if (!drawer.classList.contains("open")) return;
          drawer.classList.remove("open");
          burger.setAttribute("aria-expanded", "false");
          scrim.hidden = true;
          scrim.classList.remove("for-drawer");
          hd.inert = false;
          $("#main").inert = false;
          document.body.style.overflow = "";
          lastFocus && lastFocus.focus();
        }
        burger.addEventListener("click", () => openDrawer());
        $("#drClose").addEventListener("click", closeDrawer);
        // Swipe right to close
        let sx = null;
        drawer.addEventListener(
          "touchstart",
          (e) => (sx = e.touches[0].clientX),
          { passive: true },
        );
        drawer.addEventListener("touchend", (e) => {
          if (sx !== null && e.changedTouches[0].clientX - sx > 80)
            closeDrawer();
          sx = null;
        });

        /* =========================== SHARED =========================== */
        $("#uspClose").addEventListener("click", () => $("#usp").remove());

        // Language switch: toggle the menu, close on outside click / Escape

        // Currency switch: prototype only - updates the symbol in the header
        (function curSwitch() {
          const b = $("#curBtn"),
            m = $("#curMenu"),
            sym = $("#curSym");
          const lb = $("#langBtn"),
            lm = $("#langMenu");
          const set = (open, focus) => {
            m.hidden = !open;
            b.setAttribute("aria-expanded", open);
            if (open) {
              closePanel();
              lm.hidden = true;
              lb.setAttribute("aria-expanded", "false");
              focus && m.querySelector("[data-cur]").focus();
            }
          };
          b.addEventListener("click", (e) => set(m.hidden, e.detail === 0));
          lb.addEventListener("click", () => set(false));
          m.addEventListener("click", (e) => {
            const a = e.target.closest("[data-cur]");
            if (!a) return;
            m.querySelectorAll("[data-cur]").forEach((x) =>
              x.removeAttribute("aria-current"),
            );
            a.setAttribute("aria-current", "true");
            sym.textContent = a.dataset.sym;
            b.setAttribute(
              "aria-label",
              `Currency: ${a.dataset.cur}. Change currency`,
            );
            set(false);
            b.focus();
          });
          document.addEventListener("click", (e) => {
            if (!m.hidden && !e.target.closest(".cur")) set(false);
          });
          document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !m.hidden) {
              set(false);
              b.focus();
            }
          });
        })();
        (function langSwitch() {
          const b = $("#langBtn"),
            m = $("#langMenu");
          const set = (open, focus) => {
            m.hidden = !open;
            b.setAttribute("aria-expanded", open);
            if (open) {
              closePanel();
              focus && m.querySelector("a").focus();
            }
          };
          const wrap = b.closest(".lang");
          const hoverable = matchMedia("(hover: hover)");
          wrap.addEventListener(
            "mouseenter",
            () => hoverable.matches && set(true),
          );
          wrap.addEventListener(
            "mouseleave",
            () => hoverable.matches && set(false),
          );
          b.addEventListener("click", (e) =>
            set(
              hoverable.matches && e.detail !== 0 ? true : m.hidden,
              e.detail === 0,
            ),
          );
          document.addEventListener("click", (e) => {
            if (!m.hidden && !e.target.closest(".lang")) set(false);
          });
          document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !m.hidden) {
              set(false);
              b.focus();
            }
          });
        })();

        // Mobile USP ticker (Figma 33:3388): show one benefit at a time, slide to the next every 3.5s.
        // A clone of the first item at the end makes the loop seamless.
        (function uspTicker() {
          const box = $(".usp-left");
          const items = [...box.querySelectorAll(".usp-item")];
          const clone = items[0].cloneNode(true);
          clone.classList.add("is-clone");
          clone.setAttribute("aria-hidden", "true");
          box.appendChild(clone);
          const all = [...items, clone];
          let i = 0,
            paused = false;
          // Measure item width + gap from the layout so CSS changes can't misalign the slide
          const step = () => all[1].offsetLeft - all[0].offsetLeft;
          const place = (animate) =>
            all.forEach((el) => {
              el.style.transition = animate ? "" : "none";
              el.style.transform = i ? `translateX(${-i * step()}px)` : "";
            });
          setInterval(() => {
            if (
              DESKTOP.matches ||
              paused ||
              document.hidden ||
              !box.isConnected
            )
              return;
            i++;
            place(true);
            if (i === items.length)
              setTimeout(() => {
                i = 0;
                place(false);
              }, 500);
          }, 3500);
          DESKTOP.addEventListener("change", () => {
            i = 0;
            place(false);
          });
          box.addEventListener("pointerenter", () => (paused = true));
          box.addEventListener("pointerleave", () => (paused = false));
        })();
        addEventListener(
          "scroll",
          () => hd.classList.toggle("is-stuck", scrollY > 4),
          { passive: true },
        );
        addEventListener("resize", () => {
          fitBar();
          if (DESKTOP.matches) closeDrawer();
          else closePanel();
        });
        document.fonts && document.fonts.ready.then(fitBar);
        fitBar();
      })();
