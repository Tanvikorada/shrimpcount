// FLIGHT3D (used by journey.js for the inside of the shed and the tank): one unbroken drone flight: in from the sea to a seaside hatchery, down into a shed, along the raceway
// tanks, over a sample bowl of larvae, then up into the sky and on to the real pond footage.
// The world is simple 3D geometry, but what you see on it is photographs: photoreal frames made from guide renders
// of this same scene are projected back onto the geometry from the poses they were rendered at (camera projection
// mapping), and the flight blends between neighbouring projectors. Anything no photo covers falls back to the render.
import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { Sky } from "three/addons/objects/Sky.js";
import { larvaTexture, clamp01, smooth, lerp, band, whileVisible, makeRenderer } from "./larva.js";

const SPLIT = 0.62; // share of the section given to the hatchery flight; the rest is the pond film
// projector photos: [flight progress j, paints inside the entry shed (1) or outside it (0)].
// Each was made from a guide render at exactly that j (see _render.html). The side flag stops a photo taken
// outside from painting its made-up view through the door onto the real interior, and the other way round.
const PHOTOS = [[0, 0], [0.16, 0], [0.32, 0], [0.44, 0], [0.5, 0], [0.56, 1], [0.66, 1], [0.76, 1]];
const photoUrl = (j, sm) => `media/journey/${sm ? "sm/" : ""}p${String(Math.round(j * 100)).padStart(3, "0")}.webp`;
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- procedural textures ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
const noise = (g, w, h, n, colors, rmin, rmax, a = 0.35) => {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[(Math.random() * colors.length) | 0]; g.globalAlpha = a * Math.random(); const r = rmin + Math.random() * (rmax - rmin); g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, 6.28); g.fill(); }
  g.globalAlpha = 1;
};
const texGround = () => canvasTex(2048, 1024, (g, w, h) => {
  g.fillStyle = "#6b7446"; g.fillRect(0, 0, w, h);
  // fields and scrub in irregular plots
  const cols = ["#5f6b3a", "#7c8150", "#8d8a5c", "#56643a", "#6f7a45", "#94906a", "#4c5a31", "#7a7250"];
  for (let i = 0; i < 520; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.globalAlpha = 0.55 + Math.random() * 0.45; g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 120, 14 + Math.random() * 70); }
  g.globalAlpha = 1;
  noise(g, w, h, 4000, ["#3f4f2a", "#4a5a2c", "#3a4726"], 2, 9, 0.5);   // trees and bushes
  noise(g, w, h, 6000, ["#9a9466", "#7b6f4c", "#a8a07a"], 1, 3, 0.4);  // soil
  g.strokeStyle = "rgba(140,128,98,0.5)"; g.lineWidth = 2;               // dirt tracks
  for (let i = 0; i < 26; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 300; y += (Math.random() - 0.5) * 160; g.lineTo(x, y); } g.stroke(); }
}, [1, 1]);
const texSand = () => canvasTex(512, 512, (g, w, h) => { g.fillStyle = "#d8c7a3"; g.fillRect(0, 0, w, h); noise(g, w, h, 2500, ["#cbb690", "#e6d8b8", "#bfa983"], 1, 5); }, [30, 6]);
const texConcrete = (base = "#8c8a84") => canvasTex(512, 512, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); noise(g, w, h, 1400, ["#77756f", "#9d9b95", "#6c6a64", "#a5a39c"], 2, 18, 0.25); }, [6, 6]);
const texRoof = (tint) => canvasTex(256, 64, (g, w, h) => {
  for (let x = 0; x < w; x++) { const v = 0.5 + 0.5 * Math.sin((x / w) * Math.PI * 2 * 16); const c = Math.round(150 + 70 * v); g.fillStyle = `rgb(${c * tint[0]},${c * tint[1]},${c * tint[2]})`; g.fillRect(x, 0, 1, h); }
  noise(g, w, h, 200, ["#6b6158", "#8a7a66"], 1, 6, 0.25);
}, [1, 6]);
const texWall = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#d9ddda"; g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, h, 0, h * 0.55); gr.addColorStop(0, "rgba(120,110,90,0.55)"); gr.addColorStop(1, "rgba(120,110,90,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  noise(g, w, h, 260, ["#b8b39f", "#9c9785", "#a9b0ad"], 3, 22, 0.22);
  for (let i = 0; i < 18; i++) { const x = Math.random() * w; const gr2 = g.createLinearGradient(0, 0, 0, h * 0.7); gr2.addColorStop(0, "rgba(110,100,80,0.25)"); gr2.addColorStop(1, "rgba(110,100,80,0)"); g.fillStyle = gr2; g.fillRect(x, 0, 2 + Math.random() * 5, h * 0.7); }
}, [4, 1]);
const texNet = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#0f3b2c"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(170,210,190,0.55)"; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
  noise(g, w, h, 900, ["#154a37", "#0b2e22"], 1, 2, 0.5);
}, [10, 10]);
const texFrond = () => canvasTex(128, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = "#4a5a22"; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 0); g.stroke();
  for (let y = 20; y < h; y += 10) { const len = (w / 2) * Math.sin((y / h) * Math.PI) * 0.95; g.strokeStyle = y % 20 ? "#5f7a2c" : "#4d6a25"; g.lineWidth = 5;
    g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - len, y - 18); g.stroke(); g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + len, y - 18); g.stroke(); }
});

export function initJourney({ ScrollTrigger, reduce }) {
  const section = document.getElementById("journey");
  const canvas = document.getElementById("journey-gl");
  const video = section.querySelector(".film-video");
  const haze = section.querySelector(".haze");
  const caps = [...section.querySelectorAll(".j-cap")];
  let renderer;
  try { renderer = makeRenderer(canvas, { opaque: true, maxDpr: 1.75 }); } catch { renderer = null; }
  const mobile = window.innerWidth < 760;

  // ---------- pond film (second half) ----------
  let filmLoaded = false;
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || filmLoaded || reduce) return;
    filmLoaded = true;
    const src = mobile ? "media/farm-scrub-sm.mp4" : "media/farm-scrub.mp4";
    fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject(r.status))).then((b) => { video.src = URL.createObjectURL(b); }).catch(() => { video.src = src; });
  }, { rootMargin: "2000px 0px" }).observe(section);

  let J = reduce ? 1 : 0, target = J;
  if (ScrollTrigger && !reduce) ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { target = s.progress; } });

  let render3D = null;
  try { render3D = renderer ? build3D(renderer, canvas, mobile, { photos: !location.search.includes("noproj") }) : null; } catch { render3D = null; }
  // hatchery captions were placed on the keyframe timeline; move them to where those moments now fall
  if (render3D) {
    caps.forEach((c) => { const at = Number(c.dataset.at); if (at < SPLIT) c.dataset.at = String(render3D.scrollFor(Math.min(0.995, at / SPLIT)) * SPLIT); });
    // keep each caption's fade inside the gap to its neighbours so two never show at once
    const at = caps.map((c) => Number(c.dataset.at));
    caps.forEach((c, i) => {
      const gap = Math.min(i ? at[i] - at[i - 1] : 1, i < at.length - 1 ? at[i + 1] - at[i] : 1);
      c.dataset.w = String(Math.min(Number(c.dataset.w || 0.06), gap * 0.5));
    });
  }

  function frame(now, dt) {
    J += (target - J) * Math.min(1, dt * 3.5);
    const j3 = band(J, 0, SPLIT);
    const filmIn = smooth(band(J, SPLIT - 0.045, SPLIT - 0.005));
    haze.style.opacity = String(Math.max(0, Math.sin(Math.PI * band(J, SPLIT - 0.05, SPLIT + 0.01))) * 0.75);
    video.style.opacity = String(filmIn);
    video.style.transform = `scale(${1.12 - 0.12 * smooth(band(J, SPLIT - 0.045, SPLIT + 0.05))})`;
    canvas.style.opacity = String(1 - filmIn);
    canvas.style.filter = filmIn > 0.01 ? `blur(${(filmIn * 6).toFixed(1)}px)` : "";
    if (render3D && filmIn < 1) render3D(j3, now, dt);
    const fp = band(J, SPLIT, 1);
    const d = video.duration;
    if (filmIn > 0 && d && video.readyState >= 1 && !video.seeking) {
      const t = fp * (d - 0.05);
      if (Math.abs(video.currentTime - t) > 1 / 30) video.currentTime = t;
    }
    caps.forEach((c) => {
      const o = clamp01((1 - Math.abs(J - Number(c.dataset.at)) / Number(c.dataset.w || 0.06)) * 1.7);
      c.style.opacity = String(o); c.style.transform = `translateY(${(1 - o) * 30}px)`;
    });
  }
  whileVisible(section, frame);
  frame(performance.now(), 0.016);
}

