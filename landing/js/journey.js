// JOURNEY, in one scroll, all real-time 3D in one engine (flight3d.js), no video:
//   1. In from the sea over the hatchery sheds, in through an open shed door.
//   2. Along the raceway tanks (painted with photoreal frames of this scene), past the sample bowl on the rim,
//      and down through the water into one tank, among the glassy post-larvae.
//   3. The larvae grow into prawns while bubbles swell around them.
//   4. Up into the light, out of the water, and on over the farm ponds with their paddle-wheel aerators.
import { clamp01, smooth, lerp, band, whileVisible, makeRenderer } from "./larva.js";
import { build3D } from "./flight3d.js";

const HATCH = 0.52;           // sea -> sheds -> door -> tanks -> underwater
const GROW = [0.53, 0.63];    // larvae grow into prawns
const RISE = [0.63, 0.675];   // up to the light
const POND = 0.665;           // drone over the ponds from here

export function initJourney({ ScrollTrigger, reduce }) {
  const section = document.getElementById("journey");
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
  const ripT = document.getElementById("rip-t"), ripD = document.getElementById("rip-d");
  const mobile = window.innerWidth < 760;

  let r3 = null;
  try { r3 = build3D(makeRenderer(canvas, { opaque: true, maxDpr: 1.25 }), canvas, mobile, { photos: true }); } catch { r3 = null; }
  if (!r3) { section.classList.add("no-gl"); return; }
  canvas.style.opacity = "1";
  // the flight ends just under the surface, among the larvae; it holds there while they grow
  const sHold = r3.scrollFor(0.965), sHatch = sHold - 0.012;
  const jAt = (jOld) => (HATCH * r3.scrollFor(jOld)) / sHatch;      // where a moment of the flight falls on the page
  const at = [jAt(0.07), jAt(0.3), jAt(0.62), jAt(0.73), jAt(0.93), 0.585, 0.73, 0.84, 0.955];
  caps.forEach((c, i) => { if (at[i] != null) c.dataset.at = String(at[i]); });
  { const a = caps.map((c) => Number(c.dataset.at));
    caps.forEach((c, i) => { const gap = Math.min(i ? a[i] - a[i - 1] : 1, i < a.length - 1 ? a[i + 1] - a[i] : 1); c.dataset.w = String(Math.max(0.018, Math.min(0.05, gap * 0.48))); }); }

  let J = reduce ? 1 : 0, target = J;
  if (ScrollTrigger && !reduce) ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { target = s.progress; } });

  function frame(now, dt) {
    J += (target - J) * Math.min(1, dt * 4);
    const pond = J >= POND;
    if (!pond) {
      const s = J < HATCH ? lerp(0, sHatch, J / HATCH)
        : J < RISE[0] ? lerp(sHatch, sHold, band(J, HATCH, RISE[0]))
        : lerp(sHold, 1, smooth(band(J, RISE[0], RISE[1])));
      r3.setGrow(smooth(band(J, GROW[0], GROW[1])));
      r3(s, now, dt);
    } else r3.pond(band(J, POND, 1), now, dt);
    // out of the water: the pond view comes up out of the bright surface light
    const flash = pond ? 1 - smooth(band(J, POND, POND + 0.03)) : 0;
    canvas.style.filter = flash > 0.01 ? `brightness(${(1 + flash * 1.6).toFixed(2)}) saturate(${(1 - flash * 0.5).toFixed(2)})` : "";
    haze.style.opacity = String(Math.max(0, Math.sin(Math.PI * band(J, POND - 0.02, POND + 0.03))) * 0.55);
    // liquid ripple: breaking into the tank, the larvae turning into prawns, and surfacing
    const rip = Math.max(
      Math.sin(Math.PI * band(J, jAt(0.9), jAt(0.935))) * 0.7,
      Math.sin(Math.PI * band(J, GROW[0] + 0.02, GROW[1] - 0.02)) * 0.35,
      Math.sin(Math.PI * band(J, RISE[0] + 0.01, POND + 0.03)));
    if (rip > 0.02) {
      const tt = now * 0.001;
      ripD.setAttribute("scale", (rip * (mobile ? 34 : 60)).toFixed(1));
      ripT.setAttribute("baseFrequency", `${(0.006 + 0.0025 * Math.sin(tt * 1.3)).toFixed(4)} ${(0.016 + 0.004 * Math.cos(tt * 0.9)).toFixed(4)}`);
      canvas.style.filter = `${canvas.style.filter} url(#ripple)`.trim();
    }
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
