import { initHero } from "./hero.js";
import { initBreakdown } from "./breakdown.js";
import { initJourney } from "./journey.js";
import { clamp01, whileVisible } from "./larva.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = new Intl.NumberFormat("en-IN");
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// ---------- Contact, language, install ----------
const MAILTO = `mailto:tanvikorada@gmail.com?subject=${encodeURIComponent("ShrimpCount access")}&body=${encodeURIComponent("Hatchery: \nI'd like to start using ShrimpCount. Please send login details.")}`;
document.querySelectorAll("[data-mail]").forEach((a) => { a.href = MAILTO; });

(() => {
  const select = document.getElementById("lang");
  const nodes = [...document.querySelectorAll("[data-i18n]")];
  nodes.forEach((n) => { n.dataset.en = n.textContent; });
  let dict = null;
  const apply = (lang) => {
    document.documentElement.lang = lang;
    nodes.forEach((n) => {
      let s = lang === "en" || !dict ? n.dataset.en : (dict.t[lang]?.[n.dataset.i18n] ?? n.dataset.en);
      if (n.dataset.n) s = s.replace("{n}", n.dataset.n);
      n.textContent = s;
    });
  };
  select.value = store.get("sc-lang") || (/^(te|hi|ta)/.exec(navigator.language || "") || ["en"])[0];
  fetch("i18n.json").then((r) => r.json()).then((d) => { dict = d; apply(select.value); }).catch(() => {});
  select.addEventListener("change", () => { store.set("sc-lang", select.value); apply(select.value); });
})();

// The app lives at /app/ on this same site. Chrome can install it straight from this page; iPhone gets the steps.
(() => {
  let prompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); prompt = e; });
  const sheet = document.getElementById("ios-sheet");
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  document.querySelectorAll("[data-install]").forEach((b) => b.addEventListener("click", async () => {
    if (prompt) { const p = prompt; prompt = null; await p.prompt(); return; }
    if (ios) { sheet.showModal(); return; }
    window.location.href = "/app/";
  }));
  sheet.querySelector("[data-close]").addEventListener("click", () => sheet.close());
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
})();

// ---------- Smooth scroll ----------
const { gsap, ScrollTrigger, Lenis } = window;
if (gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  if (!reduce && Lenis) {
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (el) { e.preventDefault(); lenis.scrollTo(el); }
    }));
  }
}

// ---------- Soft dips to black between the pinned scenes ----------
if (ScrollTrigger && !reduce) {
  [["hero", false], ["inside", true], ["journey", true]].forEach(([id, fadeIn]) => {
    const sec = document.getElementById(id);
    const stage = sec.firstElementChild;
    const veil = document.createElement("div"); veil.className = "veil"; stage.appendChild(veil);
    ScrollTrigger.create({ trigger: sec, start: "top bottom", end: "bottom top", onUpdate: () => {
      const r = sec.getBoundingClientRect(), vh = window.innerHeight;
      const inP = fadeIn ? clamp01(r.top / vh) : 0;                         // still arriving from below
      const leave = clamp01(1 - (r.bottom - vh) / (vh * (id === "journey" ? 0.9 : 0.4)));  // end of the pinned run
      veil.style.opacity = String(Math.max(inP, leave));
    } });
  });
}

// ---------- The 3D scenes ----------
const ctx = { ScrollTrigger, reduce, fmt };
initHero(ctx);
initBreakdown(ctx);
initJourney(ctx);

// ---------- THE APP: a phone that leans toward the pointer, real screens, floating badges ----------
(() => {
  const wrap = document.getElementById("phone3d");
  const phone = wrap.querySelector(".phone");
  const floats = [...wrap.querySelectorAll(".float")];
  const scr = [...phone.querySelectorAll(".scr")];
  const tabs = [...wrap.querySelectorAll(".phone-tabs button")];
  let cur = 0, auto = true, visible = false;
  const show = (i) => { cur = i; scr.forEach((s, j) => s.classList.toggle("is-on", j === i)); tabs.forEach((t, j) => t.classList.toggle("is-on", j === i)); };
  tabs.forEach((t, i) => t.addEventListener("click", () => { auto = false; show(i); }));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wrap);
  if (!reduce) setInterval(() => { if (auto && visible) show((cur + 1) % scr.length); }, 2600);
  if (reduce || window.innerWidth < 860) return;
  let rx = 6, ry = -16, tx = 6, ty = -16, fx = 0, fy = 0, tfx = 0, tfy = 0;
  window.addEventListener("pointermove", (e) => {
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth, y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
    ty = -16 + x * 24; tx = 6 - y * 16; tfx = x; tfy = y;
  });
  whileVisible(wrap, (t) => {
    rx += (tx - rx) * 0.08; ry += (ty - ry) * 0.08; fx += (tfx - fx) * 0.06; fy += (tfy - fy) * 0.06;
    phone.style.transform = `rotateY(${ry}deg) rotateX(${rx}deg)`;
    floats.forEach((f, i) => {
      const depth = [40, 60, 30][i], bob = Math.sin(t * 0.0012 + i * 2) * 6;
      f.style.transform = `translate3d(${fx * depth}px, ${fy * depth + bob}px, ${depth}px)`;
    });
  });
})();

