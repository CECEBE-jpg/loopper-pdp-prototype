/* ============================================================
   Flow logic mirroring the Figma prototype reactions
   (read from the file's `reactions` data via the REST API):

   - Header ON_CLICK  -> CHANGE_TO expanded variant + CHANGE_TO flow state
                         SMART_ANIMATE / EASE_OUT / 0.3s
   - Swatch ON_CLICK  -> CHANGE_TO "selected" (transition: null = instant)
                         AND CHANGE_TO next flow state (auto-advance)
   - Swatch ON_HOVER  -> CHANGE_TO hover variant, SMART_ANIMATE 0.3s
   - CTA    ON_CLICK  -> NAVIGATE (request flow screen)
   ============================================================ */

const STEPS = ["color", "position", "printing", "quantity", "percolor"];
const BASE_PRICE = 7.99;

const state = {
  open: "color",
  quantity: 250,
  price: 6.01,
  // display labels shown in the collapsed headers — kept apart from the
  // numeric fields above so they can't clobber them
  labels: { color: null, position: null, printing: null, quantity: null },
  multi: { color: false, position: false, printing: false },
};

/* ---------- desktop / tablet / mobile switch -------------------------------
   Desktop (>= 768px, tablets included) is fluid in styles.css — the 1590px
   content column narrows to keep 10px either side and the columns shrink —
   so nothing is scaled or shifted here. Below 768px the page reflows into
   the mobile layout. Keep in sync with styles.css "(width < 768px)". */
const DESKTOP_MIN = 768;

const frame = document.getElementById("frame");

const fluidLayout = matchMedia(`(width < ${DESKTOP_MIN}px)`);

// Phones keep the proportions the mobile design has on a 393px screen
// (iPhone 16): the whole page is zoomed by screen width / 393, so a 360px or
// 430px phone shows the same layout, just smaller or larger.
const MOBILE_DESIGN_WIDTH = 393;
const phoneLayout = matchMedia("(max-width: 767px)");

// The first values come from the inline script in index.html's <head> (--pz,
// styles.css "page zoom before the first paint"); this keeps them right on
// resize / rotation. Keep both formulas in sync.
function fitPhone() {
  const vw = document.documentElement.clientWidth;
  const zoom = phoneLayout.matches ? vw / MOBILE_DESIGN_WIDTH : 1;
  document.body.style.zoom = zoom === 1 ? "" : String(zoom);
  // the navigation menu (nav.js) is responsive on its own; undo the page
  // zoom on it so it renders at its native size
  document.querySelectorAll(".hd, .drawer, .scrim").forEach((el) => {
    el.style.zoom = zoom === 1 ? "" : String(1 / zoom);
  });
  // the buy bar's own box stays unzoomed too, only its content is scaled:
  // iOS Safari colours the area behind its toolbar from a plain fixed bar at
  // the bottom edge, and a page-zoomed one isn't picked up
  const bar = document.querySelector(".m-buybar");
  if (bar) {
    bar.style.zoom = zoom === 1 ? "" : String(1 / zoom);
    bar.querySelector(".m-buybar-inner").style.zoom = zoom === 1 ? "" : String(zoom);
  }
}

// the hover print-position preview (styles.css .pos-overlay) sits right of
// the configurator: 16px gap + 232px card + 10px to the screen edge
const POS_PREVIEW_ROOM = 16 + 232 + 10;

/* The product tabs under the photo (Product details / Properties / …) must
   be in view when the page opens. If they'd land below the fold, the photo
   frame gets shorter (never below 240px) by exactly the overflow and the
   photo shrinks with it; the frame keeps its full width. Measured as at the
   top of the page, with the full header. */
const GALLERY_MIN = 240;
const FOLD_MARGIN = 16;
function fitGallery() {
  const box = document.querySelector(".product-image-container");
  box.style.removeProperty("--gallery-max");
  if (fluidLayout.matches) return;
  // page position, independent of the header's state: the fixed header's
  // spacer always holds the full header height (compactHeader)
  const tabs = document.querySelector(".tab-list");
  const bottom = tabs.getBoundingClientRect().bottom + window.scrollY;
  const over = bottom - (window.innerHeight - FOLD_MARGIN);
  if (over > 0) {
    const size = Math.max(GALLERY_MIN, box.getBoundingClientRect().width - over);
    box.style.setProperty("--gallery-max", `${Math.floor(size)}px`);
  }
}

function fitFrame() {
  fitPhone();
  fitGallery();
  if (fluidLayout.matches) return;
  // not enough room on the right (narrower desktops): the card goes above
  // the hovered row's "view" link instead (styles.css .pos-preview-above)
  const configurator = document.querySelector(".configurator");
  const room = document.documentElement.clientWidth - configurator.getBoundingClientRect().right;
  frame.classList.toggle("pos-preview-above", room < POS_PREVIEW_ROOM);
}

// above-mode: a row too close to the top of the screen (under the fixed
// header) shows its card below it instead, so the card is never cut off
document.querySelectorAll(".option-list--position .view-link").forEach((link) => {
  link.addEventListener("mouseenter", () => {
    if (!frame.classList.contains("pos-preview-above")) return;
    const row = link.closest(".opt-row");
    const card = row.querySelector(".pos-overlay");
    const headerBottom = document.getElementById("hd").getBoundingClientRect().bottom;
    const need = card.offsetHeight + 12;
    row.classList.toggle("pos-preview-below", row.getBoundingClientRect().top - headerBottom < need);
  });
});

window.addEventListener("resize", fitFrame);
fluidLayout.addEventListener("change", fitFrame);
phoneLayout.addEventListener("change", fitFrame);
if (document.fonts) document.fonts.ready.then(fitFrame);

/* ---------- accordion ---------- */
const steps = [...document.querySelectorAll(".step")];

function openStep(name) {
  // leaving step 5 with colours still undivided flags it (validatePerColor)
  if (state.open === "percolor" && name !== "percolor") validatePerColor(true);
  // same for step 3 with a print position still lacking its colours
  if (state.open === "printing" && name !== "printing") validatePerPosition(true);
  // same for step 4 with a custom quantity under the minimum
  if (state.open === "quantity" && name !== "quantity") validateCustomQty();
  state.open = name;
  steps.forEach((s) => {
    s.dataset.open = String(s.dataset.step === name);
  });
}

steps.forEach((step) => {
  step.querySelector(".step-header").addEventListener("click", () => {
    openStep(step.dataset.open === "true" ? null : step.dataset.step);
  });
});

/* ---------- selected-value labels in collapsed headers ---------- */
function setValue(stepName, label) {
  state.labels[stepName] = label;
  const el = document.querySelector(`[data-value-for="${stepName}"]`);
  el.textContent = label || "";
  el.classList.toggle("filled", Boolean(label));
  // a step flagged by Add to cart as "still to choose" clears once chosen
  const step = el.closest(".step");
  if (label && step.classList.contains("is-missing")) setStepMissing(step, false);
  // every step 3 change passes here: its print option may carry a minimum
  // order quantity for step 4
  if (stepName === "printing") applyQtyMinimum();
}

// step 4's collapsed header carries the unit price too (527:11603), written
// in the "£6.01 p.p" form the tier rows use; call after state.price is set
function setQuantityValue(qty) {
  setValue("quantity", `${qty} pieces`);
  const price = document.getElementById("quantity-price");
  price.textContent = `£${state.price.toFixed(2)} p.p`;
  price.classList.add("filled");
}

/* After the configurator auto-opens the next step, keep the user oriented
   (user): once the accordion has finished moving (0.3s), scroll so the step
   they just finished sits, closed, at the top just below the compact header,
   with the newly opened step directly underneath it. styles.css gives .step
   a scroll-margin-top for the header. The header is held compact during the
   scroll, since scrolling up would otherwise expand it over the steps. */
const STEP_MOTION_MS = 320;
let revealTimer;
function revealStep(step, finished) {
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    if (step.dataset.open !== "true") return;
    const hd = document.getElementById("hd");
    // the header is compact while scrolling down: only its main bar remains
    const top = hd.querySelector(".bar").getBoundingClientRect().height;
    document.documentElement.style.setProperty("--hd-compact-h", `${Math.round(top)}px`);
    const anchor = finished || step;
    // 12px of air under the header (in screen px, so the phone zoom can't skew it)
    const target = Math.max(0, Math.round(anchor.getBoundingClientRect().top + window.scrollY - top - 12));
    if (Math.abs(target - window.scrollY) < 2) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    holdCompactHeader(target > 0 ? 1600 : 0);
    window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
  }, STEP_MOTION_MS);
}

function advanceFrom(stepName) {
  // step 5 is only in the flow while multi-colour is on, so walk past any
  // step that is currently hidden rather than opening an invisible card
  for (let i = STEPS.indexOf(stepName) + 1; i < STEPS.length; i++) {
    const el = document.querySelector(`.step[data-step="${STEPS[i]}"]`);
    if (el && !el.hidden) {
      openStep(STEPS[i]);
      revealStep(el, document.querySelector(`.step[data-step="${stepName}"]`));
      return;
    }
  }
  // nothing further to open (step 4 without step 5, or step 5 itself): the
  // section is complete, so fold it away rather than leave it hanging open,
  // and bring the whole summary into view
  openStep(null);
  showConfigSummary();
}

/* Configuration complete: once every step has folded shut, scroll so the
   title sits 16px under the compact header — title, photo and the collapsed
   configurator with price and Add to cart all in view. (The breadcrumbs
   are hidden while the header is compact, so they aren't aimed for.)
   On phones (user) the view starts at step 1 instead, 12px under the
   header, so all closed steps and the total price below them are in view.
   The header stays compact during this upward scroll (it would otherwise
   expand on scrolling up). */
function showConfigSummary() {
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    const hd = document.getElementById("hd");
    const compactH = hd.querySelector(".bar").getBoundingClientRect().height;
    const anchor = fluidLayout.matches
      ? document.querySelector(".step:not([hidden])")
      : document.querySelector(".main-grid");
    const gap = fluidLayout.matches ? 12 : 16;
    const target = Math.max(0, Math.round(anchor.getBoundingClientRect().top + window.scrollY - compactH - gap));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    holdCompactHeader(target > 0 ? 1600 : 0);
    window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
  }, STEP_MOTION_MS);
}

