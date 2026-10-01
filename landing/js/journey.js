// JOURNEY: one continuous 3D film (rendered in Blender, tools/journey_blender/build.py), scrubbed by the scroll.
// In from the sea over a seaside hatchery, through the shed door, along the raceway tanks, down among the
// post-larvae as they grow into prawns, up through the surface of a grow-out pond and away over the pond farm.
// The film is all-intra encoded and loaded as a blob, so any frame can be shown instantly while scrolling.
import { clamp01, smooth, whileVisible } from "./larva.js";

// where each caption sits, as a share of the film (frame / 1080 of the render timeline)
const CAPS = [60, 240, 440, 530, 640, 745, 930, 1000, 1058].map((f) => f / 1080);

export function initJourney({ ScrollTrigger, reduce }) {
  const section = document.getElementById("journey");
  const film = section.querySelector(".journey-film");
  const poster = section.querySelector(".journey-poster");
  const caps = [...section.querySelectorAll(".j-cap")];
  const mobile = window.innerWidth < 760;
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
  caps.forEach((c, i) => { if (CAPS[i] != null) c.dataset.at = String(CAPS[i]); });
  { const a = caps.map((c) => Number(c.dataset.at));
    caps.forEach((c, i) => { const gap = Math.min(i ? a[i] - a[i - 1] : 1, i < a.length - 1 ? a[i + 1] - a[i] : 1); c.dataset.w = String(Math.max(0.018, Math.min(0.05, gap * 0.48))); }); }

  let loaded = false;
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || loaded || reduce) return;
    loaded = true;
    const src = `media/journey${mobile ? "-sm" : ""}.mp4`;
    fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject(r.status))).then((b) => { film.src = URL.createObjectURL(b); }).catch(() => { film.src = src; });
  }, { rootMargin: "2500px 0px" }).observe(section);

  let J = reduce ? 1 : 0, target = J, shown = false;
  if (ScrollTrigger && !reduce) ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { target = s.progress; } });

  function frame(now, dt) {
    J += (target - J) * Math.min(1, dt * 5);
    const d = film.duration;
    if (d && film.readyState >= 1 && !film.seeking) {
      const t = J * (d - 0.04);
      if (Math.abs(film.currentTime - t) > 1 / 40) film.currentTime = t;
    }
    // readyState dips while a frame is being sought; once the film has shown a frame, the poster stays hidden
    if (!shown && film.readyState >= 2) { shown = true; poster.style.opacity = "0"; }
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
