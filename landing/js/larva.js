import * as THREE from "three";

// A shrimp post-larva seen from above, head to the right: glassy segmented body, tail fan,
// dark eyes on short stalks, a rostrum and two long antennae. Drawn into ctx within a w x h box.
export function drawLarva(g, w, h, alpha = 1) {
  const cy = h / 2, s = h / 64;
  g.save(); g.globalAlpha = alpha;
  // antennae
  g.strokeStyle = "rgba(150,140,120,0.45)"; g.lineWidth = 1.1 * s; g.lineCap = "round";
  g.beginPath(); g.moveTo(w * 0.9, cy - 3 * s); g.quadraticCurveTo(w * 0.97, cy - 16 * s, w * 1.0, cy - 26 * s); g.stroke();
  g.beginPath(); g.moveTo(w * 0.9, cy + 3 * s); g.quadraticCurveTo(w * 0.97, cy + 16 * s, w * 1.0, cy + 26 * s); g.stroke();
  // tail fan (telson and uropods)
  g.fillStyle = "rgba(170,160,140,0.35)";
  g.beginPath(); g.moveTo(w * 0.1, cy); g.lineTo(w * 0.0, cy - 9 * s); g.quadraticCurveTo(w * 0.035, cy, w * 0.0, cy + 9 * s); g.closePath(); g.fill();
  // body: abdomen tapering to the tail, fuller carapace at the head
  const grad = g.createLinearGradient(w * 0.05, 0, w * 0.9, 0);
  grad.addColorStop(0, "rgba(175,165,145,0.30)"); grad.addColorStop(0.55, "rgba(150,138,115,0.55)"); grad.addColorStop(1, "rgba(120,105,85,0.75)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w * 0.08, cy);
  g.bezierCurveTo(w * 0.3, cy - 5 * s, w * 0.55, cy - 8 * s, w * 0.72, cy - 9 * s);
  g.bezierCurveTo(w * 0.84, cy - 9.5 * s, w * 0.9, cy - 6 * s, w * 0.96, cy);
  g.bezierCurveTo(w * 0.9, cy + 6 * s, w * 0.84, cy + 9.5 * s, w * 0.72, cy + 9 * s);
  g.bezierCurveTo(w * 0.55, cy + 8 * s, w * 0.3, cy + 5 * s, w * 0.08, cy);
  g.fill();
  // segments
  g.strokeStyle = "rgba(95,85,68,0.35)"; g.lineWidth = 1 * s;
  for (let i = 0; i < 6; i++) { const x = w * (0.22 + i * 0.075); const hh = (3.5 + i * 1) * s; g.beginPath(); g.moveTo(x, cy - hh); g.quadraticCurveTo(x + 2 * s, cy, x, cy + hh); g.stroke(); }
  // gut line
  g.strokeStyle = "rgba(90,70,50,0.35)"; g.lineWidth = 1.4 * s;
  g.beginPath(); g.moveTo(w * 0.15, cy); g.lineTo(w * 0.78, cy); g.stroke();
  // rostrum
  g.strokeStyle = "rgba(120,105,85,0.7)"; g.lineWidth = 1.6 * s;
  g.beginPath(); g.moveTo(w * 0.9, cy); g.lineTo(w * 0.99, cy); g.stroke();
  // eyes on short stalks
  g.fillStyle = "#16110b";
  g.beginPath(); g.ellipse(w * 0.9, cy - 7.5 * s, 3.6 * s, 3 * s, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(w * 0.9, cy + 7.5 * s, 3.6 * s, 3 * s, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function larvaCanvas(w = 256, h = 64) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  drawLarva(c.getContext("2d"), w, h);
  return c;
}

export function larvaTexture() {
  const t = new THREE.CanvasTexture(larvaCanvas(256, 64));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const ease = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeIO = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const band = (p, a, b) => clamp01((p - a) / (b - a));

// Run tick() every frame while el is on screen.
export function whileVisible(el, tick) {
  let on = false, last = performance.now();
  const loop = (t) => { if (!on) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; tick(t, dt); requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => {
    const was = on; on = e.isIntersecting;
    if (on && !was) { last = performance.now(); requestAnimationFrame(loop); }
  }).observe(el);
}

export function makeRenderer(canvas, opts = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !opts.opaque, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  return r;
}