/* ---------- step 1: colour swatches ---------- */
const swatchGrid = document.getElementById("swatch-grid");
/* the photo follows the colour: main image, the "colour" thumbnail and the
   print-position previews all switch to the picked colour's photo */
function showColour(swatch) {
  const src = `assets/product/${swatch.dataset.colour}.jpg`;
  const img = document.getElementById("product-image");
  img.src = src;
  img.srcset = `${src} 500w`;
  img.alt = `Thermos bottle, stainless steel, 500 ml, ${swatch.dataset.name.toLowerCase()}`;
  document.querySelector('.thumb[data-view="colour"] img').src = src;
  document.querySelectorAll(".pos-shot-img").forEach((el) => (el.src = src));
  // back to the colour view if another view (front, lid, box) was showing
  // (on phones the carousel returns to its first slide too)
  gallery.show(0, { syncTrack: true });
}
// the name under a tile picks it too
swatchGrid.querySelectorAll(".swatch-name").forEach((name) =>
  name.addEventListener("click", () => name.previousElementSibling.click())
);

swatchGrid.addEventListener("click", (e) => {
  const swatch = e.target.closest(".swatch");
  if (!swatch) return;
  if (!state.multi.color || !swatch.classList.contains("selected")) showColour(swatch);

  if (state.multi.color) {
    swatch.classList.toggle("selected");
    const names = [...swatchGrid.querySelectorAll(".swatch.selected")].map((s) => s.dataset.name);
    setValue("color", names.join(", "));
    renderPerColor();
    return;
  }

  swatchGrid.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
  swatch.classList.add("selected");
  setValue("color", swatch.dataset.name);
  renderPerColor();
  advanceFrom("color");
});

/* ---------- steps 2 & 3: option rows ---------- */
document.querySelectorAll(".step").forEach((step) => {
  const name = step.dataset.step;
  if (name !== "position" && name !== "printing") return;

  step.querySelectorAll(".opt-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (state.multi[name]) {
        row.classList.toggle("selected");
        const picked = [...step.querySelectorAll(".opt-row.selected")].filter((r) => !r.closest(".per-position")).map((r) => r.dataset.name);
        setValue(name, picked.join(", "));
        if (name === "position") renderPerPosition();
        return;
      }
      step.querySelectorAll(".opt-row").forEach((r) => r.classList.remove("selected"));
      row.classList.add("selected");
      setValue(name, row.dataset.name);
      if (name === "position") renderPerPosition();
      advanceFrom(name);
    });
  });
});

/* ---------- print position overlay (786:17216) ------------------------------
   Desktop opens it on hovering "view" (CSS). Below 1630px "view" is tapped
   instead: that opens the overlay without selecting the row, and the X, a tap
   anywhere else or Escape closes it. */
const posOverlays = document.querySelectorAll(".pos-overlay");
const closeOverlays = () => {
  posOverlays.forEach((o) => o.classList.remove("open"));
  document.body.classList.remove("pos-overlay-open");
};

/* Desktop: clicking "view" opens the preview full screen (lightbox) over a
   translucent black backdrop, without selecting the row. The X, a click on
   the backdrop or Escape closes it and returns focus to the row. */
const posLightbox = document.getElementById("pos-lightbox");
const posLightboxShot = posLightbox.querySelector(".pos-lightbox-shot");
const posLightboxClose = posLightbox.querySelector(".pos-lightbox-close");
let posLightboxReturn = null;

function openPosLightbox(row) {
  posLightboxShot.replaceChildren(row.querySelector(".pos-shot").cloneNode(true));
  posLightbox.setAttribute("aria-label", `Print position preview: ${row.dataset.name}`);
  posLightboxReturn = row;
  posLightbox.hidden = false;
  document.body.classList.add("pos-lightbox-open");
  void posLightbox.offsetWidth; // commit opacity 0 so the fade-in runs
  posLightbox.classList.add("open");
  posLightboxClose.focus();
}
function closePosLightbox() {
  if (posLightbox.hidden) return;
  posLightbox.classList.remove("open");
  document.body.classList.remove("pos-lightbox-open");
  posLightbox.hidden = true;
  if (posLightboxReturn) posLightboxReturn.focus();
  posLightboxReturn = null;
}
posLightbox.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!e.target.closest(".pos-lightbox-card") || e.target.closest(".pos-lightbox-close"))
    closePosLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePosLightbox();
});

// every width (user): "view" opens the full-screen preview with the dark
// backdrop over the whole page, header and buy bar included
document.querySelectorAll(".option-list--position .view-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.stopPropagation();
    openPosLightbox(link.closest(".opt-row"));
  });
});
posOverlays.forEach((overlay) => {
  // taps inside the card must not reach the row (which would select it)
  overlay.addEventListener("click", (e) => e.stopPropagation());
  const close = overlay.querySelector(".pos-overlay-close");
  close.addEventListener("click", closeOverlays);
  close.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      closeOverlays();
    }
  });
});
document.addEventListener("click", closeOverlays);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeOverlays();
});

/* ---------- step 4: quantity tiers ---------- */
const qtyList = document.getElementById("quantity-list");
qtyList.addEventListener("click", (e) => {
  const row = e.target.closest(".qty-row:not(.qty-row--custom)");
  if (!row) return;
  // under the chosen print option's minimum: not selectable (applyQtyMinimum)
  if (row.classList.contains("is-below-min")) return;
  qtyList.querySelectorAll(".qty-row").forEach((r) => r.classList.remove("selected"));
  row.classList.add("selected");
  // picking a tier abandons the invalid custom entry
  if (customRow.classList.contains("is-invalid")) document.getElementById("qty-custom").value = 0;
  setCustomQtyError(false);
  state.quantity = Number(row.dataset.qty);
  state.price = Number(row.dataset.price);
  setQuantityValue(state.quantity);
  updatePerColor();
  updatePrice();
  // hand over to step 5, or just close when step 5 is not in play
  advanceFrom("quantity");
});

// Custom quantity row — ON_CLICK -> CHANGE_TO Variant4, Animation: Instant
const customRow = document.querySelector(".qty-row--custom");
customRow.addEventListener("click", () => {
  qtyList.querySelectorAll(".qty-row").forEach((r) => r.classList.remove("selected"));
  customRow.classList.add("selected");
});

// Error state for a custom quantity under the 25-piece minimum. Only raised on
// commit (Enter / leaving the field) so it never flashes mid-typing; 0 or an
// empty field counts as "not entered" rather than an error. Once raised, it
// clears live as soon as the value becomes valid again.
const MIN_QTY = 25;
const qtyMinNote = document.getElementById("qty-min-note");
const qtyMinNoteText = qtyMinNote.textContent.trim();
const quantityStep = document.querySelector('.step[data-step="quantity"]');

/* Print options with a minimum order quantity (step 3 rows with data-moq)
   raise step 4's minimum while they are selected; the highest one counts.
   qtyMin / qtyMinFor hold the current minimum and the option that sets it
   ("" = just the general 25-piece minimum). */
let qtyMin = MIN_QTY;
let qtyMinFor = "";

function printMinimum() {
  // the active list(s): per-position copies, or the single list
  const rows = printingStep.classList.contains("is-per-position")
    ? perPositionList.querySelectorAll(".opt-row.selected[data-moq]")
    : printingOptions.querySelectorAll(".opt-row.selected[data-moq]");
  let best = { qty: 0, name: "" };
  rows.forEach((r) => {
    if (Number(r.dataset.moq) > best.qty) best = { qty: Number(r.dataset.moq), name: r.dataset.name };
  });
  return best;
}

// call after any step 3 change: re-reads the minimum, greys out the tiers
// under it and flags step 4 when the quantity already chosen is too low
function applyQtyMinimum() {
  const print = printMinimum();
  qtyMin = Math.max(MIN_QTY, print.qty);
  qtyMinFor = print.qty > MIN_QTY ? print.name : "";
  qtyList.querySelectorAll(".qty-row[data-qty]").forEach((r) => {
    const below = Number(r.dataset.qty) < qtyMin;
    r.classList.toggle("is-below-min", below);
    r.setAttribute("aria-disabled", String(below));
  });
  customInput.min = String(qtyMin);
  const moqNote = document.getElementById("qty-moq-note");
  moqNote.hidden = !qtyMinFor;
  moqNote.textContent = qtyMinFor
    ? `${qtyMinFor} printing has a minimum order quantity of ${qtyMin} pieces`
    : "";
  validateCustomQty();
}

// the chosen quantity is under the minimum: a committed custom entry, or a
// tier picked before a print option raised the minimum
function qtyBelowMin() {
  if (customRow.classList.contains("selected")) {
    const qty = Number(customInput.value) || 0;
    return qty > 0 && qty < qtyMin;
  }
  return state.quantity < qtyMin;
}

function setCustomQtyError(on) {
  customRow.classList.toggle("is-invalid", on && customRow.classList.contains("selected"));
  // the step mirrors step 5's error state (red number); collapsed, its header
  // swaps the quantity + price for the error
  quantityStep.classList.toggle("is-invalid", on);
  quantityStep.querySelector(".step-error").textContent = on
    ? `Minimum ${qtyMin} pieces`
    : "";
  qtyMinNote.classList.toggle("is-error", on);
  document.getElementById("qty-custom").setAttribute("aria-invalid", String(on));
  qtyMinNote.textContent = on
    ? qtyMinFor
      ? `${qtyMinFor} printing needs at least ${qtyMin} pieces — choose a larger quantity`
      : `Please enter at least ${MIN_QTY} pieces — the minimum order quantity`
    : qtyMinFor
      ? `Minimum order quantity is at least ${qtyMin} pieces`
      : qtyMinNoteText;
}
function validateCustomQty() {
  setCustomQtyError(qtyBelowMin());
}

