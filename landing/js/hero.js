// HERO: a live 3D tray. A hand raises a phone over it, the checks pass, the shutter is pressed,
// the phone drops away and a scan beam circles every larva.
import * as THREE from "three";
import { larvaTexture, clamp01, ease, lerp, band, whileVisible, makeRenderer } from "./larva.js";

// where the phone's screen sits inside media/hand-phone.webp (pixels)
const HAND = { w: 1088, h: 1456, sx0: 298, sy0: 179, sx1: 725, sy1: 1121 };

export function initHero({ ScrollTrigger, reduce, fmt }) {
  const hero = document.getElementById("hero");
  const canvas = document.getElementById("gl");
  let renderer;
  try { renderer = makeRenderer(canvas); } catch { document.documentElement.classList.add("no-gl"); return; }

  const mobile = window.innerWidth < 760;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0e10, 16, 34);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const TW = mobile ? 3.1 : 4.2, TD = mobile ? 4.2 : 3.1, WALL = 0.34, WATER_Y = 0.2;

  const rr = (w, h, r) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  };
  const rig = new THREE.Group(); scene.add(rig);
  const rim = rr(TW, TD, 0.34); rim.holes.push(rr(TW - 0.22, TD - 0.22, 0.26));
  const rimGeo = new THREE.ExtrudeGeometry(rim, { depth: WALL, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 16 });
  rimGeo.rotateX(-Math.PI / 2);
  rig.add(new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0xe9eeec, roughness: 0.4 })));
  const flat = (w, h) => { const g = new THREE.ShapeGeometry(rr(w, h, 0.26), 16); g.rotateX(-Math.PI / 2); return g; };
  const floor = new THREE.Mesh(flat(TW - 0.2, TD - 0.2), new THREE.MeshStandardMaterial({ color: 0xf3f5f4, roughness: 0.6 }));
  floor.position.y = 0.01; rig.add(floor);

  const waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uFreeze: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uFreeze;
      void main(){ vec2 p = vUv * vec2(9.0, 7.0); float t = uT * (1.0 - uFreeze);
        float c = sin(p.x + t) + sin(p.y * 1.3 - t * 1.1) + sin((p.x + p.y) * 0.8 + t * 0.7) + sin(length(p - 4.0) * 1.6 - t);
        c = pow(abs(c) / 4.0, 3.0);
        gl_FragColor = vec4(mix(vec3(0.82, 0.9, 0.9), vec3(1.0), c * 0.8), 0.28 + c * 0.25); }`,
  });
  const water = new THREE.Mesh(flat(TW - 0.2, TD - 0.2), waterMat); water.position.y = WATER_Y + 0.04; water.renderOrder = 2; rig.add(water);

  const N = mobile ? 700 : 1300;
  const larvaGeo = new THREE.PlaneGeometry(0.15, 0.0375); larvaGeo.rotateX(-Math.PI / 2);
  const larvae = new THREE.InstancedMesh(larvaGeo, new THREE.MeshBasicMaterial({ map: larvaTexture(), transparent: true, depthWrite: false }), N);
  larvae.renderOrder = 1; rig.add(larvae);
  // a count mark: a small glowing coral core inside a hairline ring, like a detector locking on
  const markTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const halo = g.createRadialGradient(64, 64, 20, 64, 64, 62);
    halo.addColorStop(0, "rgba(255,106,77,0.28)"); halo.addColorStop(1, "rgba(255,106,77,0)");
    g.fillStyle = halo; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(240,86,54,0.95)"; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(240,86,54,1)"; g.beginPath(); g.arc(64, 64, 9, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const markGeo = new THREE.PlaneGeometry(0.085, 0.085); markGeo.rotateX(-Math.PI / 2);
  const rings = new THREE.InstancedMesh(markGeo, new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false }), N);
  rings.renderOrder = 3; rig.add(rings);
  const counted = new Float32Array(N).fill(-1);
  // the scan: a soft band of light trailing a crisp leading edge, sweeping left to right
  const beamGeo = new THREE.PlaneGeometry(1.4, TD - 0.22); beamGeo.rotateX(-Math.PI / 2); beamGeo.translate(-0.7, 0, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uO: { value: 0 }, uT: { value: 0 }, uLeft: { value: -9 } },
    vertexShader: "varying vec2 vUv; varying float vX; void main(){ vUv = uv; vX = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv; varying float vX; uniform float uO; uniform float uT; uniform float uLeft;
      void main(){ if (vX < uLeft) discard;
        float x = vUv.x; float trail = pow(x, 4.0) * 0.28; float edge = exp(-pow((1.0 - x) * 90.0, 2.0));
        float lines = 0.5 + 0.5 * sin(vUv.y * 180.0 + uT * 2.0); float grid = smoothstep(0.97, 1.0, lines) * pow(x, 8.0) * 0.35;
        float a = clamp(trail + grid + edge, 0.0, 1.0) * uO;
        vec3 col = mix(vec3(1.0, 0.55, 0.42), vec3(1.0, 0.42, 0.3), edge);
        gl_FragColor = vec4(col, a); }`,
  }));
  beam.position.y = WATER_Y + 0.06; beam.renderOrder = 4; rig.add(beam);

  scene.add(new THREE.HemisphereLight(0xe7f3f2, 0x0a1316, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-3, 6, 4); scene.add(sun);
  const warm = new THREE.PointLight(0xff8a6a, 20, 12); warm.position.set(3.4, 1.4, -2.2); scene.add(warm);

  const HX = (TW - 0.46) / 2, HZ = (TD - 0.46) / 2;
  const L = Array.from({ length: N }, () => {
    const clump = Math.random() < 0.3;
    const cx = (Math.random() * 2 - 1) * HX * 0.7, cz = (Math.random() * 2 - 1) * HZ * 0.7;
    return {
      x: clump ? cx + (Math.random() - 0.5) * 0.5 : (Math.random() * 2 - 1) * HX,
      z: clump ? cz + (Math.random() - 0.5) * 0.5 : (Math.random() * 2 - 1) * HZ,
      a: Math.random() * Math.PI * 2, v: 0.06 + Math.random() * 0.14, ph: Math.random() * 6.28, turn: (Math.random() - 0.5) * 0.8, s: 0.8 + Math.random() * 0.45,
    };
  });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const pointer = new THREE.Vector2(9, 9), hit = new THREE.Vector3(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);
  let pointerOn = false; const tilt = { x: 0, y: 0 }, tiltT = { x: 0, y: 0 };
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    tiltT.x = pointer.x; tiltT.y = pointer.y; pointerOn = true;
  });
  canvas.addEventListener("pointerleave", () => { pointerOn = false; tiltT.x = tiltT.y = 0; });

  const $ = (id) => document.getElementById(id);
  const hudShot = $("hud-shot"), hudCount = $("hud-count"), hudBar = $("hud-bar"), endCount = $("end-count");
  const hud = hero.querySelector(".hud"), copy = hero.querySelector(".hero-copy"), end = hero.querySelector(".hero-end"), hint = hero.querySelector(".hero-hint");
  const hand = $("hand"), vf = $("vf"), chips = [...vf.querySelectorAll(".vf-chips span")], focus = vf.querySelector(".vf-focus"), shutter = vf.querySelector(".vf-shutter"), vflash = vf.querySelector(".vf-flash");
  endCount.textContent = fmt.format(N);

  let W = 1, H = 1, fitFull = 6, vfFracW = 0.3, vfFracH = 0.6, handBox = { left: 0, top: 0, w: 0, h: 0 };
  function layout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const f = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    fitFull = Math.max((TD / 2) / f, (TW / 2) / (f * camera.aspect)) * (mobile ? 1.08 : 1.28);
    // hand + phone: the screen is centred on the view and fills most of its height
    let hh = H * (mobile ? 1.18 : 1.34), hw = hh * HAND.w / HAND.h;
    if (hw > W * 1.3) { hw = W * 1.3; hh = hw * HAND.h / HAND.w; }
    const cx = (HAND.sx0 + HAND.sx1) / 2 / HAND.w, cy = (HAND.sy0 + HAND.sy1) / 2 / HAND.h;
    handBox = { w: hw, h: hh, left: W / 2 - cx * hw, top: H / 2 - cy * hh };
    Object.assign(hand.style, { width: `${hw}px`, left: `${handBox.left}px`, top: `${handBox.top}px` });
    const sx = hw / HAND.w, sy = hh / HAND.h;
    const vw = (HAND.sx1 - HAND.sx0) * sx, vh = (HAND.sy1 - HAND.sy0) * sy;
    Object.assign(vf.style, { left: `${handBox.left + HAND.sx0 * sx}px`, top: `${handBox.top + HAND.sy0 * sy}px`, width: `${vw}px`, height: `${vh}px`, borderRadius: `${vw * 0.11}px` });
    vfFracW = vw / W; vfFracH = vh / H;
  }
  layout();
  window.addEventListener("resize", layout);

  let p = reduce ? 1 : 0, target = p, shown = -1;
  if (ScrollTrigger && !reduce) ScrollTrigger.create({ trigger: hero, start: "top top", end: "bottom bottom", onUpdate: (s) => { target = s.progress; } });

  function frame(now, dt) {
    p += (target - p) * Math.min(1, dt * 8);
    const camK = ease(band(p, 0.04, 0.2));
    const phoneIn = ease(band(p, 0.1, 0.22)), phoneOut = ease(band(p, 0.42, 0.52)), phoneVis = phoneIn * (1 - phoneOut);
    const s1 = 1 - camK, s2 = ease(band(p, 0.74, 0.84));

    // camera: low angle, then straight down; framed to the phone screen while the phone is up
    tilt.x += (tiltT.x - tilt.x) * 0.05; tilt.y += (tiltT.y - tilt.y) * 0.05;
    const f = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const introDist = fitFull * lerp(1.18, 1, camK) * (mobile ? 1 + 0.55 * s1 + 0.5 * s2 : 1 + 0.42 * s1 + 0.75 * s2);
    const vert = mobile ? TD : TW, horiz = mobile ? TW : TD;
    const phoneDist = Math.max((vert / 2) / (f * vfFracH * 0.94), (horiz / 2) / (f * camera.aspect * vfFracW * 0.94));
    const dist = lerp(introDist, phoneDist, phoneVis);
    const angle = lerp(0.95, 1.5695, camK);
    camera.position.set(tilt.x * 0.15 * (1 - phoneVis), Math.sin(angle) * dist, Math.cos(angle) * dist + tilt.y * 0.1 * (1 - phoneVis));
    camera.lookAt(0, 0.1, 0);
    if (mobile) camera.setViewOffset(W, H, 0, H * (0.2 * s1 + 0.25 * s2) * (1 - phoneVis), W, H);
    else camera.setViewOffset(W, H, -W * (0.25 * s1 * (1 - phoneVis) + 0.2 * s2), 0, W, H);
    // on a laptop the tray turns upright for the portrait phone screen, then back for the scan
    rig.rotation.y = lerp(-0.18, 0, camK) + (mobile ? 0 : (Math.PI / 2) * ease(band(p, 0.1, 0.22)) * (1 - ease(band(p, 0.42, 0.52))));

    // swim until the shutter, then freeze
    const swim = 1 - band(p, 0.35, 0.37);
    if (pointerOn && swim > 0) { ray.setFromCamera(pointer, camera); if (ray.ray.intersectPlane(plane, hit)) rig.worldToLocal(hit); else hit.set(99, 0, 99); } else hit.set(99, 0, 99);
    for (let i = 0; i < N; i++) {
      const l = L[i];
      if (swim > 0) {
        l.a += (Math.sin(now * 0.0011 + l.ph) * 0.9 + l.turn * 0.4) * dt;
        let v = l.v;
        const dx = l.x - hit.x, dz = l.z - hit.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.3) { const k = (0.3 - d2) * 6, d = Math.sqrt(d2 + 1e-4); l.x += (dx / d) * k * dt; l.z += (dz / d) * k * dt; l.a = Math.atan2(-dz, dx); v *= 3; }
        l.x += Math.cos(l.a) * v * dt * swim; l.z -= Math.sin(l.a) * v * dt * swim;
        if (l.x < -HX || l.x > HX) { l.a = Math.PI - l.a; l.x = Math.max(-HX, Math.min(HX, l.x)); }
        if (l.z < -HZ || l.z > HZ) { l.a = -l.a; l.z = Math.max(-HZ, Math.min(HZ, l.z)); }
      }
      q.setFromAxisAngle(up, l.a + Math.sin(now * 0.012 * swim + l.ph) * 0.18 * swim);
      pos.set(l.x, WATER_Y, l.z); scl.set(l.s, 1, l.s);
      m4.compose(pos, q, scl); larvae.setMatrixAt(i, m4);
    }
    larvae.instanceMatrix.needsUpdate = true;

    const scan = band(p, 0.53, 0.74);
    const scanX = lerp(-HX - 0.12, HX + 0.12, ease(scan) * 0.3 + scan * 0.7);
    beam.position.x = scanX; beam.material.uniforms.uLeft.value = -HX - 0.02 - scanX;
    beam.material.uniforms.uO.value = scan > 0 && scan < 1 ? Math.min(1, scan * 12, (1 - scan) * 12) : 0;
    beam.material.uniforms.uT.value = now * 0.001;
    // each mark pops in as the edge passes; when the scan completes a soft pulse runs back across them
    const done = band(p, 0.74, 0.8);
    let found = 0;
    for (let i = 0; i < N; i++) {
      const l = L[i];
      const on = scan > 0 && l.x <= scanX;
      if (on) { found++; if (counted[i] < 0) counted[i] = now; } else counted[i] = -1;
      const age = on ? Math.min(1, (now - counted[i]) / 260) : 0;
      const u = (l.x + HX) / (2 * HX) - done;
      const pulse = done > 0 && done < 1 ? Math.exp(-u * u * 60) * 0.5 : 0;
      const s = on ? (0.55 + 0.9 * (1 - ease(age)) + pulse) * l.s : 0.0001;
      q.identity(); pos.set(l.x + Math.cos(l.a) * 0.055 * l.s, WATER_Y + 0.02, l.z - Math.sin(l.a) * 0.055 * l.s); scl.set(s, 1, s);
      m4.compose(pos, q, scl); rings.setMatrixAt(i, m4);
    }
    rings.instanceMatrix.needsUpdate = true;
    if (scan >= 1) found = N;
    if (found !== shown) { hudCount.textContent = fmt.format(found); shown = found; }
    hudBar.style.transform = `scaleX(${found / N})`;
    hudShot.textContent = p < 0.24 ? "Framing" : p < 0.335 ? "Checks passed" : p < 0.5 ? "Photo taken" : scan < 1 ? "Counting" : "Done";

    // the phone in the hand, its viewfinder, the checks and the shutter
    const press = p > 0.335 && p < 0.36;
    const handY = (1 - phoneIn) * H * 1.15 + phoneOut * H * 1.25 + (press ? 6 : 0);
    const handT = `translate3d(0, ${handY}px, 0) rotate(${-9 * phoneOut + 3 * (1 - phoneIn)}deg)`;
    hand.style.transform = handT; vf.style.transform = handT;
    hand.style.transformOrigin = vf.style.transformOrigin = `50% ${H}px`;
    vf.style.opacity = String(phoneVis);
    chips.forEach((c, i) => c.classList.toggle("on", p > 0.24 + i * 0.03 && p < 0.44));
    const fk = band(p, 0.3, 0.33);
    focus.style.opacity = String(fk > 0 ? 1 - band(p, 0.36, 0.4) : 0);
    focus.style.transform = `translate(-50%, -50%) scale(${1.3 - 0.3 * ease(fk)})`;
    shutter.classList.toggle("press", press);
    const fl = band(p, 0.355, 0.4);
    vflash.style.opacity = fl > 0 && fl < 1 ? String(0.9 * (1 - fl)) : "0";

    waterMat.uniforms.uT.value = now * 0.001; waterMat.uniforms.uFreeze.value = 1 - swim;
    const c = band(p, 0, 0.09);
    copy.style.opacity = String(1 - c); copy.style.transform = `translateY(${-60 * ease(c)}px)`; copy.style.pointerEvents = c > 0.5 ? "none" : "";
    hint.style.opacity = String(1 - band(p, 0, 0.07));
    const hv = band(p, 0.2, 0.26) * (1 - band(p, 0.75, 0.8));
    hud.style.opacity = String(hv); hud.style.transform = `translateY(${(1 - hv) * -10}px)`;
    const ev = ease(band(p, 0.79, 0.86));
    end.style.opacity = String(ev); end.style.transform = `translateY(${(1 - ev) * 28}px)`;
    end.classList.toggle("on", ev > 0.6);

    renderer.render(scene, camera);
  }
  whileVisible(hero, frame);
  frame(performance.now(), 0.016);
}
