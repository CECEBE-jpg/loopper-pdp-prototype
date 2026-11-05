/* Comparable products slider on the confirmation page — copied from the
   PDP (../script.js "comparable products slider"); keep in sync. */
(function () {
if (!document.getElementById("card-track")) return;
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
    scale: 1, // screen px -> layout px
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

})();