document.getElementById("qty-custom").addEventListener("input", (e) => {
  const qty = Math.max(0, Number(e.target.value) || 0);
  if (customRow.classList.contains("is-invalid") && (qty === 0 || qty >= qtyMin))
    setCustomQtyError(false);
  if (qty < qtyMin) return;
  qtyList.querySelectorAll(".qty-row").forEach((r) => r.classList.remove("selected"));
  e.target.closest(".qty-row--custom").classList.add("selected");
  state.quantity = qty;
  // nearest tier price
  const tiers = [...qtyList.querySelectorAll(".qty-row[data-qty]")]
    .map((r) => ({ qty: Number(r.dataset.qty), price: Number(r.dataset.price) }))
    .sort((a, b) => a.qty - b.qty);
  const tier = tiers.filter((t) => t.qty <= qty).pop() || tiers[0];
  state.price = tier.price;
  setQuantityValue(qty);
  updatePerColor();
  updatePrice();
});

// A typed quantity only counts as chosen once it is committed — Enter, or
// leaving the field — so the step never folds away mid-number or on a spinner
// click. If focus is moving to another button (a tier, a step header), that
// button's own click decides what opens, so don't pre-empt it here.
const customInput = document.getElementById("qty-custom");
customInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") customInput.blur();
});
customInput.addEventListener("focusout", (e) => {
  validateCustomQty();
  if (Number(customInput.value) < qtyMin) return;
  if (e.relatedTarget && e.relatedTarget.closest("button")) return;
  advanceFrom("quantity");
});

// Quantity fields (custom quantity, step 5 per colour) show 0 at rest. On
// focus the 0 is cleared so the number can be typed straight away; a field
// left empty shows 0 again. The first typed character also replaces a lone
// 0, for a field that already had focus.
const ZERO_FIELDS = ".qty-custom-input, .per-color-input";
document.addEventListener("focusin", (e) => {
  if (e.target.matches?.(ZERO_FIELDS) && Number(e.target.value) === 0) e.target.value = "";
});
document.addEventListener("beforeinput", (e) => {
  if (e.target.matches?.(ZERO_FIELDS) && e.inputType.startsWith("insert") && e.target.value === "0")
    e.target.value = "";
});
document.addEventListener("focusout", (e) => {
  if (e.target.matches?.(ZERO_FIELDS) && e.target.value.trim() === "") e.target.value = "0";
});

/* ---------- multi-select checkboxes ---------- */
document.querySelectorAll(".checkbox").forEach((box) => {
  box.addEventListener("click", () => {
    const key = box.dataset.multi;
    state.multi[key] = !state.multi[key];
    box.classList.toggle("checked", state.multi[key]);
    if (key === "color") renderPerColor();
    if (key === "position") renderPerPosition();
  });
  // the text next to the box toggles it too, like a <label>
  const label = box.parentElement.querySelector(".multi-label");
  if (label) label.addEventListener("click", () => box.click());
});

/* ---------- step 5: quantity per colour (529:12566) -------------------------
   Present only while step 1 is in multi-colour mode with at least one swatch
   picked. The fields are rebuilt from the live selection on every change, and
   a count already typed survives as long as its colour is still selected. */
const perColorStep = document.querySelector(".step--per-color");
const perColorGrid = document.getElementById("per-color-grid");
const perColorHint = document.getElementById("per-color-hint");
const perColor = new Map(); // colour name -> count
let perColorDoneTimer;

function renderPerColor() {
  const names = [...swatchGrid.querySelectorAll(".swatch.selected")].map((s) => s.dataset.name);
  const show = state.multi.color && names.length > 0;
  perColorStep.hidden = !show;

  if (!show) {
    perColor.clear();
    validatePerColor(false);
    if (state.open === "percolor") openStep(null);
    setValue("percolor", null);
    return;
  }

  // forget counts for colours that have since been deselected
  [...perColor.keys()].forEach((n) => {
    if (!names.includes(n)) perColor.delete(n);
  });

  perColorGrid.innerHTML = "";
  for (const name of names) {
    if (!perColor.has(name)) perColor.set(name, 0);
    const field = document.createElement("div");
    field.className = "per-color-field";
    const label = document.createElement("span");
    label.className = "per-color-name";
    label.textContent = name;
    const input = document.createElement("input");
    input.className = "per-color-input";
    input.type = "number";
    input.min = "0";
    input.value = String(perColor.get(name));
    input.dataset.color = name;
    field.append(label, input);
    perColorGrid.append(field);
  }
  updatePerColor();
}

function updatePerColor() {
  clearTimeout(perColorDoneTimer);
  if (perColorStep.hidden) return;
  const divided = [...perColor.values()].reduce((a, b) => a + b, 0);
  const left = state.quantity - divided;
  const items = (n) => (n === 1 ? "item" : "items");

  // Only the "still need to divide" sentence is specified in the file
  // (687:15186); the balanced and over-divided wordings are placeholders.
  if (left > 0) {
    perColorHint.innerHTML = `You still need to divide <b>${left}</b> ${items(left)}`;
  } else if (left === 0) {
    perColorHint.innerHTML = `All <b>${state.quantity}</b> ${items(state.quantity)} divided`;
  } else {
    perColorHint.innerHTML = `That is <b>${-left}</b> ${items(-left)} too many`;
  }

  const filled = [...perColor.entries()].filter(([, n]) => n > 0);
  // "Matte grey: 6   Dark grey: 94" at every width, laid out like step 3's
  // per-position recap (user); too long for the header: cut off with …
  setValue("percolor", filled.length ? filled.map(([n, v]) => `${n}: ${v}`).join(", ") : null);
  document.querySelector('[data-value-for="percolor"]').replaceChildren(
    ...filled.map(([n, v]) => {
      const span = document.createElement("span");
      span.className = "per-color-value";
      span.textContent = `${n}: ${v}`;
      return span;
    })
  );

  // once flagged, the error tracks every edit and clears as soon as it's fixed
  if (perColorStep.classList.contains("is-invalid")) validatePerColor(true);

  // every item is placed: hold the "All N items divided" line for a beat so it
  // registers, then close the section. Any further edit clears the timer above.
  // A colour still at 0 keeps it open — closing would only raise the error.
  if (left === 0 && !perColorProblem() && state.open === "percolor") {
    perColorDoneTimer = setTimeout(() => {
      if (state.open === "percolor") advanceFrom("percolor");
    }, 600);
  }
}

/* Step 5 error state — raised when the shopper moves on (another step opens,
   step 5 is collapsed, or Add to cart is pressed) while items are still left
   to divide, too many are divided, or a picked colour has no quantity. The
   step number turns red, the collapsed header says what's wrong, every
   colour input still at 0 gets a red border, and the running total turns
   into a red ⚠ message. */
function perColorProblem() {
  if (perColorStep.hidden) return null;
  const divided = [...perColor.values()].reduce((a, b) => a + b, 0);
  const left = state.quantity - divided;
  const empty = [...perColor.entries()].filter(([, n]) => n === 0).map(([n]) => n);
  if (left > 0) return { left, empty, header: `${left} still to divide` };
  if (left < 0) return { left, empty, header: `${-left} too many divided` };
  if (empty.length) return { left, empty, header: `No quantity for ${empty.join(", ")}` };
  return null;
}

function validatePerColor(show) {
  const problem = perColorProblem();
  const on = Boolean(show && problem);
  perColorStep.classList.toggle("is-invalid", on);
  perColorGrid.querySelectorAll(".per-color-field").forEach((field) => {
    const input = field.querySelector(".per-color-input");
    const bad = on && problem.empty.includes(input.dataset.color);
    field.classList.toggle("is-invalid", bad);
    input.setAttribute("aria-invalid", String(bad));
  });
  perColorHint.classList.toggle("is-error", on);
  if (on && problem.left === 0) {
    // everything is divided, but some colour got nothing
    perColorHint.textContent = `Add a quantity for ${problem.empty.join(", ")} or deselect it`;
  }
  const errorEl = perColorStep.querySelector(".step-error");
  errorEl.textContent = on ? problem.header : "";
  return !problem;
}

/* Add to cart (desktop button + mobile buy-bar button). Walks the steps in
   order and stops at the first one that isn't done: that step opens, scrolls
   into view and gets the same error state as the others (red number + ⚠
   message in its header). With everything chosen it confirms with a toast —
   this prototype has no real cart. */
const REQUIRED_MESSAGE = {
  color: "Choose a colour",
  position: "Choose a print position",
  printing: "Choose the print colours",
};

function setStepMissing(step, on, message = "") {
  step.classList.toggle("is-missing", on);
  step.classList.toggle("is-invalid", on);
  step.querySelector(".step-error").textContent = on ? message : "";
}

function firstUnfinishedStep() {
  for (const name of ["color", "position", "printing"]) {
    if (!state.labels[name]) {
      const step = document.querySelector(`.step[data-step="${name}"]`);
      setStepMissing(step, true, REQUIRED_MESSAGE[name]);
      return step;
    }
  }
  if (!validatePerPosition(true)) return printingStep;
  validateCustomQty();
  if (quantityStep.classList.contains("is-invalid")) return quantityStep;
  if (!validatePerColor(true)) return perColorStep;
  return null;
}

document.querySelectorAll(".add-to-cart, .m-btn-cart").forEach((btn) =>
  btn.addEventListener("click", () => {
    const step = firstUnfinishedStep();
    if (step) {
      openStep(step.dataset.step);
      step.scrollIntoView({ behavior: "smooth", block: "center" });
      const msg = step.querySelector(".step-error").textContent || "Finish this step";
      showToast(`Almost there: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}.`, "warn");
      return;
    }
    showToast(`Added to cart: ${state.quantity} × Thermos bottle, ${money(state.quantity * state.price)} excl. VAT.`);
  })
);

/* small confirmation bar at the bottom of the screen; replaces itself */
const toast = document.getElementById("toast");
let toastTimer;
function showToast(text, kind = "ok") {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.dataset.kind = kind;
  toast.hidden = false;
  void toast.offsetWidth;
  toast.classList.add("show");
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toastTimer = setTimeout(() => (toast.hidden = true), 300);
  }, 4000);
}