export function build3D(renderer, canvas, mobile, opts = {}) {
  const rnd = mulberry32(20260926);
  renderer.toneMappingExposure = 0.55;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // the sun and the buildings never move: draw the shadows once, not every frame
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mobile ? 62 : 48, 1, 0.08, 15000);

  // sky and sun: early morning over the coast
  const sky = new Sky(); sky.scale.setScalar(10000); scene.add(sky);
  const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 14), THREE.MathUtils.degToRad(160));
  Object.assign(sky.material.uniforms.turbidity, { value: 6 }); sky.material.uniforms.rayleigh.value = 1.6;
  sky.material.uniforms.mieCoefficient.value = 0.006; sky.material.uniforms.mieDirectionalG.value = 0.85; sky.material.uniforms.sunPosition.value.copy(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene(); const skyCopy = new Sky(); skyCopy.scale.setScalar(10000); skyCopy.material.uniforms.sunPosition.value.copy(sun);
  skyCopy.material.uniforms.turbidity.value = 6; skyCopy.material.uniforms.rayleigh.value = 1.6; skyScene.add(skyCopy);
  const env = pmrem.fromScene(skyScene).texture; scene.environment = env;
  scene.fog = new THREE.FogExp2(0xbfcbd2, 0.0011);

  const sunLight = new THREE.DirectionalLight(0xfff0dc, 3.2); sunLight.position.copy(sun).multiplyScalar(400);
  sunLight.castShadow = !mobile; sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 10, far: 900 });
  scene.add(sunLight); scene.add(new THREE.HemisphereLight(0xcfe3f2, 0x4a4a3a, 0.9));

  // the sea
  const normals = new THREE.TextureLoader().load("media/waternormals.jpg", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const sea = new Water(new THREE.PlaneGeometry(6000, 6000), { textureWidth: 512, textureHeight: 512, waterNormals: normals, sunDirection: sun.clone(), sunColor: 0xfff0dc, waterColor: 0x0d3b47, distortionScale: 2.6, fog: true });
  sea.rotation.x = -Math.PI / 2; sea.position.y = 0; scene.add(sea);

  // land and beach (the coast runs along x; land is z < 70)
  const land = new THREE.Mesh(new THREE.PlaneGeometry(1400, 800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texGround(), roughness: 0.95 }));
  land.position.set(0, 0.6, -330); land.receiveShadow = true; scene.add(land);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(1400, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texSand(), roughness: 1 }));
  beach.position.set(0, 0.3, 98); beach.receiveShadow = true; scene.add(beach);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(190, 150).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texConcrete("#a09c92"), roughness: 0.9 }));
  yard.position.set(0, 0.62, -10); yard.receiveShadow = true; scene.add(yard);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3d3f41, roughness: 0.85 }));
  road.position.set(120, 0.63, -300); scene.add(road);

  // ---------- sheds: long gable-roof buildings, gable end facing the sea ----------
  const SW = 22, SL = 48, WH = 5, RH = 3.6;
  const wallMat = new THREE.MeshStandardMaterial({ map: texWall(), roughness: 0.85, side: THREE.DoubleSide });
  const roofMats = [[0.62, 0.72, 0.82], [0.75, 0.78, 0.8], [0.55, 0.68, 0.78]].map((t) => new THREE.MeshStandardMaterial({ map: texRoof(t), roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }));
  const gableShape = (door) => {
    const s = new THREE.Shape(); s.moveTo(-SW / 2, 0); s.lineTo(SW / 2, 0); s.lineTo(SW / 2, WH); s.lineTo(0, WH + RH); s.lineTo(-SW / 2, WH); s.closePath();
    if (door) { const h = new THREE.Path(); h.moveTo(-2.6, 0.05); h.lineTo(2.6, 0.05); h.lineTo(2.6, 4.3); h.lineTo(-2.6, 4.3); h.closePath(); s.holes.push(h); }
    const geo = new THREE.ShapeGeometry(s), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((uv.getX(i) + SW / 2) / SW) * 2, uv.getY(i) / WH);
    return geo;
  };
  function shed(x, z, roof, door) {
    const g = new THREE.Group(); g.position.set(x, 0.62, z);
    const side = new THREE.PlaneGeometry(SL, WH);
    [-1, 1].forEach((sgn) => { const m = new THREE.Mesh(side, wallMat); m.rotation.y = Math.PI / 2; m.position.set(sgn * SW / 2, WH / 2, 0); m.castShadow = m.receiveShadow = true; g.add(m); });
    const front = new THREE.Mesh(gableShape(door), wallMat); front.position.z = SL / 2; front.castShadow = true; g.add(front);
    const back = new THREE.Mesh(gableShape(false), wallMat); back.position.z = -SL / 2; g.add(back);
    const slope = Math.hypot(SW / 2 + 0.8, RH), ang = Math.atan2(RH, SW / 2 + 0.8);
    [-1, 1].forEach((sgn) => {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(slope, SL + 1.6).rotateX(-Math.PI / 2), roofMats[roof]);
      r.rotation.z = -sgn * ang; r.position.set(sgn * (SW / 4 + 0.2), WH + RH / 2, 0); r.castShadow = r.receiveShadow = true; g.add(r);
    });
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, SL + 1.6), roofMats[roof]); ridge.position.y = WH + RH + 0.05; g.add(ridge);
    scene.add(g);
    return g;
  }
  const SHEDS = [[-58, 14, 0], [-29, 14, 1], [0, 14, 2, true], [29, 14, 0], [58, 14, 1], [-43, -44, 2], [-14, -44, 0], [15, -44, 1], [44, -44, 2]];
  let entry = null;
  SHEDS.forEach(([x, z, r, d]) => { const g = shed(x, z, r, d); if (d) entry = g; });

  // yard details: water storage tanks, an office, a boundary wall, the sea-water intake pipe, palms
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x2f6f9f, roughness: 0.4, metalness: 0.2 });
  [[82, 30], [82, 44], [92, 37]].forEach(([x, z]) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 7, 32), tankMat); t.position.set(x, 4.1, z); t.castShadow = true; scene.add(t); });
  const office = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 10), new THREE.MeshStandardMaterial({ color: 0xece8df, roughness: 0.8 })); office.position.set(86, 4.1, -12); office.castShadow = true; scene.add(office);
  const wallM = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 });
  [[0, 50, 200, 0.4], [0, -80, 200, 0.4], [100, -15, 0.4, 130], [-100, -15, 0.4, 130]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), wallM); m.position.set(x, 1.7, z); scene.add(m); });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 170, 12), new THREE.MeshStandardMaterial({ color: 0x9aa1a3, roughness: 0.5, metalness: 0.4 }));
  pipe.rotation.x = Math.PI / 2; pipe.position.set(70, 0.8, 130); scene.add(pipe);
  const frondTex = texFrond(); const frondMat = new THREE.MeshStandardMaterial({ map: frondTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a6650, roughness: 1 });
  function palm(x, z, h) {
    const g = new THREE.Group(); g.position.set(x, 0.6, z); g.rotation.set((rnd() - 0.5) * 0.12, rnd() * 6, (rnd() - 0.5) * 0.12);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, h, 7), trunkMat); trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 5.2), frondMat); f.geometry.translate(0, 2.6, 0);
      f.position.y = h; f.rotation.set(1.05 + rnd() * 0.35, (i / 9) * Math.PI * 2, 0, "YXZ"); f.castShadow = true; g.add(f);
    }
    scene.add(g);
  }
  for (let i = 0; i < 46; i++) { const x = -220 + i * 9.5 + rnd() * 4; if (Math.abs(x - 8) < 26) continue; palm(x, 66 + rnd() * 16, 9 + rnd() * 5); }
  for (let i = 0; i < 18; i++) palm(-110 + rnd() * 220, -95 - rnd() * 60, 8 + rnd() * 5);

  // inland: grow-out ponds in a grid of earthen bunds, paddle-wheel froth on each
  const pondMat = new THREE.MeshStandardMaterial({ color: 0x1d3833, roughness: 0.4, metalness: 0, envMapIntensity: 0.35, normalMap: normals, normalScale: new THREE.Vector2(0.25, 0.25) });
  const bundMat = new THREE.MeshStandardMaterial({ color: 0x8b7d5e, roughness: 1 });
  const pondGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const ponds = new THREE.InstancedMesh(pondGeo, pondMat, 140), bunds = new THREE.InstancedMesh(pondGeo, bundMat, 140);
  const pondFroth = [];
  let pi = 0; const pm = new THREE.Matrix4();
  for (let cx = -330; cx < 330 && pi < 140; cx += 58) for (let cz = -150; cz > -600 && pi < 140; cz -= 50) {
    if (Math.abs(cx - 120) < 40 || rnd() < 0.12) continue;
    const pw = 44 + rnd() * 8, pd = 36 + rnd() * 8;
    bunds.setMatrixAt(pi, pm.compose(new THREE.Vector3(cx, 0.66, cz), new THREE.Quaternion(), new THREE.Vector3(pw + 5, 1, pd + 5)));
    ponds.setMatrixAt(pi, pm.compose(new THREE.Vector3(cx, 0.7, cz), new THREE.Quaternion(), new THREE.Vector3(pw, 1, pd)));
    for (let a = 0; a < 4; a++) pondFroth.push(cx + (a % 2 ? 1 : -1) * pw * 0.28, 0.75, cz + (a < 2 ? 1 : -1) * pd * 0.28);
    pi++;
  }
  ponds.count = bunds.count = pi; ponds.receiveShadow = true; scene.add(bunds, ponds);

  // ---------- inside the entry shed: raceways, shade net, tube lights (after the reference photos) ----------
  const inside = new THREE.Group(); entry.add(inside);
  const floorIn = new THREE.Mesh(new THREE.PlaneGeometry(SW, SL).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texConcrete("#6f6a60"), roughness: 0.18, metalness: 0.15 }));
  floorIn.position.y = 0.02; inside.add(floorIn);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(SW, SL).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: texNet(), roughness: 0.9, emissive: 0x0c3325, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  net.position.y = WH - 0.05; inside.add(net);
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe9f5ff, emissiveIntensity: 6 });
  for (let z = -20; z <= 20; z += 8) {
    [-SW / 2 + 0.2, SW / 2 - 0.2].forEach((x) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.3), tubeMat); t.position.set(x, 3.6, z); inside.add(t); });
    [-5.5, 5.5].forEach((x) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.3), tubeMat); t.position.set(x, WH - 0.15, z); inside.add(t); });
  }
  for (let z = -18; z <= 18; z += 12) [-5, 5].forEach((x) => { const l = new THREE.PointLight(0xe8f4ff, 30, 20, 1.6); l.position.set(x, 4.2, z); inside.add(l); });

  // raceway tanks: two long rows either side of the walkway, split into sections
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xaeb6b8, roughness: 0.35, metalness: 0.05 });
  const tankNormals = new THREE.TextureLoader().load("media/waternormals.jpg", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1f1d14, roughness: 0.08, metalness: 0.2, normalMap: tankNormals, normalScale: new THREE.Vector2(0.9, 0.9) });
  const RIM = 1.25, WX0 = 1.3, WX1 = 10.2, THK = 0.3;
  const sections = [[-22, -11.5], [-11.2, -0.5], [-0.2, 10.5], [10.8, 21.5]];
  const tankWater = [];
  [-1, 1].forEach((sgn) => {
    sections.forEach(([z0, z1]) => {
      const cx = sgn * (WX0 + WX1) / 2, w = WX1 - WX0, len = z1 - z0, cz = (z0 + z1) / 2;
      const mk = (bw, bh, bd, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), rimMat); m.position.set(x, y, z); inside.add(m); };
      mk(THK, RIM, len, sgn * WX0, RIM / 2, cz); mk(THK, RIM, len, sgn * WX1, RIM / 2, cz);
      mk(w, RIM, THK, cx, RIM / 2, z0); mk(w, RIM, THK, cx, RIM / 2, z1);
      const wm = new THREE.Mesh(new THREE.PlaneGeometry(w - THK, len - THK).rotateX(-Math.PI / 2), waterMat); wm.position.set(cx, RIM - 0.15, cz); inside.add(wm); tankWater.push(wm);
      // the white string grid over the water
      const pts = [];
      for (let x = cx - w / 2 + 1.1; x < cx + w / 2; x += 1.6) pts.push(x, RIM + 0.05, z0, x, RIM + 0.05, z1);
      for (let z = z0 + 1.2; z < z1; z += 1.6) pts.push(cx - w / 2, RIM + 0.05, z, cx + w / 2, RIM + 0.05, z);
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const strings = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xdcd7c8 })); strings.userData.live = true; inside.add(strings);
    });
    const pvc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, SL - 4, 10), new THREE.MeshStandardMaterial({ color: 0xe9ecec, roughness: 0.4 }));
    pvc.rotation.x = Math.PI / 2; pvc.position.set(sgn * (WX0 - 0.35), 0.45, 0); inside.add(pvc);
  });
  // aeration froth drifting on every tank
  const NF = mobile ? 1600 : 3200, fPos = new Float32Array(NF * 3), fSeed = new Float32Array(NF);
  for (let i = 0; i < NF; i++) { const sgn = rnd() < 0.5 ? -1 : 1; fPos[i * 3] = sgn * lerp(WX0 + 0.4, WX1 - 0.4, rnd()); fPos[i * 3 + 1] = RIM - 0.13; fPos[i * 3 + 2] = lerp(-21.5, 21, rnd()); fSeed[i] = rnd() * 100; }
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
  const dot = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,0.9)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const pf = new THREE.BufferGeometry(); pf.setAttribute("position", new THREE.Float32BufferAttribute(pondFroth, 3));
  scene.add(new THREE.Points(pf, new THREE.PointsMaterial({ map: dot, size: 3.2, transparent: true, opacity: 0.85, depthWrite: false, color: 0xf2f0e6 })));
  const froth = new THREE.Points(fGeo, new THREE.PointsMaterial({ map: dot, size: 0.11, transparent: true, opacity: 0.8, depthWrite: false, color: 0xe8e6dc }));
  inside.add(froth);

  // the sample bowl on the rim: a hatchery detail the camera passes on its way to the water
  const BOWL = new THREE.Vector3(-WX0, RIM + 0.02, 3.2);
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0.2, 0], [0.26, 0.02], [0.33, 0.2], [0.345, 0.21], [0.33, 0.215], [0.315, 0.03], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y)), 48), new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.35, side: THREE.DoubleSide }));
  bowl.position.copy(BOWL); bowl.userData.live = true; bowl.scale.setScalar(1.25); inside.add(bowl);
  const milk = new THREE.Mesh(new THREE.CircleGeometry(0.325, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9d3bd, roughness: 0.15, transparent: true, opacity: 0.6 }));
  milk.position.set(BOWL.x, BOWL.y + 0.212, BOWL.z); milk.scale.setScalar(1.25); milk.userData.live = true; inside.add(milk);

  // ---------- underwater, in one raceway tank: where the flight ends ----------
  // The camera dives through the water of the right-hand tank, section 2, and drifts among the larvae.
  const TK = { x0: WX0 + THK / 2, x1: WX1 - THK / 2, z0: -11.2 + THK / 2, z1: -0.5 - THK / 2, y: RIM - 0.15 };
  const tkCx = (TK.x0 + TK.x1) / 2, tkCz = (TK.z0 + TK.z1) / 2, tkW = TK.x1 - TK.x0, tkL = TK.z1 - TK.z0;
  // the water surface seen from below: bright, rippling light
  const under = new THREE.Mesh(new THREE.PlaneGeometry(tkW, tkL).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT;
      void main(){ vec2 p = vUv * vec2(14.0, 17.0);
        float c = sin(p.x + uT * 0.9) + sin(p.y * 1.3 - uT * 1.1) + sin((p.x + p.y) * 0.7 + uT * 0.6) + sin(length(p - 7.0) * 1.3 - uT);
        c = pow(abs(c) / 4.0, 2.0);
        gl_FragColor = vec4(mix(vec3(0.34, 0.4, 0.3), vec3(0.86, 0.92, 0.78), c), 1.0); }`,
  }));
  under.position.set(tkCx, TK.y - 0.004, tkCz); inside.add(under);
  // light dancing on the tank floor
  const caustic = new THREE.Mesh(new THREE.PlaneGeometry(tkW, tkL).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT;
      float n(vec2 p){ return sin(p.x) * sin(p.y); }
      void main(){ vec2 p = vUv * vec2(22.0, 27.0);
        float c = abs(n(p + vec2(uT * 0.7, uT * 0.4)) + n(p * 1.7 - vec2(uT * 0.5, -uT * 0.6)) + 0.5 * n(p * 3.1 + uT));
        c = pow(1.0 - clamp(c, 0.0, 1.0), 6.0);
        gl_FragColor = vec4(vec3(0.75, 0.85, 0.6) * c * 0.55, 1.0); }`,
  }));
  caustic.position.set(tkCx, 0.03, tkCz); inside.add(caustic);
  // aeration: columns of bubbles rising from air stones, plus a burst where the camera breaks the surface
  const bubbleTex = canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); const r = g.createRadialGradient(26, 24, 2, 32, 32, 30); r.addColorStop(0, "rgba(255,255,255,0.95)"); r.addColorStop(0.5, "rgba(220,235,220,0.25)"); r.addColorStop(0.85, "rgba(240,250,240,0.7)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.beginPath(); g.arc(32, 32, 30, 0, 6.29); g.fill(); });
  const NB = mobile ? 700 : 1500, bPos = new Float32Array(NB * 3), bSeed = new Float32Array(NB), bBase = new Float32Array(NB * 2);
  const stones = Array.from({ length: 10 }, () => [lerp(TK.x0 + 0.5, TK.x1 - 0.5, rnd()), lerp(TK.z0 + 0.5, TK.z1 - 0.5, rnd())]);
  for (let i = 0; i < NB; i++) {
    const st = stones[i % stones.length], burst = i < NB * 0.25;
    bBase[i * 2] = burst ? lerp(3.4, 4.8, rnd()) : st[0] + (rnd() - 0.5) * 0.25;
    bBase[i * 2 + 1] = burst ? lerp(-5.2, -3.8, rnd()) : st[1] + (rnd() - 0.5) * 0.25;
    bPos[i * 3 + 1] = rnd() * TK.y; bSeed[i] = rnd() * 100;
  }
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  const bubbles = new THREE.Points(bGeo, new THREE.PointsMaterial({ map: bubbleTex, size: 0.02, transparent: true, depthWrite: false, opacity: 0.85 }));
  bubbles.frustumCulled = false; inside.add(bubbles);
  // fine particles suspended in the water
  const NQ = mobile ? 900 : 2000, qPos = new Float32Array(NQ * 3);
  for (let i = 0; i < NQ; i++) { qPos[i * 3] = lerp(TK.x0, TK.x1, rnd()); qPos[i * 3 + 1] = lerp(0.05, TK.y - 0.02, rnd()); qPos[i * 3 + 2] = lerp(TK.z0, TK.z1, rnd()); }
  const qGeo = new THREE.BufferGeometry(); qGeo.setAttribute("position", new THREE.BufferAttribute(qPos, 3));
  const specks = new THREE.Points(qGeo, new THREE.PointsMaterial({ map: dot, size: 0.006, transparent: true, depthWrite: false, opacity: 0.6, color: 0xcfc6a2 }));
  specks.frustumCulled = false; inside.add(specks);

  // the larvae, big and close: glassy side-view post-larvae facing the camera, swimming and darting
  // a post-larva as it really looks: a slender glass sliver, nearly see-through, with two black eyes,
  // a dark gut line, a few red-brown pigment specks along the belly, fine legs, antennae and a small tail fan
  const larvaSprite = (() => {
    const W = 1024, H = 320, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const cy = 160;
    // spine from the head (right) to the tail (left), with the slight arch of a swimming larva
    const P = (t) => [880 - t * 700, cy - Math.sin(Math.PI * t) * 12 + t * 8];
    const R = (t) => (t < 0.32 ? 34 - t * 12 : 30 * Math.pow(1 - (t - 0.32) / 0.68, 0.7) + 7);
    g.lineCap = "round"; g.lineJoin = "round";
    // antennae: two long threads sweeping back, two short ones forward
    g.strokeStyle = "rgba(225,232,226,0.45)"; g.lineWidth = 1.6;
    [[-22, 520], [-10, 640]].forEach(([dy, back]) => { g.beginPath(); g.moveTo(885, cy + dy + 6); g.bezierCurveTo(970, cy + dy - 50, 780, cy + dy - 80, 880 - back, cy + dy - 40); g.stroke(); });
    [[-4, 110], [6, 90]].forEach(([dy, len]) => { g.beginPath(); g.moveTo(892, cy + dy); g.quadraticCurveTo(940, cy + dy - 18, 892 + len * 0.8, cy + dy - 30); g.stroke(); });
    // walking legs under the carapace, swimmerets under the tail
    g.strokeStyle = "rgba(220,230,225,0.38)"; g.lineWidth = 1.8;
    for (let i = 0; i < 5; i++) { const t = 0.05 + i * 0.05, [x, y] = P(t); g.beginPath(); g.moveTo(x, y + R(t) * 0.6); g.quadraticCurveTo(x + 8, y + 40, x - 6, y + 58); g.stroke(); }
    for (let i = 0; i < 5; i++) { const t = 0.4 + i * 0.1, [x, y] = P(t); g.beginPath(); g.moveTo(x, y + R(t) * 0.7); g.lineTo(x - 10, y + R(t) + 16); g.stroke(); }
    // the glassy body: faint fill, brighter rim, like light catching a transparent shell
    g.beginPath();
    for (let i = 0; i <= 80; i++) { const t = i / 80, [x, y] = P(t); i ? g.lineTo(x, y - R(t)) : g.moveTo(x, y - R(t)); }
    for (let i = 80; i >= 0; i--) { const t = i / 80, [x, y] = P(t); g.lineTo(x, y + R(t) * 0.85); }
    g.closePath();
    const bg = g.createLinearGradient(0, cy - 36, 0, cy + 30); bg.addColorStop(0, "rgba(245,248,242,0.42)"); bg.addColorStop(0.5, "rgba(215,228,220,0.22)"); bg.addColorStop(1, "rgba(235,240,232,0.36)");
    g.fillStyle = bg; g.fill();
    g.strokeStyle = "rgba(250,252,248,0.8)"; g.lineWidth = 2.6; g.stroke();
    // segment lines across the tail
    g.strokeStyle = "rgba(235,242,236,0.28)"; g.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { const t = 0.36 + i * 0.1, [x, y] = P(t), r = R(t); g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x - 6, y, x, y + r * 0.85); g.stroke(); }
    // carapace edge and rostrum
    { const [x, y] = P(0.3); g.beginPath(); g.moveTo(x, y - R(0.3)); g.quadraticCurveTo(x - 4, y, x + 6, y + R(0.3) * 0.8); g.stroke(); }
    g.fillStyle = "rgba(230,238,232,0.5)"; g.beginPath(); g.moveTo(880, cy - 24); g.lineTo(930, cy - 30); g.lineTo(884, cy - 12); g.closePath(); g.fill();
    // the gut: a thin dark thread running the length of the body
    g.strokeStyle = "rgba(92,58,34,0.8)"; g.lineWidth = 4.2; g.beginPath();
    for (let i = 0; i <= 60; i++) { const t = 0.12 + i * 0.0135, [x, y] = P(t); i ? g.lineTo(x, y - R(t) * 0.15) : g.moveTo(x, y - R(t) * 0.15); } g.stroke();
    // red-brown pigment specks (chromatophores) along the belly
    g.fillStyle = "rgba(168,62,40,0.8)";
    for (let i = 0; i < 11; i++) { const t = 0.14 + i * 0.07, [x, y] = P(t); g.beginPath(); g.ellipse(x, y + R(t) * 0.55, 4.4, 2.4, 0, 0, 6.2832); g.fill(); }
    // tail fan
    { const [x, y] = P(1); g.fillStyle = "rgba(230,238,232,0.22)"; g.strokeStyle = "rgba(240,246,240,0.45)"; g.lineWidth = 1.4;
      [[-0.55, 46], [0, 50], [0.55, 46]].forEach(([a, L]) => { g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x - Math.cos(a) * L, y + Math.sin(a) * L - 7); g.lineTo(x - Math.cos(a) * L, y + Math.sin(a) * L + 7); g.closePath(); g.fill(); g.stroke(); }); }
    // eyes: big, black, on the head
    g.fillStyle = "#0c0906"; g.beginPath(); g.ellipse(866, cy - 16, 17, 16, 0, 0, 6.2832); g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)"; g.beginPath(); g.arc(871, cy - 21, 4.4, 0, 6.2832); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const NL = mobile ? 120 : 240;
  const larvae = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.3125), new THREE.MeshBasicMaterial({ map: larvaSprite, transparent: true, depthWrite: false, side: THREE.DoubleSide }), NL);
  larvae.userData.live = true; larvae.frustumCulled = false; inside.add(larvae);
  const LL = Array.from({ length: NL }, () => {
    const t = rnd(), r = 0.12 + Math.pow(rnd(), 0.7) * 0.9, ang = rnd() * 6.28;
    const hx = lerp(4.3, 5.5, t) + Math.cos(ang) * r, hy = Math.min(TK.y - 0.08, Math.max(0.12, lerp(0.75, 0.62, t) + Math.sin(ang) * r * 0.5)), hz = lerp(-5.4, -10.2, t) + (rnd() - 0.5) * 0.8;
    return { x: hx, y: hy, z: hz, hx, hy, hz, a: rnd() * 6.28, v: 0.02 + rnd() * 0.04, ph: rnd() * 6.28, len: 0.055 + rnd() * 0.04, dart: 0 };
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3(), camL = new THREE.Vector3();
  let grow = 0;

  // ---------- the flight: keyframes in world space ----------
  const E = entry.position; // shed origin (floor centre)
  const w = (x, y, z) => new THREE.Vector3(E.x + x, E.y + y, E.z + z);
  const KEYS = [
    // over the sea, looking at the coast
    { t: 0.0, p: new THREE.Vector3(160, 150, 520), l: new THREE.Vector3(0, 0, 0) },
    { t: 0.16, p: new THREE.Vector3(70, 80, 250), l: new THREE.Vector3(0, 5, 10) },
    // over the beach, the hatchery ahead
    { t: 0.32, p: new THREE.Vector3(18, 34, 120), l: w(0, 5, 20) },
    // down to the open door of the shed
    { t: 0.44, p: w(0, 6, 62), l: w(0, 3, SL / 2) },
    { t: 0.54, p: w(0, 3.1, SL / 2 + 4), l: w(0, 2.6, 8) },
    // inside, along the walkway between the raceways
    { t: 0.66, p: w(0, 3.0, 12), l: w(-3, 1.1, -4) },
    { t: 0.76, p: w(0.2, 2.5, 0), l: w(3.5, 1.0, -8) },
    // over a tank, down to the water, and through it
    { t: 0.84, p: w(3.0, 1.85, -2.6), l: w(4.5, 0.7, -7.2) },
    { t: 0.89, p: w(4.0, 1.12, -4.4), l: w(4.9, 0.55, -8.6) },
    // underwater, drifting among the larvae
    { t: 0.94, p: w(4.6, 0.62, -5.9), l: w(5.2, 0.6, -9.6) },
    { t: 1.0, p: w(5.1, 0.58, -7.9), l: w(5.5, 0.72, -11.0) },
  ];
  const pc = new THREE.CatmullRomCurve3(KEYS.map((k) => k.p), false, "centripetal", 0.4);
  const lc = new THREE.CatmullRomCurve3(KEYS.map((k) => k.l), false, "centripetal", 0.4);
  const n = KEYS.length - 1;
  const u = (j) => {
    for (let i = 0; i < n; i++) if (j <= KEYS[i + 1].t) { const k = (j - KEYS[i].t) / (KEYS[i + 1].t - KEYS[i].t); return (i + smooth(k) * 0.35 + k * 0.65) / n; }
    return 1;
  };
  const cp = new THREE.Vector3(), lp = new THREE.Vector3();

  // ---------- pacing ----------
  // The keyframes are uneven (hundreds of metres over the sea, a metre over the bowl), so moving through them
  // evenly feels like lurching. Instead the camera keeps a steady *visual* speed: each step is measured against
  // how far away the thing it looks at is, plus how much the view turns. Scroll maps onto that, eased at both ends.
  // the flight ends underwater among the larvae; the pond film takes over from there
  const NS = 1500, SK = new Float32Array(NS + 1), SS = new Float32Array(NS + 1), K_END = 1;
  {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), la = new THREE.Vector3(), lb = new THREE.Vector3(), da = new THREE.Vector3(), db = new THREE.Vector3();
    pc.getPoint(0, a); lc.getPoint(0, la); da.subVectors(la, a).normalize();
    let acc = 0;
    for (let i = 1; i <= NS; i++) {
      const k = (i / NS) * K_END;
      pc.getPoint(k, b); lc.getPoint(k, lb); db.subVectors(lb, b).normalize();
      acc += a.distanceTo(b) / Math.max(b.y - E.y < RIM ? 0.9 : 1.5, b.distanceTo(lb)) + da.angleTo(db) * 0.9;
      SK[i] = k; SS[i] = acc; a.copy(b); la.copy(lb); da.copy(db);
    }
    for (let i = 0; i <= NS; i++) SS[i] /= acc;
  }
  const kAt = (s) => {                       // flow fraction -> curve parameter
    let lo = 0, hi = NS;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SS[m] < s) lo = m; else hi = m; }
    const f = (s - SS[lo]) / Math.max(1e-9, SS[hi] - SS[lo]);
    return SK[lo] + (SK[hi] - SK[lo]) * f;
  };
  const jOf = (k) => {                       // curve parameter -> the original keyframe time (u is monotonic)
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (u(m) < k) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  const paced = (j) => jOf(kAt(lerp(j, smooth(j), 0.35)));

  let W = 1, H = 1;
  function layout() { W = canvas.clientWidth; H = canvas.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
  layout(); window.addEventListener("resize", layout);

  let mx = 0, my = 0, sx = 0, sy = 0;
  canvas.parentElement.addEventListener("pointermove", (e) => { mx = (e.clientX / window.innerWidth) * 2 - 1; my = (e.clientY / window.innerHeight) * 2 - 1; });

  const pose = (cam, j, swx = 0, swy = 0) => {
    const k = u(j);
    pc.getPoint(k, cp); lc.getPoint(k, lp);
    const sway = j < 0.5 ? 1 : 0.15;
    cam.position.set(cp.x + swx * 2 * sway, cp.y - swy * 1 * sway, cp.z);
    cam.lookAt(lp); cam.updateMatrixWorld();
  };
  // underwater post: murky tint, gentle wobble, light shafts from the surface, a flash of distortion at the splash
  const uwFog = new THREE.FogExp2(0x3b4230, 0.55), airFog = scene.fog;
  const size2 = new THREE.Vector2(); renderer.getDrawingBufferSize(size2);
  const uwRT = new THREE.WebGLRenderTarget(size2.x, size2.y, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const uwU = { tC: { value: uwRT.texture }, uT: { value: 0 }, uSplash: { value: 0 }, uRise: { value: 0 }, uExp: { value: 0.9 } };
  const uwScene = new THREE.Scene(), uwCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  uwScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: uwU, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `varying vec2 vUv; uniform sampler2D tC; uniform float uT, uSplash, uRise, uExp;
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float amp = 0.0035 + uSplash * 0.03;
        vec2 uv = vUv + vec2(sin(vUv.y * 28.0 + uT * 1.7), cos(vUv.x * 22.0 + uT * 1.3)) * amp;
        vec3 c = pow(aces(texture2D(tC, uv).rgb * uExp), vec3(1.0 / 2.2));
        c = mix(c, c * vec3(0.86, 0.95, 0.78), 0.5);                                   // green-brown water
        float rays = pow(max(0.0, sin(vUv.x * 18.0 + sin(vUv.x * 5.0 + uT * 0.3) * 2.0 + uT * 0.25) * 0.5 + 0.5), 10.0);
        c += vec3(0.62, 0.72, 0.5) * rays * pow(vUv.y, 2.2) * 0.22;                   // light shafts from above
        c += vec3(0.8, 0.9, 0.75) * uSplash * 0.35;                                      // the splash flash
        c = mix(c, vec3(0.86, 0.94, 0.84), smoothstep(0.0, 1.0, uRise) * (0.35 + 0.65 * vUv.y)); // surfacing light
        float v = smoothstep(1.2, 0.3, length((vUv - 0.5) * vec2(1.2, 1.0)));
        c *= mix(0.62, 1.0, v);
        c += (hash(vUv * 900.0 + uT) - 0.5) * 0.03;
        gl_FragColor = vec4(c, 1.0); }`,
  })));
  const shedBox = new THREE.Box3(new THREE.Vector3(E.x - SW / 2, E.y - 1, E.z - SL / 2), new THREE.Vector3(E.x + SW / 2, E.y + WH, E.z + SL / 2));
  const proj = opts.photos ? makeProjection(renderer, scene, sea, pose, mobile, shedBox) : null;

  const render = (jScroll, now, dt) => {
    const j = paced(jScroll);
    sx += (mx - sx) * 0.04; sy += (my - sy) * 0.04;
    pose(camera, j, sx, sy);
    // near the ground the fog thins so the shed interior stays crisp
    scene.fog.density = lerp(0.0011, 0.00015, band(j, 0.4, 0.55)) + lerp(0, 0.0004, band(j, 0.93, 1));
    renderer.toneMappingExposure = lerp(0.55, 0.42, band(j, 0.5, 0.6) * (1 - band(j, 0.92, 0.98)));
    sea.material.uniforms.time.value = now * 0.0006;
    tankNormals.offset.set(now * 0.00005, -now * 0.00004);
    // under the surface of the tank?
    camL.copy(camera.position).sub(E);
    const inTank = camL.x > TK.x0 && camL.x < TK.x1 && camL.z > TK.z0 && camL.z < TK.z1;
    const depth = inTank ? TK.y - camL.y : -1;
    const uw = depth > 0;
    const splash = inTank ? Math.exp(-((depth / 0.07) ** 2)) : 0;
    const tt = now * 0.001;
    under.material.uniforms.uT.value = tt; caustic.material.uniforms.uT.value = tt;
    for (let i = 0; i < NB; i++) {
      let y = bPos[i * 3 + 1] + (0.18 + (bSeed[i] % 1) * 0.25) * dt;
      if (y > TK.y - 0.01) y = 0.03;
      bPos[i * 3 + 1] = y;
      bPos[i * 3] = bBase[i * 2] + Math.sin(tt * 3 + bSeed[i]) * 0.012;
      bPos[i * 3 + 2] = bBase[i * 2 + 1] + Math.cos(tt * 2.6 + bSeed[i]) * 0.012;
    }
    bGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < NQ; i++) qPos[i * 3 + 1] += Math.sin(tt * 0.5 + i) * 0.00008;
    qGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < NF; i++) { fPos[i * 3] += Math.sin(now * 0.0007 + fSeed[i]) * 0.004; fPos[i * 3 + 2] += Math.cos(now * 0.0006 + fSeed[i] * 1.3) * 0.004; }
    fGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < NL; i++) {
      const l = LL[i];
      l.dart = Math.max(0, l.dart - dt * 1.6); if (Math.random() < 0.003) l.dart = 1;
      // a larva right in front of the lens darts away
      const dx = l.x - camL.x, dy = l.y - camL.y, dz = l.z - camL.z;
      if (uw && dx * dx + dy * dy + dz * dz < 0.05 && l.dart < 0.2) { l.dart = 1; l.a = Math.atan2(-dz, dx); }
      l.a += Math.sin(tt * 0.8 + l.ph) * 0.9 * dt;
      const sp = l.v * (1 + l.dart * 7) * dt;
      l.x += Math.cos(l.a) * sp; l.z -= Math.sin(l.a) * sp; l.y += Math.sin(tt * 0.9 + l.ph) * 0.02 * dt;
      l.x += (l.hx - l.x) * 0.08 * dt; l.z += (l.hz - l.z) * 0.08 * dt; l.y += (l.hy - l.y) * 0.1 * dt;   // stay near home
      if (l.x < TK.x0 + 0.1 || l.x > TK.x1 - 0.1) l.a = Math.PI - l.a;
      if (l.z < TK.z0 + 0.1 || l.z > TK.z1 - 0.1) l.a = -l.a;
      l.x = Math.min(TK.x1 - 0.1, Math.max(TK.x0 + 0.1, l.x)); l.z = Math.min(TK.z1 - 0.1, Math.max(TK.z0 + 0.1, l.z));
      l.y = Math.min(TK.y - 0.05, Math.max(0.08, l.y));
      // face the camera, flipped so the head leads the way it swims, with a flick of the tail
      const yaw = Math.atan2(camL.x - l.x, camL.z - l.z);
      const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
      const flip = Math.cos(l.a) * rightX - Math.sin(l.a) * rightZ >= 0 ? 1 : -1;
      q.setFromEuler(new THREE.Euler(0, yaw, Math.sin(tt * (8 + l.dart * 30) + l.ph) * (0.05 + l.dart * 0.2), "YXZ"));
      const gl = l.len * (1 + grow * 3.2);            // growing, as the scroll runs on
      pos.set(l.x, l.y, l.z); scl.set(gl * flip, gl, gl);
      m4.compose(pos, q, scl); larvae.setMatrixAt(i, m4);
    }
    larvae.instanceMatrix.needsUpdate = true;
    camera.near = uw ? 0.012 : 0.08; camera.updateProjectionMatrix();
    if (uw) {
      scene.fog = uwFog;
      renderer.getDrawingBufferSize(size2);
      if (uwRT.width !== size2.x || uwRT.height !== size2.y) uwRT.setSize(size2.x, size2.y);
      renderer.setRenderTarget(uwRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
      uwU.uT.value = tt; uwU.uSplash.value = splash; uwU.uRise.value = band(j, 0.975, 1); uwU.uExp.value = 1.0;
      renderer.render(uwScene, uwCam);
      scene.fog = airFog;
    } else if (proj && proj.ready()) proj.render(camera, j, now);
    else renderer.render(scene, camera);
  };
  render.larvae = larvae;
  render.setGrow = (g) => { grow = g; };
  // where (in scroll terms) a moment of the old keyframe timeline now lands, for the captions
  render.scrollFor = (jOld) => { let lo = 0, hi = 1; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (paced(m) < jOld) lo = m; else hi = m; } return (lo + hi) / 2; };
  return render;
}

