// JOURNEY, in one scroll:
//   1. AI drone film outside: in from the sea over the hatchery sheds, up to an open shed door.
//   2. Through the door into the 3D shed, built from the reference photos (projected onto the geometry): along the
//      raceway tanks, past the sample bowl on the rim, and down through the water into one tank.
//   3. The dive (AI video that starts on the exact 3D frame at the water): a splash, then underwater among the
//      post-larvae; then a burst of bubbles.
//   4. Real footage of grown prawns, then up into the light and out into the real pond footage.
import { clamp01, smooth, lerp, band, whileVisible, makeRenderer } from "./larva.js";
import { build3D } from "./flight3d.js";

const FLIGHT = [0, 0.2];      // AI flight film (outside)
const SHED = [0.2, 0.5];      // 3D: door -> tanks -> into the water -> larvae
const GROW = [0.43, 0.5];     // larvae grow
const PRAWNS = [0.49, 0.6];   // real prawns, rising toward the light
const POND = 0.62;            // pond film from here
const DOOR_J = 0.565;         // where the 3D flight starts: just inside the open door

export function initJourney({ ScrollTrigger, reduce }) {
  const section = document.getElementById("journey");
  const flight = section.querySelector(".hatch-video");
  const poster = section.querySelector(".hatch-poster");
  const film = section.querySelector(".film-video");
  const bubbles = section.querySelector(".uw-bubbles");
  const prawns = section.querySelector(".uw-prawns");
  const dive = section.querySelector(".uw-dive");
  const canvas = section.querySelector("#uw-gl");
  const haze = section.querySelector(".haze");
  const caps = [...section.querySelectorAll(".j-cap")];
  // kinetic captions: every word gets its own span so words can rise out of a blur one after another
  caps.forEach((c) => {
    const walk = (n) => [...n.childNodes].forEach((k) => {
      if (k.nodeType === 3 && k.textContent.trim()) {
        const f = document.createDocumentFragment();
        k.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) f.append(w); else { const s = document.createElement("span"); s.className = "kw"; s.textContent = w; f.append(s); } });
        k.replaceWith(f);
      } else if (k.nodeType === 1 && k.tagName !== "BR") walk(k);
    });
    walk(c);
    c._words = [...c.querySelectorAll(".kw")];
  });
  // liquid ripple used at every water moment
  const ripT = document.getElementById("rip-t"), ripD = document.getElementById("rip-d");
  const mobile = window.innerWidth < 760;

  // films load as blobs so any frame can be sought instantly, on any host
  let loaded = false;
  const load = (v, name) => {
    const src = `media/${name}${mobile ? "-sm" : ""}.mp4`;
    fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject(r.status))).then((b) => { v.src = URL.createObjectURL(b); }).catch(() => { v.src = src; });
  };
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || loaded || reduce) return;
    loaded = true; load(flight, "hatch-flight"); load(dive, "uw-dive"); load(prawns, "uw-prawns"); load(film, "farm-scrub"); bubbles.src = bubbles.dataset.src;
  }, { rootMargin: "2500px 0px" }).observe(section);

  let r3 = null;
  try { r3 = build3D(makeRenderer(canvas, { opaque: true, maxDpr: 1.25 }), canvas, mobile, { photos: true }); } catch { r3 = null; }
  // the 3D segment runs from the door to the end of its flight; map moments of that flight onto the scroll
  const s0 = r3 ? r3.scrollFor(DOOR_J) : 0;
  const jAt = (jOld) => (r3 ? lerp(SHED[0], SHED[1], (r3.scrollFor(jOld) - s0) / (1 - s0)) : 0);
  const DIVE0 = r3 ? jAt(0.8) : 0.4;          // the dive film starts on the 3D frame at j = 0.8
  if (r3) [[2, 0.655], [3, 0.74]].forEach(([i, j]) => { if (caps[i]) caps[i].dataset.at = String(jAt(j)); });
  if (caps[4]) caps[4].dataset.at = String(lerp(DIVE0, PRAWNS[0], 0.62));
  if (caps[5]) caps[5].dataset.at = "0.535";
  // each caption gets a fade that fits between its neighbours, so two never show at once
  { const at = caps.map((c) => Number(c.dataset.at));
    caps.forEach((c, i) => { const gap = Math.min(i ? at[i] - at[i - 1] : 1, i < at.length - 1 ? at[i + 1] - at[i] : 1); c.dataset.w = String(Math.max(0.018, Math.min(0.05, gap * 0.48))); }); }

  let J = reduce ? 1 : 0, target = J;
  if (ScrollTrigger && !reduce) ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { target = s.progress; } });

  const seek = (v, p) => {
    const d = v.duration;
    if (!d || v.readyState < 1 || v.seeking) return;
    const t = p * (d - 0.05);
    if (Math.abs(v.currentTime - t) > 1 / 30) v.currentTime = t;
  };

  function frame(now, dt) {
    J += (target - J) * Math.min(1, dt * 4);
    // through the door: the film rushes into the dark doorway, and the 3D shed comes out of the same rush
    const in3 = smooth(band(J, SHED[0] - 0.006, SHED[0] + 0.008));
    const rush = band(J, SHED[0] - 0.03, SHED[0]);
    flight.style.transform = `scale(${(1 + 0.9 * rush * rush).toFixed(3)})`;
    flight.style.transformOrigin = "50% 60%";
    flight.style.filter = rush > 0.02 ? `blur(${(rush * rush * 10).toFixed(1)}px) brightness(${(1 - rush * 0.35).toFixed(2)})` : "";
    const land = 1 - band(J, SHED[0] - 0.006, SHED[0] + 0.02);
    const prIn = smooth(band(J, PRAWNS[0], PRAWNS[0] + 0.025));
    const pondIn = smooth(band(J, POND - 0.03, POND));
    flight.style.opacity = String(1 - in3);
    poster.style.opacity = flight.readyState >= 2 || J > 0.05 ? "0" : "1";
    canvas.style.transform = land > 0.001 ? `scale(${(1 + 0.35 * land * land).toFixed(3)})` : "";
    canvas.style.filter = land > 0.02 ? `blur(${(land * land * 9).toFixed(1)}px)` : "";
    const dvIn = smooth(band(J, DIVE0 - 0.004, DIVE0 + 0.008));   // starts on the same frame as the 3D; a brief blend covers phone framing
    canvas.style.opacity = String(in3 * (1 - dvIn));
    dive.style.opacity = String(dvIn * (1 - prIn));
    prawns.style.opacity = String(prIn * (1 - pondIn));
    const up = smooth(band(J, 0.55, POND));
    prawns.style.transform = `translateY(${(up * 9).toFixed(2)}%) scale(${(1.06 + up * 0.12).toFixed(3)})`;
    prawns.style.filter = `brightness(${(1 + up * 0.22).toFixed(2)})` + (pondIn > 0.01 ? ` blur(${(pondIn * 8).toFixed(1)}px)` : "");
    film.style.opacity = String(pondIn);
    film.style.transform = `scale(${1.14 - 0.14 * smooth(band(J, POND - 0.03, POND + 0.06))})`;
    // bubbles: a burst as the camera breaks the tank surface, another as the larvae grow
    const b1 = 0;
    const b2 = Math.sin(Math.PI * band(J, 0.465, 0.525)) * 0.85;
    const bo = Math.max(0, b1, b2);
    bubbles.style.opacity = String(bo);
    if (bo > 0.02 && bubbles.paused && bubbles.src) bubbles.play().catch(() => {});
    else if (bo <= 0.02 && !bubbles.paused) bubbles.pause();
    haze.style.opacity = String(Math.max(0, Math.sin(Math.PI * band(J, POND - 0.04, POND + 0.01))) * 0.4);

    if (in3 < 1) seek(flight, band(J, FLIGHT[0], FLIGHT[1]));
    if (r3 && in3 > 0 && dvIn < 1) r3(lerp(s0, 0.995, band(J, SHED[0], SHED[1])), now, dt);
    if (dvIn > 0 && prIn < 1) seek(dive, band(J, DIVE0, PRAWNS[0] + 0.02));
    if (prIn > 0 && pondIn < 1) seek(prawns, band(J, PRAWNS[0], PRAWNS[1]));
    if (pondIn > 0) seek(film, band(J, POND, 1));
    // liquid ripple: breaking the surface, larvae turning into prawns, and surfacing into the pond
    const rip = Math.max(
      Math.sin(Math.PI * band(J, DIVE0 - 0.012, DIVE0 + 0.035)),
      Math.sin(Math.PI * band(J, PRAWNS[0] - 0.02, PRAWNS[0] + 0.035)),
      Math.sin(Math.PI * band(J, POND - 0.045, POND + 0.02)));
    const tt = now * 0.001;
    const rippled = rip > 0.02 ? [dive, prawns, film, canvas] : [];
    if (rip > 0.02) {
      ripD.setAttribute("scale", (rip * (mobile ? 38 : 70)).toFixed(1));
      ripT.setAttribute("baseFrequency", `${(0.006 + 0.0025 * Math.sin(tt * 1.3)).toFixed(4)} ${(0.016 + 0.004 * Math.cos(tt * 0.9)).toFixed(4)}`);
    }
    // focus pull: after the splash the camera settles and the larvae come sharp
    const focus = dvIn > 0 && prIn < 0.5 ? (1 - smooth(band(J, DIVE0 + 0.012, DIVE0 + 0.045))) * 4 * smooth(band(J, DIVE0, DIVE0 + 0.01)) : 0;
    const base = new Map([[dive, focus > 0.2 ? `blur(${focus.toFixed(1)}px)` : ""], [prawns, prawns.style.filter.replace(/ ?url\(#ripple\)/g, "")], [film, ""], [canvas, canvas.style.filter.replace(/ ?url\(#ripple\)/g, "")]]);
    base.forEach((f, el) => { el.style.filter = rippled.includes(el) ? `${f} url(#ripple)`.trim() : f; });
    caps.forEach((c) => {
      const o = clamp01((1 - Math.abs(J - Number(c.dataset.at)) / Number(c.dataset.w || 0.06)) * 1.7);
      c.style.opacity = o > 0.001 ? "1" : "0"; c.style.transform = "";
      const n = c._words.length;
      c._words.forEach((w, i) => {
        const k = smooth(clamp01(o * (1 + n * 0.12) - i * 0.12));    // words arrive one after another
        w.style.opacity = String(k);
        w.style.transform = `translateY(${((1 - k) * 0.55).toFixed(3)}em)`;
        w.style.filter = k < 0.98 ? `blur(${((1 - k) * 10).toFixed(1)}px)` : "";
      });
    });
  }
  whileVisible(section, frame);
  frame(performance.now(), 0.016);
}