perColorGrid.addEventListener("input", (e) => {
  const input = e.target.closest(".per-color-input");
  if (!input) return;
  perColor.set(input.dataset.color, Math.max(0, Number(input.value) || 0));
  updatePerColor();
});

/* ---------- step 3 per-position mode (1884:9849) ---------------------------
   While step 2 is in multi-select mode with two or more positions picked,
   step 3 becomes "Colours per print position": its single option list is
   swapped for one heading + a copy of that list per position, so rows, icons
   and circle artwork stay identical. A choice already made survives as long
   as its position is still selected. */
const printingStep = document.querySelector('.step[data-step="printing"]');
const printingTitle = printingStep.querySelector(".step-title");
const PRINTING_TITLE = printingTitle.textContent;
const printingOptions = printingStep.querySelector(".printing-group .option-list--printing");
const perPositionList = document.getElementById("per-position");
const perPosition = new Map(); // position name -> chosen printing option
// print area per position; only Front and Back are given in the file (30x70mm)
// (Lid and Full wrap are estimates from the preview areas — placeholders)
const POSITION_SIZE = { Front: "30×70 mm", Back: "30×70 mm", Lid: "30×25 mm", "Full wrap": "220×100 mm" };

function renderPerPosition() {
  const positionStep = document.querySelector('.step[data-step="position"]');
  const names = [...positionStep.querySelectorAll(".opt-row.selected")].map((r) => r.dataset.name);
  const on = state.multi.position && names.length > 1;
  const wasOn = printingStep.classList.contains("is-per-position");
  printingStep.classList.toggle("is-per-position", on);
  perPositionList.hidden = !on;
  printingTitle.textContent = on ? "Colours per print position" : PRINTING_TITLE;

  if (!on) {
    perPositionList.replaceChildren();
    validatePerPosition(false);
    // back to the single list: its own selection (if any) is the value again
    if (wasOn) {
      const picked = [...printingOptions.querySelectorAll(".opt-row.selected")].map((r) => r.dataset.name);
      setValue("printing", picked.length ? picked.join(", ") : null);
    }
    return;
  }

  [...perPosition.keys()].forEach((n) => {
    if (!names.includes(n)) perPosition.delete(n);
  });

  perPositionList.replaceChildren();
  for (const name of names) {
    const heading = document.createElement("div");
    heading.className = "per-position-heading";
    const title = document.createElement("p");
    title.className = "per-position-title";
    title.textContent = POSITION_SIZE[name] ? `${name} (${POSITION_SIZE[name]})` : name;
    const sub = document.createElement("p");
    sub.className = "per-position-sub";
    sub.textContent = "Amount of colours in your design.";
    heading.append(title, sub);

    const list = printingOptions.cloneNode(true);
    list.dataset.position = name;
    list.querySelectorAll(".opt-row").forEach((r) => {
      r.classList.toggle("selected", r.dataset.name === perPosition.get(name));
    });
    perPositionList.append(heading, list);
  }
  updatePerPosition();
  // positions added/removed while flagged: re-mark (or clear) the error
  if (printingStep.classList.contains("is-invalid")) validatePerPosition(true);
}

function updatePerPosition() {
  const chosen = [...perPosition.entries()];
  setValue("printing", chosen.length ? chosen.map(([n, v]) => `${n}: ${v}`).join(", ") : null);
  const valueEl = document.querySelector('[data-value-for="printing"]');
  valueEl.replaceChildren(
    ...chosen.map(([n, v]) => {
      const span = document.createElement("span");
      span.className = "per-position-value";
      span.textContent = `${n}: ${v}`;
      return span;
    })
  );
}

/* Step 3 error state (per-position mode) — raised when the shopper moves on
   (another step opens, step 3 is collapsed, or Add to cart is pressed) while a
   print position has no colour option picked. Same look as steps 4 and 5:
   red step number, the collapsed header names the missing positions, and a
   ⚠ message line sits above each missing position's options. */
function missingPositions() {
  if (!printingStep.classList.contains("is-per-position")) return [];
  return [...perPositionList.querySelectorAll(".option-list")]
    .map((l) => l.dataset.position)
    .filter((n) => !perPosition.has(n));
}

function validatePerPosition(show) {
  const missing = missingPositions();
  const on = Boolean(show && missing.length);
  printingStep.classList.toggle("is-invalid", on);
  perPositionList.querySelectorAll(".field-error").forEach((p) => p.remove());
  perPositionList.querySelectorAll(".option-list").forEach((list) => {
    const name = list.dataset.position;
    const bad = on && missing.includes(name);
    list.previousElementSibling.classList.toggle("is-invalid", bad);
    if (bad) {
      const msg = document.createElement("p");
      msg.className = "field-error";
      msg.setAttribute("role", "alert");
      msg.textContent = `Choose the amount of colours for ${name}`;
      list.before(msg);
    }
  });
  printingStep.querySelector(".step-error").textContent = on
    ? `Missing: ${missing.join(", ")}` // short, so mobile's narrow header shows the names
    : "";
  return !missing.length;
}

perPositionList.addEventListener("click", (e) => {
  const row = e.target.closest(".opt-row");
  if (!row) return;
  const list = row.closest(".option-list");
  list.querySelectorAll(".opt-row").forEach((r) => r.classList.remove("selected"));
  row.classList.add("selected");
  perPosition.set(list.dataset.position, row.dataset.name);
  updatePerPosition();
  if (printingStep.classList.contains("is-invalid")) validatePerPosition(true);
  // every position has its colours: step 3 is done, move on
  if (perPosition.size === perPositionList.querySelectorAll(".option-list").length) {
    advanceFrom("printing");
  }
});

/* ---------- price block ---------- */
const money = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function updatePrice() {
  const { quantity, price } = state;
  const discount = Math.round((1 - price / BASE_PRICE) * 100);
  document.getElementById("discount-badge").textContent = `-${discount}%`;
  document.getElementById("price-old").textContent = BASE_PRICE.toFixed(2);
  document.getElementById("price-new").textContent = money(price);
  document.getElementById("total-old").textContent = (quantity * BASE_PRICE).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  document.getElementById("total-new").textContent = money(quantity * price);

  // mobile / tablet buy bar mirrors the per-piece price
  document.querySelectorAll('[data-price="discount"]').forEach((el) => (el.textContent = `-${discount}%`));
  document.querySelectorAll('[data-price="old"]').forEach((el) => (el.textContent = BASE_PRICE.toFixed(2)));
  document.querySelectorAll('[data-price="new"]').forEach((el) => (el.textContent = money(price)));
  updatePriceDetails();
}

/* "View price details" (desktop price block + mobile buy bar): a breakdown
   built from the same numbers as the price block — nothing new invented. */
