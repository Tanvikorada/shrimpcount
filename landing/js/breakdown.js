// BREAKDOWN: the five real processing layers of one count. The photo tilts into a 3D stack, each step lifts and
// lights up in turn while a step rail explains it, then the stack settles into the marked photo and the count lands.
import * as THREE from "three";
import { clamp01, ease, easeIO, lerp, band, whileVisible, makeRenderer } from "./larva.js";

const FILES = ["1_photo", "2_outline", "3_heat", "4_spots", "5_marked"];
const GLOW = new Set([2, 3]); // dark-background layers glow over the ones below
const STEP0 = 0.2, STEP = 0.1;  // step k is in focus over [STEP0 + k*STEP, STEP0 + (k+1)*STEP]
const COUNT = 2191;             // real marks our counter found on this tray (media/tray-marks.json)

export function initBreakdown({ ScrollTrigger, reduce, fmt }) {
  const section = document.getElementById("inside");
  const canvas = document.getElementById("layers-gl");
  const steps = [...section.querySelectorAll(".steps li")];
  const rail = section.querySelector(".steps");
  const result = section.querySelector(".inside-result");
  const resultNum = section.querySelector("#inside-count");
  const mobileCap = section.querySelector(".step-cap");
  let renderer;
  try { renderer = makeRenderer(canvas); } catch { return; }
  const mobile = window.innerWidth < 860;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const PW = 4, PH = 4 * 896 / 1200;
  const stack = new THREE.Group(); scene.add(stack);
  const loader = new THREE.TextureLoader();
  const layers = FILES.map((f, i) => {
    const g = new THREE.Group();
    const tex = loader.load(`media/layers/${f}.jpg`); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(PW, PH); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: i === 0 ? 1 : 0, depthWrite: !GLOW.has(i), blending: GLOW.has(i) ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = i; g.add(mesh);
    // a thin glass edge so each layer reads as a slab; the active one glows coral
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(PW, 0.025, PH)), new THREE.LineBasicMaterial({ color: 0xa6efe6, transparent: true, opacity: 0 }));
    g.add(edge);
    stack.add(g);
    return { g, mat, edge, lift: 0 };
  });

  // data rising through the open stack
  const NP = mobile ? 220 : 480;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(NP * 3), pSpd = new Float32Array(NP);
  for (let i = 0; i < NP; i++) { pPos[i * 3] = (Math.random() - 0.5) * PW * 0.9; pPos[i * 3 + 1] = Math.random() * 4; pPos[i * 3 + 2] = (Math.random() - 0.5) * PH * 0.9; pSpd[i] = 0.3 + Math.random() * 0.7; }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x6fe3d6, size: mobile ? 0.045 : 0.035, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  stack.add(new THREE.Points(pGeo, pMat));

  // a soft glow pool under the stack
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(63,214,198,0.5)"); r.addColorStop(1, "rgba(63,214,198,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const glowGeo = new THREE.PlaneGeometry(10, 10); glowGeo.rotateX(-Math.PI / 2);
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = -0.6; scene.add(glow);

  let W = 1, H = 1;
  function layout() { W = canvas.clientWidth; H = canvas.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
  layout(); window.addEventListener("resize", layout);

  let mx = 0, my = 0, sx = 0, sy = 0;
  section.addEventListener("pointermove", (e) => { mx = (e.clientX / window.innerWidth) * 2 - 1; my = (e.clientY / window.innerHeight) * 2 - 1; });

  let p = reduce ? 0.97 : 0, target = p, shownStep = -1, shownN = -1;
  if (ScrollTrigger && !reduce) ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { target = s.progress; } });

  function frame(now, dt) {
    p += (target - p) * Math.min(1, dt * 6);
    sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05;
    const open = easeIO(band(p, 0.06, 0.2)) * (1 - easeIO(band(p, 0.7, 0.8)));
    const tiltK = easeIO(band(p, 0.04, 0.18)) * (1 - easeIO(band(p, 0.72, 0.82)));
    const gap = (mobile ? 0.6 : 0.78) * open;
    const k = (p - STEP0) / STEP;                         // which step is in focus (fractional)
    const active = Math.max(0, Math.min(4, Math.floor(k)));
    const inSteps = p >= STEP0 - 0.02 && p < STEP0 + 5 * STEP;

    layers.forEach((L, i) => {
      const appear = i === 0 ? 1 : ease(band(p, 0.1 + i * 0.03, 0.16 + i * 0.03));
      const focus = inSteps ? clamp01(1 - Math.abs(k - (i + 0.5)) * 1.25) : 0;   // 1 in the middle of its step
      L.lift += ((inSteps && i === active ? 0.22 : 0) - L.lift) * Math.min(1, dt * 6);
      L.g.position.y = i * gap + L.lift * open;
      const dim = inSteps && i !== active ? (i < active ? 0.45 : 0.3) : 1;
      const keep = i === layers.length - 1 ? 1 : 1 - band(p, 0.76, 0.82);
      L.mat.opacity = appear * keep * lerp(1, dim, open);
      L.edge.material.color.setHex(i === active && inSteps ? 0x3fd6c6 : 0xa6efe6);
      L.edge.material.opacity = appear * open * (0.18 + 0.7 * focus);
    });

    // a gentle turn with the scroll and the pointer, no full spin
    stack.rotation.y = lerp(-0.55, 0.35, easeIO(band(p, 0.08, 0.76))) * tiltK + sx * 0.12 * open;
    const top = 4 * gap;
    for (let i = 0; i < NP; i++) { pPos[i * 3 + 1] += pSpd[i] * dt; if (pPos[i * 3 + 1] > top) pPos[i * 3 + 1] = 0; }
    pGeo.attributes.position.needsUpdate = true;
    pMat.opacity = 0.7 * clamp01((open - 0.3) / 0.7);
    glow.material.opacity = 0.8 * open;

    const elev = lerp(Math.PI / 2 - 0.001, mobile ? 0.66 : 0.56, tiltK) - sy * 0.04 * open;
    const settle = ease(band(p, 0.76, 0.86));
    const dist = (mobile ? 15.5 : 10.6) + (mobile ? 3.2 : 2.2) * open - (mobile ? 0.2 : 1.2) * settle;
    camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(0, top * 0.45, 0);
    // desktop: the stack sits right of the step rail, and right of the number at the end
    camera.setViewOffset(W, H, mobile ? 0 : -W * 0.17, mobile ? -H * (0.06 * open + 0.02 * settle) : -H * 0.07 * open, W, H);

    // step rail
    const railV = clamp01((p - (STEP0 - 0.05)) / 0.04) * (1 - clamp01((p - (STEP0 + 5 * STEP)) / 0.03));
    rail.style.opacity = String(railV); rail.style.transform = `translateY(${(1 - railV) * 16}px)`;
    if (active !== shownStep) {
      steps.forEach((s, i) => { s.classList.toggle("on", i === active); s.classList.toggle("past", i < active); });
      if (mobileCap) mobileCap.innerHTML = steps[active].querySelector(".st-t").outerHTML;
      shownStep = active;
    }
    steps.forEach((s, i) => s.style.setProperty("--f", String(i === active ? clamp01(k - i) : i < active ? 1 : 0)));
    if (mobileCap) mobileCap.style.opacity = String(railV);

    // the payoff: the number lands
    const rv = ease(band(p, 0.78, 0.84));
    result.style.opacity = String(rv); result.style.transform = `translateY(${(1 - rv) * 26}px)`;
    result.classList.toggle("on", rv > 0.6);
    const n = Math.round(COUNT * ease(band(p, 0.78, 0.87)));
    if (n !== shownN) { resultNum.textContent = fmt.format(n); shownN = n; }

    renderer.render(scene, camera);
  }
  whileVisible(section, frame);
  frame(performance.now(), 0.016);
}