// ---------- camera projection mapping ----------
const POS_V = `varying vec3 vW; varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  vec4 w = modelMatrix * p; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const COMP_F = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor, tPos, ph0, ph1, ph2, pp0, pp1, pp2;
uniform mat4 vp0, vp1, vp2;
uniform vec3 cp0, cp1, cp2, wt, side, bmin, bmax;
uniform float uWaterY, uWaterFade;
uniform float exposure, time;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// colour a world point from one projector: inside its frame, and not hidden behind something nearer to it
vec4 take(sampler2D ph, sampler2D pp, mat4 vp, vec3 cpos, vec3 P, float inside){
  // walls are thin planes: points within 15 cm of the shed box belong to both sides
  bool core = all(greaterThan(P, bmin + 0.15)) && all(lessThan(P, bmax - 0.15));
  bool out_ = any(lessThan(P, bmin - 0.15)) || any(greaterThan(P, bmax + 0.15));
  if ((inside > 0.5 && out_) || (inside < 0.5 && core)) return vec4(0.0);
  vec4 c = vp * vec4(P, 1.0);
  if (c.w <= 0.0) return vec4(0.0);
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  vec2 e = smoothstep(vec2(0.0), vec2(0.14), uv) * smoothstep(vec2(0.0), vec2(0.14), 1.0 - uv);
  float edge = e.x * e.y;
  if (edge <= 0.0) return vec4(0.0);
  vec4 S = texture2D(pp, uv);
  float dP = distance(P, cpos), dS = distance(S.xyz, cpos);
  float vis = S.w > 0.5 ? 1.0 - smoothstep(0.02, 0.06, (dP - dS) / dP) : 0.0;
  vec3 rgb = texture2D(ph, uv).rgb;
  return vec4(rgb, edge * vis);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c3 = pow(aces(texture2D(tColor, vUv).rgb * exposure), vec3(1.0 / 2.2));
  vec4 P = texture2D(tPos, vUv);
  vec3 col = c3;
  if (P.w > 0.5 && length(P.xyz) > 4000.0) {
    // sky: one soft morning haze for every shot, so photos with different skies never leave shapes in it
    float el = clamp(P.y / length(P.xyz), 0.0, 1.0);
    col = mix(vec3(0.80, 0.78, 0.73), vec3(0.60, 0.64, 0.68), smoothstep(0.0, 0.5, el));
  } else if (P.w > 0.5) {
    vec3 acc = c3 * 0.015; float ws = 0.015;
    // low over the tanks the photos stretch across the water: there the live 3D water takes over; walls keep the photos
    float wf = P.y < uWaterY ? uWaterFade : 1.0;
    vec4 a = take(ph0, pp0, vp0, cp0, P.xyz, side.x); a.a *= wf; acc += a.rgb * a.a * wt.x; ws += a.a * wt.x;
    vec4 b = take(ph1, pp1, vp1, cp1, P.xyz, side.y); b.a *= wf; acc += b.rgb * b.a * wt.y; ws += b.a * wt.y;
    vec4 d = take(ph2, pp2, vp2, cp2, P.xyz, side.z); d.a *= wf; acc += d.rgb * d.a * wt.z; ws += d.a * wt.z;
    col = acc / ws;
  }
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 0.94) * vec3(1.02, 1.0, 0.97);
  float v = smoothstep(1.15, 0.35, length((vUv - 0.5) * vec2(1.25, 1.0)));
  col *= mix(0.74, 1.0, v);
  col += (hash(vUv * 900.0 + time) - 0.5) * 0.028;
  gl_FragColor = vec4(col, 1.0);
}`;