const VAT_RATE = 0.21;
function updatePriceDetails() {
  const { quantity, price } = state;
  const subtotal = quantity * price;
  const saving = quantity * (BASE_PRICE - price);
  const vat = subtotal * VAT_RATE;
  const rows = [
    [`List price (${quantity} × ${money(BASE_PRICE)})`, money(quantity * BASE_PRICE)],
    ["Volume discount", saving > 0 ? `− ${money(saving)}` : money(0)],
    ["Total excl. VAT", money(subtotal)],
    ["VAT 21%", money(vat)],
    ["Total incl. VAT", money(subtotal + vat)],
  ];
  document.querySelectorAll(".price-details").forEach((dl) => {
    dl.innerHTML = rows
      .map(([k, v], i) => `<div class="pd-row${i === rows.length - 1 ? " pd-row--total" : ""}"><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
  });
}
document.querySelectorAll(".price-details-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open
      ? btn.dataset.openText || "Hide price details"
      : btn.dataset.closedText || "View price details";
  });
});

/* ---------- product photo gallery ----------
   The four real views of this article: the bottle in the chosen colour, the
   front, the lid off, and the gift box. Built on common gallery practice:
   - desktop / tablet: thumbnails, arrows on the photo (always visible, 44px),
     a "2 / 9" counter, ← / → while the gallery has focus, swipe on touch
     screens; the thumbnail strip scrolls to keep the active one in view.
     The views loop.
   - phones: the swipe carousel with dots (the first photo is the main one),
     now holding all four views.
   - everywhere: a click / tap on a photo opens it full screen (lightbox) with
     the same arrows, keys, swipe and thumbnails; the X, Escape or the
     backdrop closes it, focus returns to where it was, and the gallery
     behind follows the photo the viewer ended on.
   - screen readers hear "Photo 2 of 4: Front view" on each change. */
const gallery = (() => {
  const slider = document.querySelector(".image-slider");
  const mainImage = document.getElementById("product-image");
  const container = slider.querySelector(".product-image-container");
  const thumbs = [...slider.querySelectorAll(".thumb")];
  const counter = container.querySelector(".gal-count");
  const status = document.getElementById("gal-status");
  const track = document.getElementById("gallery-track");
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const views = () =>
    thumbs.map((t) => ({ src: t.querySelector("img").getAttribute("src"), label: t.getAttribute("aria-label") }));
  let index = 0;

  // scroll a thumbnail's strip sideways just enough to show it whole (never
  // moves the page); `fade` keeps it clear of a fade on the right edge
  // `fade` keeps it clear of the edge fades / arrows (not needed for the
  // first and last item, which scroll fully to the edge)
  function keepInView(el, fade = 0) {
    const strip = el.parentElement;
    const items = strip.querySelectorAll("button");
    const fadeL = el === items[0] ? 0 : fade;
    const fadeR = el === items[items.length - 1] ? 0 : fade;
    const cs = getComputedStyle(strip);
    const s = strip.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // screen px → CSS px (phones zoom the page body)
    const z = s.width / strip.offsetWidth || 1;
    const minX = s.left + (parseFloat(cs.paddingLeft) + fadeL) * z;
    const maxX = s.right - (parseFloat(cs.paddingRight) + fadeR) * z;
    const by = r.left < minX ? (r.left - minX) / z : r.right > maxX ? (r.right - maxX) / z : 0;
    if (by) strip.scrollBy({ left: by, behavior: reduce() ? "instant" : "smooth" });
  }

  /* thumbnail strip: scroll arrows + edge fades, each side shown only while
     there are more thumbnails beyond it; an arrow scrolls one strip-width
     (less one thumbnail, so the last one seen stays as an anchor) */
  const thumbStrip = thumbs[0].parentElement;
  const thumbBox = thumbStrip.parentElement;
  const scrollPrev = thumbBox.querySelector(".thumb-scroll--prev");
  const scrollNext = thumbBox.querySelector(".thumb-scroll--next");
  function syncStrip() {
    const max = thumbStrip.scrollWidth - thumbStrip.clientWidth;
    const canPrev = thumbStrip.scrollLeft > 2;
    const canNext = thumbStrip.scrollLeft < max - 2;
    // an arrow that disappears while focused hands focus to the other one
    const lost = (!canPrev && document.activeElement === scrollPrev) || (!canNext && document.activeElement === scrollNext);
    thumbBox.classList.toggle("can-prev", canPrev);
    thumbBox.classList.toggle("can-next", canNext);
    scrollPrev.hidden = !canPrev;
    scrollNext.hidden = !canNext;
    if (lost) (canPrev ? scrollPrev : canNext ? scrollNext : thumbs[index]).focus();
  }
  const page = (dir) =>
    thumbStrip.scrollBy({
      left: dir * Math.max(thumbs[0].offsetWidth, thumbStrip.clientWidth - thumbs[0].offsetWidth - 8),
      behavior: reduce() ? "instant" : "smooth",
    });
  scrollPrev.addEventListener("click", () => page(-1));
  scrollNext.addEventListener("click", () => page(1));
  thumbStrip.addEventListener("scroll", syncStrip, { passive: true });
  new ResizeObserver(syncStrip).observe(thumbStrip);

  // neighbours load in the background so the next arrow press is instant
  const preload = (i) => {
    const v = views();
    [i - 1, i + 1].forEach((j) => (new Image().src = v[(j + v.length) % v.length].src));
  };

  function show(i, { syncTrack = false } = {}) {
    const v = views();
    index = (i + v.length) % v.length;
    thumbs.forEach((t, j) => {
      t.classList.toggle("active", j === index);
      if (j === index) t.setAttribute("aria-current", "true");
      else t.removeAttribute("aria-current");
    });
    keepInView(thumbs[index], 71); // clear of the strip's right-edge fade
    // phones: the main photo is carousel slide 1 and always the colour view
    const shown = fluidLayout.matches ? 0 : index;
    mainImage.src = v[shown].src;
    mainImage.srcset = `${v[shown].src} 500w`;
    counter.textContent = `${index + 1} / ${v.length}`;
    status.textContent = `Photo ${index + 1} of ${v.length}: ${v[index].label}`;
    // phones: bring the matching slide into view (main photo = slide 1)
    if (syncTrack && fluidLayout.matches) {
      const slide = index === 0 ? container : track.querySelectorAll(".m-slide--photo")[index - 1];
      if (slide)
        track.scrollTo({ left: slide.offsetLeft - track.firstElementChild.offsetLeft, behavior: "instant" });
    }
    preload(index);
  }

  // swipe left / right on an element (touch and pen; mouse keeps click)
  function onSwipe(el, step) {
    let x0 = null;
    let y0 = 0;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      x0 = e.clientX;
      y0 = e.clientY;
    });
    el.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        el.dataset.swiped = "1"; // swallow the click that follows
        step(dx < 0 ? 1 : -1);
      }
    });
    el.addEventListener("pointercancel", () => (x0 = null));
    el.addEventListener(
      "click",
      (e) => {
        if (el.dataset.swiped) {
          delete el.dataset.swiped;
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );
  }

  /* inline gallery */
  thumbs.forEach((t, i) => t.addEventListener("click", () => show(i)));
  container.querySelector(".gal-nav--prev").addEventListener("click", () => show(index - 1));
  container.querySelector(".gal-nav--next").addEventListener("click", () => show(index + 1));
  slider.addEventListener("keydown", (e) => {
    if (fluidLayout.matches || e.target.closest("input")) return;
    if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
    else return;
    e.preventDefault();
  });
  // touch screens at tablet size: swipe the main photo (phones scroll the track)
  onSwipe(container, (d) => {
    if (!fluidLayout.matches) show(index + d);
  });

  /* full-screen viewer
     The photos sit side by side in a track inside a clipping frame, like the
     page's own phone carousel: a swipe drags the track with the finger and,
     let go, it glides to the next / previous photo (or back). At the first and
     last photo it resists instead of looping. Arrows (desktop) and ← / → loop,
     jumping straight across when they wrap round. */
  const lb = document.getElementById("gal-lightbox");
  const frame = lb.querySelector(".gal-lb-frame");
  const lbTrack = lb.querySelector(".gal-lb-track");
  const lbLabel = lb.querySelector(".gal-lb-label");
  const lbCount = lb.querySelector(".gal-lb-count");
  const lbThumbs = lb.querySelector(".gal-lb-thumbs");
  const lbClose = lb.querySelector(".gal-lb-close");
  const SLIDE_MS = 320;
  let lbIndex = 0;
  let returnFocus = null;

  views().forEach(() => {
    const s = document.createElement("div");
    s.className = "gal-lb-slide";
    s.innerHTML = `<img class="gal-lb-img" width="500" height="500" alt="" draggable="false" decoding="async" />`;
    lbTrack.append(s);
  });
  const lbSlides = [...lbTrack.children];
  const curImg = () => lbSlides[lbIndex].querySelector("img");

  // the track's position: photo lbIndex in the frame, plus a finger offset
  function placeTrack(animate, dx = 0) {
    lbTrack.style.transition =
      animate && !reduce() ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : "none";
    lbTrack.style.transform = `translateX(calc(${-lbIndex * 100}% + ${dx}px))`;
  }

  function lbShow(i, { animate = true } = {}) {
    const v = views();
    resetZoom();
    const next = (i + v.length) % v.length;
    const wrapped = i < 0 || i >= v.length; // looping round: jump, don't slide past all
    lbIndex = next;
    lbSlides.forEach((s, j) => {
      const img = s.querySelector("img");
      if (img.getAttribute("src") !== v[j].src) img.src = v[j].src; // follows the chosen colour
      img.alt = v[j].label;
      s.setAttribute("aria-hidden", String(j !== lbIndex));
    });
    placeTrack(animate && !wrapped);
    lbLabel.textContent = v[lbIndex].label;
    lbCount.textContent = `${lbIndex + 1} / ${v.length}`;
    [...lbThumbs.children].forEach((b, j) => {
      b.classList.toggle("active", j === lbIndex);
      b.querySelector("img").src = v[j].src;
      if (j === lbIndex) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    if (!lb.hidden) keepInView(lbThumbs.children[lbIndex]);
    status.textContent = `Photo ${lbIndex + 1} of ${v.length}: ${v[lbIndex].label}`;
  }
  views().forEach((v, j) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gal-lb-thumb";
    b.setAttribute("aria-label", v.label);
    b.innerHTML = `<img src="${v.src}" width="500" height="500" alt="" />`;
    b.addEventListener("click", () => lbShow(j));
    lbThumbs.append(b);
  });

  function open(i) {
    returnFocus = document.activeElement;
    lbShow(i, { animate: false });
    lb.hidden = false;
    document.body.classList.add("gal-lightbox-open");
    void lb.offsetWidth; // commit opacity 0 so the fade-in runs
    lb.classList.add("open");
    keepInView(lbThumbs.children[lbIndex]); // the strip only has a size once shown
    lbClose.focus();
  }
  function close() {
    if (lb.hidden) return;
    resetZoom();
    lb.classList.remove("open");
    lb.hidden = true;
    document.body.classList.remove("gal-lightbox-open");
    show(lbIndex, { syncTrack: true }); // the page shows the photo they ended on
    if (returnFocus) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  slider.querySelectorAll(".gal-zoom").forEach((b) =>
    // desktop: the main photo opens whichever view it shows; phones: each
    // slide opens its own view (the main photo is slide 1)
    b.addEventListener("click", () =>
      open(b.dataset.index === "0" && !fluidLayout.matches ? index : Number(b.dataset.index))
    )
  );
  lb.querySelector(".gal-nav--prev").addEventListener("click", () => lbShow(lbIndex - 1));
  lb.querySelector(".gal-nav--next").addEventListener("click", () => lbShow(lbIndex + 1));
  lbClose.addEventListener("click", close);
  lb.addEventListener("click", (e) => {
    if (e.target === lb) close();
  });

  /* zoom + gestures on the viewer's photo. The frame fills all the room
     between the X and the caption / thumbnails, so a zoomed photo can use
     that whole area but never covers them.
     - pinch with two fingers zooms 1–3x around the fingers; a double tap or
       double click toggles 1x ↔ 2.5x on that spot; dragging pans while zoomed
     - not zoomed: the first ~8px of a drag decide its direction — sideways
       drags the track (photo to photo), down pulls the photo away to close
     Positions are in CSS px: phones zoom the page (fitPhone), so finger
     movement is divided by that zoom. */
  const MAX_ZOOM = 3;
  const TAP_ZOOM = 2.5;
  const pointers = new Map();
  let zs = 1; // scale
  let zx = 0; // pan, CSS px
  let zy = 0;
  let gesture = null;
  let lastTap = { t: 0, x: 0, y: 0 };
  const pageZoom = () => parseFloat(document.body.style.zoom) || 1;
  // a screen point → CSS px from the frame's centre
  function fromCentre(x, y) {
    const r = frame.getBoundingClientRect();
    return { x: (x - r.left - r.width / 2) / pageZoom(), y: (y - r.top - r.height / 2) / pageZoom() };
  }
  // the photo fills the frame "contain"-wise: its visible size inside it
  function contentSize() {
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    const img = curImg();
    const r = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    return W / H > r ? { W, H, w: H * r, h: H } : { W, H, w: W, h: W / r };
  }
  // pan only as far as the zoomed photo still covers the frame
  function clampPan() {
    const { W, H, w, h } = contentSize();
    const mx = Math.max(0, (w * zs - W) / 2);
    const my = Math.max(0, (h * zs - H) / 2);
    zx = Math.min(mx, Math.max(-mx, zx));
    zy = Math.min(my, Math.max(-my, zy));
  }
  function applyZoom(animate) {
    const img = curImg();
    img.style.transition = animate && !reduce() ? "transform 0.25s ease" : "none";
    img.style.transform = zs === 1 && !zx && !zy ? "" : `translate(${zx}px, ${zy}px) scale(${zs})`;
    frame.classList.toggle("is-zoomed", zs > 1);
  }
  function resetZoom(animate = false) {
    zs = 1;
    zx = 0;
    zy = 0;
    applyZoom(animate);
    lb.style.opacity = "";
  }
  // zoom to scale s keeping the point p (from centre) where it is on screen
  function zoomAt(s, p, from = { s: zs, x: zx, y: zy }) {
    zs = Math.min(MAX_ZOOM, Math.max(1, s));
    zx = p.x - ((p.x - from.x) * zs) / from.s;
    zy = p.y - ((p.y - from.y) * zs) / from.s;
    clampPan();
  }
  const pinchData = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2) };
  };

  frame.addEventListener("pointerdown", (e) => {
    try {
      frame.setPointerCapture(e.pointerId); // keep the gesture if a finger leaves the frame
    } catch {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      // a second finger turns any drag into a pinch; the track settles first
      if (gesture?.axis === "x") placeTrack(true);
      const { dist, mid } = pinchData();
      gesture = { type: "pinch", dist0: dist, mid0: mid, from: { s: zs, x: zx, y: zy } };
      lb.style.opacity = "";
    } else if (pointers.size === 1) {
      gesture = { type: "drag", id: e.pointerId, kind: e.pointerType, x0: e.clientX, y0: e.clientY, zx0: zx, zy0: zy, t0: performance.now(), axis: null };
    }
  });
  frame.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture?.type === "pinch" && pointers.size === 2) {
      const { dist, mid } = pinchData();
      // the fingers' spread scales the photo, their midpoint pans it
      const from = gesture.from;
      zoomAt(from.s * (dist / gesture.dist0), gesture.mid0, from);
      zx += mid.x - gesture.mid0.x;
      zy += mid.y - gesture.mid0.y;
      clampPan();
      applyZoom(false);
      return;
    }
    if (gesture?.type !== "drag" || e.pointerId !== gesture.id) return;
    const dx = (e.clientX - gesture.x0) / pageZoom();
    const dy = (e.clientY - gesture.y0) / pageZoom();
    if (zs > 1) {
      zx = gesture.zx0 + dx;
      zy = gesture.zy0 + dy;
      clampPan();
      applyZoom(false);
      return;
    }
    if (!gesture.axis && Math.hypot(dx, dy) > 8) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : dy > 0 && gesture.kind !== "mouse" ? "y" : "none";
    }
    if (gesture.axis === "x") {
      // past the first / last photo the track gives way at a third of the pull
      const atEdge = (lbIndex === 0 && dx > 0) || (lbIndex === lbSlides.length - 1 && dx < 0);
      placeTrack(false, atEdge ? dx / 3 : dx);
    } else if (gesture.axis === "y") {
      // pulling down to close: the photo follows, the viewer fades
      const img = curImg();
      img.style.transition = "none";
      img.style.transform = `translateY(${Math.max(0, dy)}px)`;
      lb.style.opacity = String(Math.max(0.35, 1 - Math.max(0, dy) / 400));
    }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture?.type === "pinch") {
      if (zs < 1.05) resetZoom(true);
      // one finger left on the photo carries on as a pan
      if (pointers.size === 1) {
        const [id, p] = [...pointers.entries()][0];
        gesture = { type: "drag", id, kind: "touch", x0: p.x, y0: p.y, zx0: zx, zy0: zy, t0: 0, axis: "none" };
      } else gesture = null;
      return;
    }
    if (gesture?.type !== "drag" || e.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    const dx = (e.clientX - g.x0) / pageZoom();
    const dy = (e.clientY - g.y0) / pageZoom();
    const now = performance.now();
    // a tap: two within 300ms on about the same spot = double tap
    if (Math.hypot(dx, dy) < 10 && now - g.t0 < 300) {
      if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        lastTap.t = 0;
        if (zs > 1) resetZoom(true);
        else {
          zoomAt(TAP_ZOOM, fromCentre(e.clientX, e.clientY));
          applyZoom(true);
        }
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
      return;
    }
    if (zs > 1) return; // that was a pan
    if (g.axis === "x") {
      // far enough (a fifth of the frame) or flicked: on to the next photo
      const fast = Math.abs(dx) / Math.max(1, now - g.t0) > 0.4;
      const step = dx < 0 ? 1 : -1;
      const target = lbIndex + step;
      if ((Math.abs(dx) > frame.clientWidth / 5 || (fast && Math.abs(dx) > 20)) && target >= 0 && target < lbSlides.length)
        lbShow(target);
      else placeTrack(true); // glide back
    } else if (g.axis === "y" && dy > 90) close();
    else resetZoom(true); // not far enough: spring back
  }
  frame.addEventListener("pointerup", endPointer);
  frame.addEventListener("pointercancel", endPointer);

  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
    else if (e.key === "ArrowRight") lbShow(lbIndex + 1);
    else if (e.key === "Tab") {
      // keep focus inside the viewer
      const f = [...lb.querySelectorAll("button")];
      const at = f.indexOf(document.activeElement);
      const to = e.shiftKey ? (at <= 0 ? f.length - 1 : at - 1) : (at + 1) % f.length;
      f[to].focus();
    } else return;
    e.preventDefault();
  });

  show(0);
  // crossing the phone breakpoint: put the right photo back in the main frame
  fluidLayout.addEventListener("change", () => show(index));
  return { show };
})();

/* ---------- "Read more" (product details) ---------- */
document.querySelectorAll(".read-more").forEach((btn) => {
  btn.addEventListener("click", () => {
    const more = document.getElementById(btn.getAttribute("aria-controls"));
    const open = more.hidden;
    more.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Read less" : "Read more";
  });
});

/* ---------- "Show full review" ----------
   Review text is clamped to two lines; the link opens it up. Where the
   whole review already fits, the link is hidden rather than doing nothing. */
document.querySelectorAll(".review-link").forEach((btn) => {
  const body = btn.closest(".review-card").querySelector(".review-body");
  body.classList.add("is-clamped");
  const sync = () => {
    if (!body.classList.contains("is-clamped")) return;
    btn.hidden = body.scrollHeight <= body.clientHeight + 1;
  };
  sync();
  window.addEventListener("resize", sync);
  btn.addEventListener("click", () => {
    const open = body.classList.toggle("is-clamped") === false;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Show less" : "Show full review";
  });
});

/* ---------- newsletter (footer) ---------- */
const newsletter = document.getElementById("newsletter");
const newsletterMsg = document.getElementById("newsletter-msg");
newsletter.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = newsletter.querySelector("input");
  const ok = input.checkValidity() && input.value.trim() !== "";
  input.setAttribute("aria-invalid", String(!ok));
  newsletterMsg.dataset.kind = ok ? "ok" : "error";
  newsletterMsg.textContent = ok
    ? "Thanks! You're subscribed to our news and discounts."
    : "Please enter a valid email address.";
  if (ok) input.value = "";
});

/* ---------- header search suggestions ----------
   The search field (nav.js) has no search behind it in this prototype, so
   typing suggests matching product types from the menu's A–Z list
   (window.LP_MENU.az) as real links. Arrow keys move, Enter opens. */
(function searchSuggest() {
  const input = document.getElementById("q");
  const list = (window.LP_MENU && window.LP_MENU.az) || [];
  if (!input || !list.length) return;
  const form = input.closest("form");
  const box = document.createElement("ul");
  box.className = "search-suggest";
  box.id = "search-suggest";
  box.setAttribute("role", "listbox");
  box.hidden = true;
  form.append(box);
  input.setAttribute("aria-controls", "search-suggest");
  input.setAttribute("aria-autocomplete", "list");
  let active = -1;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    active = -1;
    if (!q) return (box.hidden = true);
    const hits = list.filter((x) => x.href && x.label.toLowerCase().includes(q)).slice(0, 8);
    box.innerHTML = hits.length
      ? hits.map((x) => `<li role="option"><a href="${x.href}">${x.label}</a></li>`).join("")
      : `<li class="search-empty">No product types match “${input.value.trim().replace(/[<>&]/g, "")}”</li>`;
    box.hidden = false;
  };
  const move = (d) => {
    const items = [...box.querySelectorAll("a")];
    if (!items.length) return;
    active = (active + d + items.length) % items.length;
    items.forEach((a, i) => a.parentElement.classList.toggle("active", i === active));
    items[active].parentElement.scrollIntoView({ block: "nearest" });
  };
  input.addEventListener("input", render);
  input.addEventListener("focus", render);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Escape") box.hidden = true;
  });
  form.addEventListener("submit", () => {
    const items = [...box.querySelectorAll("a")];
    const target = items[Math.max(active, 0)];
    if (target) window.location.href = target.href;
  });
  document.addEventListener("click", (e) => {
    if (!form.contains(e.target)) box.hidden = true;
  });
})();

/* ---------- product tabs ----------
   All panels stay in the HTML (crawlable without JavaScript); the script
   shows only the panel of the active tab instead of jumping to its anchor. */
const productTabs = document.querySelectorAll(".tab");

function showTab(tab) {
  productTabs.forEach((t) => {
    const isActive = t === tab;
    t.classList.toggle("active", isActive);
    t.setAttribute("aria-current", isActive ? "true" : "false");
    const panel = document.querySelector(t.getAttribute("href"));
    if (panel) panel.hidden = !isActive;
  });
}

productTabs.forEach((tab) => {
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(tab);
  });
});

showTab(document.querySelector(".tab.active") || productTabs[0]);

/* ---------- comparable product cards ----------
   The tiles are server-rendered in index.html (crawlable names, prices and
   links without JavaScript); the slider below only adds behaviour. */

/* ---------- comparable products slider ------------------------------------
   Behaviour only: every tile renders exactly as before, each inside a slide
   wrapper the slider can snap to and label.
   - scroll-snap on each slide, so swipes, flicks, drags and keys always come
     to rest on a tile edge, never half a tile
   - prev / next move a page: the tiles fully clear of the white fade. The
     faded tile is never skipped; it becomes the first tile of the next page
   - a control is hidden where there's nowhere to go (prev at the start keeps
     the resting state identical to the design); the fade goes with next
   - desktop mouse drag with a small threshold, flick velocity carrying on to
     the next tile, and the click that ends a drag swallowed so a drag that
     starts on "Free quote" never fires it
   - keyboard: the track is focusable, ←/→ move a tile, Home/End jump to the
     ends; tabbing onto a tile's button brings the whole tile into clear view,
     and focus is handed over if the arrow it's on disappears
   - screen readers get a carousel region, "n of N" slides and a polite
     "Products 1 to 3 of 5" update after each move
   - no autoplay; the vertical wheel keeps scrolling the page; reduced motion
     gets instant jumps */
const cardTrack = document.getElementById("card-track");
const cardRow = cardTrack.parentElement;
const cardPrev = document.getElementById("card-prev");
const cardNext = document.getElementById("card-next");
const cardStatus = document.getElementById("card-status");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(pointer: fine)");

const slides = [...cardTrack.children];

// geometry is read from the layout (unaffected by the frame's scale), so it
// follows the CSS rather than hard-coding 340 + 10
const slideStep = () => (slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : slides[0].offsetWidth);
const maxScroll = () => cardTrack.scrollWidth - cardTrack.clientWidth;
const currentIndex = () => Math.round(cardTrack.scrollLeft / slideStep());

// width of the track not covered by the fade
function clearWidth() {
  const fade = getComputedStyle(cardRow, "::after");
  const fadeLeft = cardRow.clientWidth - parseFloat(fade.right) - parseFloat(fade.width);
  return Math.min(cardTrack.clientWidth, fadeLeft - cardTrack.offsetLeft);
}
function pageSize() {
  const step = slideStep();
  const gap = step - slides[0].offsetWidth;
  return Math.max(1, Math.floor((clearWidth() + gap) / step));
}

let sliderUsed = false; // no announcement for the initial state
function goToSlide(index) {
  sliderUsed = true;
  const i = Math.max(0, Math.min(index, slides.length - 1));
  cardTrack.scrollTo({
    left: Math.min(i * slideStep(), maxScroll()),
    behavior: reduceMotion.matches ? "instant" : "smooth",
  });
}

cardPrev.addEventListener("click", () => goToSlide(currentIndex() - pageSize()));
cardNext.addEventListener("click", () => goToSlide(currentIndex() + pageSize()));

function syncSlider() {
  const max = maxScroll();
  const atStart = cardTrack.scrollLeft <= 1;
  const atEnd = cardTrack.scrollLeft >= max - 1;
  // never strand keyboard focus on a control that's about to disappear
  for (const [btn, off, other] of [[cardPrev, atStart, cardNext], [cardNext, atEnd, cardPrev]]) {
    if (off && document.activeElement === btn) (other.disabled ? cardTrack : other).focus();
    btn.disabled = off;
  }
  cardRow.classList.toggle("at-end", atEnd);
  cardTrack.classList.toggle("is-draggable", max > 1 && finePointer.matches);
}

function announceSlides() {
  if (!sliderUsed) return;
  const from = cardTrack.scrollLeft - 1;
  const to = cardTrack.scrollLeft + cardTrack.clientWidth + 1;
  const shown = slides.flatMap((s, i) => (s.offsetLeft >= from && s.offsetLeft + s.offsetWidth <= to ? [i + 1] : []));
  if (!shown.length) return;
  const text = `Products ${shown[0]} to ${shown[shown.length - 1]} of ${slides.length}`;
  if (cardStatus.textContent !== text) cardStatus.textContent = text;
}

// "scroll has settled": scrollend where supported, a short debounce otherwise
function onScrollSettled(fn) {
  if ("onscrollend" in window) return cardTrack.addEventListener("scrollend", fn);
  let t;
  cardTrack.addEventListener("scroll", () => {
    clearTimeout(t);
    t = setTimeout(fn, 120);
  });
}
cardTrack.addEventListener("scroll", syncSlider);
onScrollSettled(announceSlides);
new ResizeObserver(syncSlider).observe(cardTrack);

// keyboard, when the track itself has focus
cardTrack.addEventListener("keydown", (e) => {
  if (e.target !== cardTrack) return;
  const i = currentIndex();
  const target = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: slides.length - 1 }[e.key];
  if (target === undefined) return;
  e.preventDefault();
  goToSlide(target);
});

// tabbing into a tile that's off-screen or under the fade brings it fully into view
cardTrack.addEventListener("focusin", (e) => {
  const slide = e.target.closest(".slide");
  if (!slide) return;
  const left = cardTrack.scrollLeft;
  const clearRight = left + (cardRow.classList.contains("at-end") ? cardTrack.clientWidth : clearWidth());
  if (slide.offsetLeft < left - 1 || slide.offsetLeft + slide.offsetWidth > clearRight + 1) {
    goToSlide(slides.indexOf(slide));
  }
});

// mouse drag
let drag = null;
cardTrack.addEventListener("dragstart", (e) => e.preventDefault());
cardTrack.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || e.button !== 0 || maxScroll() <= 1) return;
  drag = {
    id: e.pointerId,
    x: e.clientX,
    left: cardTrack.scrollLeft,
    scale: new DOMMatrix(getComputedStyle(frame).transform).a || 1, // screen px -> layout px
    moved: false,
    samples: [[e.timeStamp, e.clientX]],
  };
});
cardTrack.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  if (!drag.moved) {
    if (Math.abs(dx) < 6) return; // below this it's a click, not a drag
    drag.moved = true;
    // capture only once it's a real drag, so a plain click still reaches the tile's button
    cardTrack.setPointerCapture(e.pointerId);
    cardTrack.classList.add("is-dragging");
    getSelection().removeAllRanges();
  }
  cardTrack.scrollLeft = drag.left - dx / drag.scale;
  drag.samples.push([e.timeStamp, e.clientX]);
  if (drag.samples.length > 5) drag.samples.shift();
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.moved) return;

  cardTrack.classList.remove("is-dragging");
  cardTrack.classList.add("is-settling");
  const settle = () => cardTrack.classList.remove("is-settling");
  cardTrack.addEventListener("scrollend", settle, { once: true });
  setTimeout(settle, 700); // no scrollend when the drag already ended on a tile edge

  // a flick carries on to the next tile in its direction; a slow release
  // settles on whichever tile edge is nearest
  const [t0, x0] = d.samples[0];
  const [t1, x1] = d.samples[d.samples.length - 1];
  const velocity = t1 > t0 ? -(x1 - x0) / d.scale / (t1 - t0) : 0; // layout px/ms, + = forward
  const pos = cardTrack.scrollLeft / slideStep();
  goToSlide(Math.abs(velocity) > 0.4 ? (velocity > 0 ? Math.ceil(pos) : Math.floor(pos)) : Math.round(pos));

  // swallow the click that ends the drag, and only that one
  const swallow = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
  };
  cardTrack.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => cardTrack.removeEventListener("click", swallow, { capture: true }), 0);
}
cardTrack.addEventListener("pointerup", endDrag);
cardTrack.addEventListener("pointercancel", endDrag);

syncSlider();

/* ---------- swipe carousels: pagination dots (Mobile Carrousel bar) ---------
   The gallery and the review cards scroll sideways below 1630px. Each gets one
   dot per slide; the active one stretches into the pill, and a tap on a dot
   scrolls its slide into view. On desktop both tracks are laid out normally
   and the dots are hidden by CSS, so this is inert there. */
/* At most five dots show (user): a window that slides along with the active
   one. The pill moves to the middle slot, stays centred while the dots slide
   past, and moves on to the last slots once the final dots are in view; the
   window's outer dots shrink while more wait beyond them (styles.css). */
const DOTS_MAX = 5;
const DOT_W = 10; // styles.css .m-dots button
const PILL_W = 23; // styles.css .m-dots button.active
const DOTS_EDGE = 14; // soft fade room on each side (styles.css .is-windowed mask)
function initDots(track, dots, counter = null) {
  const items = [...track.children];
  const win = document.createElement("div");
  win.className = "m-dots-window";
  const rail = document.createElement("div");
  rail.className = "m-dots-track";
  win.append(rail);
  dots.append(win);
  const buttons = items.map((item, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.tabIndex = -1;
    dot.addEventListener("click", () =>
      track.scrollTo({
        left: item.offsetLeft - track.firstElementChild.offsetLeft,
        behavior: reduceMotion.matches ? "instant" : "smooth",
      })
    );
    rail.append(dot);
    return dot;
  });

  function placeWindow(active) {
    const n = buttons.length;
    dots.classList.toggle("is-windowed", n > DOTS_MAX);
    if (n <= DOTS_MAX) return;
    const start = Math.min(Math.max(active - Math.floor(DOTS_MAX / 2), 0), n - DOTS_MAX);
    const step = DOT_W + parseFloat(getComputedStyle(rail).columnGap);
    // the window is five dots wide plus a fade margin each side; a side's
    // fade shows only while dots are hidden beyond it
    dots.classList.toggle("more-left", start > 0);
    dots.classList.toggle("more-right", start + DOTS_MAX < n);
    rail.style.transform = `translateX(${DOTS_EDGE - start * step}px)`;
    win.style.width = `${(DOTS_MAX - 1) * step + PILL_W + 2 * DOTS_EDGE}px`;
    buttons.forEach((b, i) => {
      b.classList.toggle("out", i < start || i >= start + DOTS_MAX);
      b.classList.toggle(
        "edge",
        (i === start && start > 0) || (i === start + DOTS_MAX - 1 && start + DOTS_MAX < n)
      );
    });
  }

  function sync() {
    const max = track.scrollWidth - track.clientWidth;
    // the last slide can't reach the left edge, so pin it once scrolled to the end
    let active = items.length - 1;
    if (track.scrollLeft < max - 2) {
      const x = track.scrollLeft + items[0].offsetLeft;
      active = items.reduce((best, item, i) =>
        Math.abs(item.offsetLeft - x) < Math.abs(items[best].offsetLeft - x) ? i : best, 0);
    }
    buttons.forEach((b, i) => b.classList.toggle("active", i === active));
    placeWindow(active);
    if (counter) counter.textContent = `${active + 1} / ${items.length}`;
    dots.hidden = max <= 1; // nothing to page through
  }
  track.addEventListener("scroll", sync, { passive: true });
  new ResizeObserver(sync).observe(track);
  sync();
}
initDots(
  document.getElementById("gallery-track"),
  document.getElementById("gallery-dots"),
  document.getElementById("gallery-count")
);
initDots(document.querySelector(".review-cards"), document.getElementById("review-dots"));

/* ---------- phone buy bar steps aside at the footer ----------
   Once the footer comes up (a bar's height before it reaches the bottom of
   the screen, so nothing above it stays hidden) the bar slides down out of
   the way (styles.css .m-buybar.is-away); scrolling back up brings it back. */
(function buyBarAtFooter() {
  const bar = document.querySelector(".m-buybar");
  const footer = document.querySelector(".footer");
  if (!bar || !footer || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([entry]) => bar.classList.toggle("is-away", entry.isIntersecting), {
    rootMargin: "0px 0px 160px 0px",
  }).observe(footer);
})();

/* Phones (user): once the page's own price block (Price p.p. / Total) comes
   into view above the buy bar, the bar drops its price summary and keeps only
   the two CTAs, so the price isn't shown twice. It stays that way while the
   block is in view or scrolled past (above the screen), and returns only when
   the user scrolls back up so the block is below the bar again. The bottom
   margin is the full bar's height (~122px) plus room, so the bar shrinking doesn't move
   the line and the state can't flicker. */
(function buyBarAtPriceBlock() {
  const bar = document.querySelector(".m-buybar");
  const block = document.querySelector(".price-block");
  if (!bar || !block || !("IntersectionObserver" in window)) return;
  // the observer only reports entering / leaving view, not a jump from below
  // the screen straight to above it (a fast flick), so while the block is
  // out of view a scroll check decides: past it (bottom above the screen
  // top) = compact, still below = full bar
  let inView = false;
  const update = () =>
    bar.classList.toggle("is-compact", inView || block.getBoundingClientRect().bottom <= 0);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    update();
  }, {
    rootMargin: "0px 0px -150px 0px",
  }).observe(block);
  window.addEventListener("scroll", () => { if (!inView) update(); }, { passive: true });
})();

/* ---------- request flow screen (CTA ON_CLICK → NAVIGATE) ---------- */
const overlay = document.getElementById("request-overlay");
const summary = document.getElementById("request-summary");

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const kind = btn.dataset.nav;
    document.getElementById("request-title").textContent =
      kind === "design" ? "Get free Design" : "Get free Quote";

    summary.innerHTML = [
      ["Product", "Thermos bottle | Stainless steel | 500 ml"],
      ["Colour", state.labels.color || "Not chosen yet"],
      ["Printing position", state.labels.position || "Not chosen yet"],
      ["Printing in", state.labels.printing || "Not chosen yet"],
      ["Quantity", `${state.quantity} pieces`],
      ["Price p.p.", money(state.price)],
      ["Total", money(state.quantity * state.price)],
    ].map(([k, v]) => `<div class="rs-line"><span>${k}</span><span>${v}</span></div>`).join("");

    overlay.classList.add("open");
  });
});

document.getElementById("request-close").addEventListener("click", () => overlay.classList.remove("open"));
overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") overlay.classList.remove("open"); });

/* ---------- phone breadcrumbs: "…" opens the folded middle levels ---------- */
document.querySelector(".crumbs-more button")?.addEventListener("click", (e) => {
  const trail = e.currentTarget.closest(".crumbs");
  trail.classList.add("is-expanded");
  e.currentTarget.setAttribute("aria-expanded", "true");
  // the button disappears: keep keyboard focus on the first revealed link
  trail.querySelector(".crumb-mid a")?.focus();
});

/* ---------- init ---------- */
qtyList.querySelector('[data-qty="250"]').classList.add("selected");
setQuantityValue(250);
updatePrice();
fitFrame();
window.addEventListener("load", fitFrame);

/* ---------- compact header on scroll ----------
   Down: the USP banner and the category bar hide; the main bar (logo,
   search, actions) stays (styles.css .hd.is-compact). Up, or back at the
   very top: they return.
   The header is fixed to the top with a spacer of its full height in the
   page flow (styles.css .hd-spacer), so hiding / showing its parts never
   moves the page — that removed the jump, and with it the need for a
   threshold or cool-down: the first pixel of scrolling down compacts it.
   The parts ease out / in (styles.css), measured here for the animation. */
(function compactHeader() {
  const hd = document.getElementById("hd");
  const spacer = document.createElement("div");
  spacer.className = "hd-spacer";
  spacer.setAttribute("aria-hidden", "true");
  hd.after(spacer);
  // the spacer always holds the full (expanded) header height
  // (not while the parts are animating: it would follow the in-between heights).
  // Phones zoom the page by screen / 393 but undo it on the header (fitPhone),
  // so the spacer, inside the zoomed page, needs the header's on-screen height
  // divided by that zoom — otherwise on a 320px phone it falls 24px short and
  // the header covers the breadcrumbs.
  const sizeSpacer = () => {
    if (hd.classList.contains("is-compact") || hd.classList.contains("hd-anim")) return;
    const pageZoom = parseFloat(document.body.style.zoom) || 1;
    spacer.style.height = `${hd.getBoundingClientRect().height / pageZoom}px`;
  };
  new ResizeObserver(sizeSpacer).observe(hd);
  window.addEventListener("resize", sizeSpacer); // the page zoom follows the width
  sizeSpacer();
  // pin it only now: the spacer takes over the room it held in the flow
  hd.classList.add("is-fixed");

  // natural heights of the parts that collapse, for the height animation
  const root = document.documentElement;
  const measure = () => {
    if (hd.classList.contains("is-compact")) return;
    const usp = hd.querySelector(".usp");
    const cat = hd.querySelector(".cat");
    root.style.setProperty("--usp-h", `${usp ? usp.scrollHeight : 0}px`);
    root.style.setProperty("--cat-h", `${cat ? cat.scrollHeight : 0}px`);
  };
  measure();
  window.addEventListener("resize", measure);
  if (document.fonts) document.fonts.ready.then(measure);

  let lastY = window.scrollY;
  let animTimer;
  let holdUntil = 0;
  // keep the header compact for a while (programmatic scroll to the summary)
  window.holdCompactHeader = (ms) => {
    holdUntil = performance.now() + ms;
    if (ms > 0) set(true);
  };
  const set = (on) => {
    if (hd.classList.contains("is-compact") === on) return;
    if (on) measure();
    // clip the parts while they move; unclipped again once settled
    hd.classList.add("hd-anim");
    clearTimeout(animTimer);
    animTimer = setTimeout(() => {
      hd.classList.remove("hd-anim");
      sizeSpacer();
    }, 400);
    hd.classList.toggle("is-compact", on);
  };
  window.addEventListener(
    "scroll",
    () => {
      const y = Math.max(0, window.scrollY);
      const dy = y - lastY;
      lastY = y;
      if (performance.now() < holdUntil && y > 0) set(true);
      else if (document.getElementById("drawer").classList.contains("open") || y <= 0) set(false);
      else if (dy > 0) set(true);
      // phones (user): the trust banner only returns at the very top, not
      // on any scroll up; desktop / tablet bring the header back on scroll up
      else if (dy < -4 && !fluidLayout.matches) set(false);
    },
    { passive: true }
  );
  if (window.scrollY > 0) set(true);
})();

/* ---------- header height for the sticky photo column ----------
   styles.css pins .col1 under the header; the header's height changes as it
   compacts on scroll, so it's published as --hd-h. */
(function headerHeightVar() {
  const hd = document.getElementById("hd");
  const set = () => document.documentElement.style.setProperty("--hd-h", `${hd.offsetHeight}px`);
  new ResizeObserver(set).observe(hd);
  set();
})();

/* ---------- header search: text never cropped ----------
   On the desktop header (>= 992px, where the placeholder reads "What are you
   looking for?") the search field narrows with the window. Whenever the
   placeholder wouldn't fit, the field's text steps down 2px at a time from
   its 18px until it does (floor 10px). Below 992px the mobile header takes
   over with its own short "Search" placeholder and the size resets. */
(function fitSearchText() {
  const input = document.getElementById("q");
  if (!input) return;
  const desktopNav = matchMedia("(min-width: 992px)");
  const canvas = document.createElement("canvas").getContext("2d");
  const BASE = 18, STEP = 2, MIN = 10;
  const fit = () => {
    input.style.fontSize = "";
    if (!desktopNav.matches) return;
    const cs = getComputedStyle(input);
    const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const text = input.placeholder;
    let size = BASE;
    const width = (px) => {
      canvas.font = `${cs.fontWeight} ${px}px ${cs.fontFamily}`;
      return canvas.measureText(text).width;
    };
    while (size > MIN && width(size) > room) size -= STEP;
    if (size !== BASE) input.style.fontSize = `${size}px`;
  };
  window.addEventListener("resize", fit);
  desktopNav.addEventListener("change", () => requestAnimationFrame(fit));
  if (document.fonts) document.fonts.ready.then(fit);
  fit();
})();