// ---------- Spotlight that follows the pointer on the gains cards ----------
document.querySelectorAll(".spot").forEach((el) => el.addEventListener("pointermove", (e) => {
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`); el.style.setProperty("--my", `${e.clientY - r.top}px`);
}));

// ---------- Numbers count up, the accuracy ring fills, headings rise in ----------
if (gsap && ScrollTrigger && !reduce) {
  document.querySelectorAll(".count-up").forEach((el) => {
    const to = Number(el.dataset.to); const o = { v: to === 0 ? 5 : 0 };
    gsap.to(o, { v: to, duration: 1.4, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true }, onUpdate: () => { el.textContent = String(Math.round(o.v)); } });
  });
  const gf = document.getElementById("g-fill"), gn = document.getElementById("g-num");
  const g = { v: 0 };
  gsap.to(g, { v: 99, duration: 2.2, ease: "power3.out", scrollTrigger: { trigger: ".gauge", start: "top 80%", once: true }, onUpdate: () => { gf.style.strokeDashoffset = String(527.8 * (1 - g.v / 100)); gn.textContent = String(Math.round(g.v)); } });
  gsap.utils.toArray(".stat, .gain-col, .app-copy > *, .chips span, .acc-grid > div > *, .pricing .wrap > *, .faq h2, .final h2").forEach((el, i) => {
    gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: "power3.out", delay: (i % 6) * 0.04, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });
} else {
  document.getElementById("g-fill").style.strokeDashoffset = String(527.8 * 0.01);
  document.getElementById("g-num").textContent = "99";
  document.querySelectorAll(".count-up").forEach((el) => { el.textContent = el.dataset.to; });
}

// ---------- FINAL: glassy shrimp drifting behind the last call, darting away from the pointer ----------
// Side view reads as "shrimp" at any size; a top view at this scale reads as a stick.
function shrimpSprite() {
  const W = 320, H = 200, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const B = (t) => { const u = 1 - t; return [u * u * 250 + 2 * u * t * 150 + t * t * 58, u * u * 92 + 2 * u * t * 18 + t * t * 132]; };
  const rad = (t) => 7 + 25 * Math.pow(1 - t, 0.75);
  // antennae sweep back over the body
  g.strokeStyle = "rgba(205,238,232,0.5)"; g.lineWidth = 1.4; g.lineCap = "round";
  [[-10, 60], [-4, 90]].forEach(([dy, reach]) => { g.beginPath(); g.moveTo(262, 84); g.bezierCurveTo(300, 60 + dy, 250, 10 + dy, 262 - reach * 2.2, 26 + dy); g.stroke(); });
  // legs under the carapace and swimmerets under the tail
  g.strokeStyle = "rgba(190,228,222,0.55)"; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const [x, y] = B(0.06 + i * 0.05); g.beginPath(); g.moveTo(x, y + rad(0.06 + i * 0.05) * 0.7); g.quadraticCurveTo(x - 4, y + 30, x - 12, y + 40); g.stroke(); }
  for (let i = 0; i < 4; i++) { const t = 0.36 + i * 0.1, [x, y] = B(t); g.beginPath(); g.moveTo(x, y + rad(t) * 0.8); g.lineTo(x - 8, y + rad(t) + 14); g.stroke(); }
  // tail fan
  const [tx, ty] = B(1);
  g.fillStyle = "rgba(180,222,215,0.7)";
  [[-0.5, 34], [0.1, 38], [0.7, 32]].forEach(([a, L]) => { g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - Math.cos(a + 0.9) * L - 6, ty + Math.sin(a + 0.9) * L); g.lineTo(tx - Math.cos(a + 0.9) * L + 6, ty + Math.sin(a + 0.9) * L); g.closePath(); g.fill(); });
  // body: overlapping discs along the arched spine, lit from above
  for (let i = 0; i <= 120; i++) {
    const t = i / 120, [x, y] = B(t), r = rad(t);
    const gr = g.createRadialGradient(x, y - r * 0.45, r * 0.1, x, y, r);
    gr.addColorStop(0, "#eefaf8"); gr.addColorStop(0.55, "#a9d8d1"); gr.addColorStop(1, "#5e9790");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  // segment bands across the abdomen
  g.strokeStyle = "rgba(40,85,80,0.4)"; g.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) { const t = 0.3 + i * 0.1, [x, y] = B(t), [x2, y2] = B(t + 0.01), a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2, r = rad(t);
    g.beginPath(); g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.quadraticCurveTo(x + 5, y, x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
  // gut line, rostrum, eye
  g.strokeStyle = "rgba(70,55,40,0.5)"; g.lineWidth = 2.2; g.beginPath();
  for (let i = 0; i <= 40; i++) { const t = 0.08 + i * 0.022, [x, y] = B(t); i ? g.lineTo(x, y - rad(t) * 0.35) : g.moveTo(x, y - rad(t) * 0.35); } g.stroke();
  g.fillStyle = "#c4e9e3"; g.beginPath(); g.moveTo(250, 72); g.lineTo(304, 70); g.lineTo(252, 86); g.closePath(); g.fill();
  g.fillStyle = "#1a0f0b"; g.beginPath(); g.arc(262, 80, 6.5, 0, 6.2832); g.fill();
  g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(264, 78, 1.8, 0, 6.2832); g.fill();
  return c;
}
(() => {
  const c = document.getElementById("field");
  const x = c.getContext("2d");
  const sec = c.parentElement;
  let W = 0, H = 0, dpr = 1, mx = -999, my = -999;
  const N = window.innerWidth < 760 ? 16 : 34;
  const sprite = shrimpSprite();
  // z: 0 far and faint and small, 1 near and larger
  const P = Array.from({ length: N }, () => { const z = Math.random(); return { x: Math.random(), y: Math.random(), z, dir: Math.random() < 0.5 ? -1 : 1, tilt: 0, v: 0.00025 + z * 0.0005, boost: 0, ph: Math.random() * 6.28 }; }).sort((a, b) => a.z - b.z);
  const size = () => { const r = c.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); window.addEventListener("resize", size);
  sec.addEventListener("pointermove", (e) => { const r = c.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
  sec.addEventListener("pointerleave", () => { mx = my = -999; });
  const draw = (t, dt = 0.016) => {
    x.clearRect(0, 0, W, H);
    for (const p of P) {
      let px = p.x * W, py = p.y * H;
      if (!reduce) {
        const d = Math.hypot(px - mx, py - my);
        // shrimp escape backwards with a tail flick
        if (d < 140 && p.boost < 0.2) { p.boost = 1; p.dir = px > mx ? 1 : -1; }
        if (Math.random() < 0.0015) p.boost = Math.max(p.boost, 0.6);
        p.boost = Math.max(0, p.boost - dt * 1.4);
        p.tilt = Math.sin(t * 0.0007 + p.ph) * 0.18;
        const sp = p.v * W * (1 + p.boost * 9);
        px += p.dir * Math.cos(p.tilt) * sp; py += Math.sin(p.tilt) * sp * 0.6 + Math.sin(t * 0.0011 + p.ph) * 0.15;
        const m = 120;
        if (px < -m) px = W + m; if (px > W + m) px = -m; if (py < -m) py = H + m; if (py > H + m) py = -m;
        p.x = px / W; p.y = py / H;
      }
      const L = 34 + p.z * 70, kick = Math.sin(t * 0.02 + p.ph) * p.boost * 0.25;
      x.save(); x.translate(px, py); x.scale(p.dir, 1); x.rotate(p.dir * p.tilt + kick);
      x.globalAlpha = 0.14 + p.z * 0.36;
      x.drawImage(sprite, -L / 2, -L * 0.31, L, L * 0.625); x.restore();
    }
  };
  if (reduce) { draw(0); return; }
  whileVisible(sec, (t, dt) => draw(t, dt));
})();

// ---------- Background loop that plays only on screen ----------
(() => {
  if (reduce) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { if (!v.getAttribute("src")) v.src = v.dataset.src; v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    }
  }, { rootMargin: "200px" });
  document.querySelectorAll("video[data-src]").forEach((v) => io.observe(v));
})();

window.addEventListener("load", () => ScrollTrigger && ScrollTrigger.refresh());