function makeProjection(renderer, scene, sea, pose, mobile, box) {
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has("EXT_color_buffer_float")) return null;
  const posMat = new THREE.ShaderMaterial({ vertexShader: POS_V, fragmentShader: "varying vec3 vW; void main(){ gl_FragColor = vec4(vW, 1.0); }", side: THREE.DoubleSide });
  const liveMat = new THREE.ShaderMaterial({ vertexShader: POS_V, fragmentShader: "void main(){ gl_FragColor = vec4(0.0); }", side: THREE.DoubleSide });
  // sprites (the larvae) are only "live" where they are opaque; around them the photo carries on
  const liveCache = new Map();
  const liveFor = (m) => {
    if (!m.map) return liveMat;
    if (!liveCache.has(m)) liveCache.set(m, new THREE.ShaderMaterial({ vertexShader: POS_V, uniforms: { map: { value: m.map } }, side: THREE.DoubleSide,
      fragmentShader: "uniform sampler2D map; varying vec2 vUv; void main(){ if (texture2D(map, vUv).a < 0.1) discard; gl_FragColor = vec4(0.0); }" }));
    return liveCache.get(m);
  };
  const floatRT = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  // world positions of everything a camera sees; "live" things (larvae, strings) are marked so they stay 3D
  const saved = [];
  function positions(cam, rt) {
    scene.traverse((o) => {
      if (o.isPoints) { if (o.visible) { saved.push([o, null]); o.visible = false; } }
      else if (o.isMesh || o.isLine) { saved.push([o, o.material]); o.material = o.userData.live ? liveFor(o.material) : posMat; }
    });
    const fog = scene.fog, hook = sea.onBeforeRender, auto = renderer.shadowMap.autoUpdate;
    scene.fog = null; sea.onBeforeRender = () => {}; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
    scene.fog = fog; sea.onBeforeRender = hook; renderer.shadowMap.autoUpdate = auto;
    for (const [o, m] of saved) { if (m) o.material = m; else o.visible = true; }
    saved.length = 0;
  }
  // one projector per photo: its pose, its view-projection and a map of what it can see
  const loader = new THREE.TextureLoader();
  const P = PHOTOS.map(([j, inside]) => {
    const cam = new THREE.PerspectiveCamera(48, 1344 / 768, 0.08, 15000);
    cam.updateProjectionMatrix(); pose(cam, j);
    const rt = floatRT(mobile ? 384 : 640, mobile ? 220 : 366);
    positions(cam, rt);
    const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const p = { j, inside, cam, rt, vp, ok: false };
    p.tex = loader.load(photoUrl(j, mobile), () => { p.ok = true; });
    p.tex.colorSpace = THREE.NoColorSpace; p.tex.minFilter = THREE.LinearFilter; p.tex.generateMipmaps = false;
    return p;
  });
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const colorRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: mobile ? 0 : 2 });
  const posRT = floatRT(Math.ceil(size.x / 2), Math.ceil(size.y / 2));   // positions only steer which photo paints a pixel: half size is plenty
  const dummy = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType); dummy.needsUpdate = true;
  const U = { tColor: { value: colorRT.texture }, tPos: { value: posRT.texture }, exposure: { value: 0.55 }, time: { value: 0 }, wt: { value: new THREE.Vector3() }, side: { value: new THREE.Vector3() }, bmin: { value: box.min }, bmax: { value: box.max }, uWaterY: { value: box.min.y + 1 + 1.25 - 0.08 }, uWaterFade: { value: 1 } };
  for (let i = 0; i < 3; i++) Object.assign(U, { ["ph" + i]: { value: dummy }, ["pp" + i]: { value: dummy }, ["vp" + i]: { value: new THREE.Matrix4() }, ["cp" + i]: { value: new THREE.Vector3() } });
  const qScene = new THREE.Scene();
  qScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: COMP_F, uniforms: U, depthTest: false, depthWrite: false, toneMapped: false,
  })));
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const slot = (i, p, w) => {
    U["ph" + i].value = p ? p.tex : dummy; U["pp" + i].value = p ? p.rt.texture : dummy;
    if (p) { U["vp" + i].value.copy(p.vp); U["cp" + i].value.copy(p.cam.position); }
    U.wt.value.setComponent(i, p && p.ok ? w : 0);
    U.side.value.setComponent(i, p ? p.inside : 0);
  };
  return {
    ready: () => P[0].ok,
    render(camera, j, now) {
      renderer.getDrawingBufferSize(size);
      if (colorRT.width !== size.x || colorRT.height !== size.y) { colorRT.setSize(size.x, size.y); posRT.setSize(Math.ceil(size.x / 2), Math.ceil(size.y / 2)); }
      renderer.setRenderTarget(colorRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
      positions(camera, posRT);
      // the two photos either side of here, cross-weighted, plus the next one as a quiet fallback for gaps
      let k = 0; while (k < P.length - 2 && j >= P[k + 1].j) k++;
      const t = clamp01((j - P[k].j) / (P[k + 1].j - P[k].j));
      slot(0, P[k], 1 - t + 0.001); slot(1, P[k + 1], t + 0.001);
      slot(2, t > 0.5 ? P[k + 2] : P[k - 1], 0.12);
      U.uWaterFade.value = 1 - smooth(band(j, 0.77, 0.83));
      // once the camera is at the water, nothing near it comes from the last photo any more: hold the photos on the walls
      if (j > 0.76) { slot(0, P[P.length - 1], 1); slot(1, P[P.length - 2], 0.35); slot(2, P[P.length - 3], 0.12); }
      U.exposure.value = renderer.toneMappingExposure; U.time.value = (now * 0.001) % 100;
      renderer.render(qScene, qCam);
    },
  };
}
