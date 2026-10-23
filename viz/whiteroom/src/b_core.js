const $ = s => document.querySelector(s);
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const escapeHtml = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ---------- seeded randomness ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = mulberry32(1);
const rnd = (a = 0, b = 1) => a + (b - a) * R();
const pick = a => a[Math.floor(R() * a.length)];
const wide = () => clamp(.5 + (R() + R() - 1) * .85, .03, .97);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// value noise for the terrain
const PERM = new Uint8Array(512), VAL = new Float32Array(256);
function seedNoise(seed) {
  const r = mulberry32(seed ^ 0x9e3779b9), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) VAL[i] = r();
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const h = (a, b) => VAL[PERM[(PERM[a & 255] + b) & 255]];
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
}
function fbm(x, z, o = 4) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); n += a; a *= .5; f *= 2.03; } return s / n; }

// ---------- renderer ----------
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(50, 1, .1, 2000);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = 1.47;
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  const tl = $('#tl'), r = tl.getBoundingClientRect();
  tl.width = Math.max(10, r.width * devicePixelRatio); tl.height = Math.max(10, r.height * devicePixelRatio);
}
new ResizeObserver(resize).observe(stage);

// a gradient sky dome; colours are set per frame from the time of day
function makeSky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x8fb1d6) }, bottom: { value: new THREE.Color(0xdfe3dc) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(vP.y * 1.8 + .08, 0., 1.); gl_FragColor = vec4(mix(bottom, top, t), 1.); }',
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), m);
}

// ---------- faces ----------
// Each head is one sculpted mesh with a hand-painted face texture, the way a textured game character's
// face works: eyes, brows, lips, stubble and hairline are painted, and repainted as the expression changes.
const FACE_W = 384, IRIS = [0x5a3d24, 0x3b2a1a, 0x4a6a8a, 0x5d7a4a, 0x7a5a34, 0x2e2a28];
let HEAD_GEO = {};
function headGeometry(fem) {
  if (HEAD_GEO[fem]) return HEAD_GEO[fem];
  const r = .105, g = new THREE.SphereGeometry(r, 40, 30, -Math.PI / 2), P = g.attributes.position, UV = g.attributes.uv;
  const gs = (x, y, cx, cy, sx, sy) => Math.exp(-((x - cx) ** 2 / (2 * sx * sx) + (y - cy) ** 2 / (2 * sy * sy)));
  for (let i = 0; i < P.count; i++) {
    // remap uv so the face gets most of the texture: front ±1.2 rad of longitude over 70% of the width
    const u = UV.getX(i), v = 1 - UV.getY(i), d = (u - .5) * TAU, th = v * Math.PI;
    const ad = Math.abs(d), uu = ad < 1.2 ? .5 + d / 1.2 * .35 : .5 + Math.sign(d) * (.35 + (ad - 1.2) / (Math.PI - 1.2) * .15);
    const vv = th < .7 ? th / .7 * .15 : th < 2.6 ? .15 + (th - .7) / 1.9 * .75 : .9 + (th - 2.6) / (Math.PI - 2.6) * .1;
    UV.setXY(i, uu, 1 - vv);
    let x = P.getX(i) / r, y = P.getY(i) / r, z = P.getZ(i) / r;
    if (y < 0) { const t = -y; x *= 1 - (fem ? .32 : .26) * t * t; if (z > 0) z *= 1 - .05 * t; }
    if (z > 0) {
      const f = z;
      z += .2 * gs(x, y, 0, -.14, .06, .15) * f;                         // nose
      z += .045 * gs(x, y, 0, .3, .5, .07) * f;                          // brow ridge
      z -= .055 * (gs(x, y, .33, .1, .1, .07) + gs(x, y, -.33, .1, .1, .07)) * f;   // eye sockets
      z += .06 * gs(x, y, 0, -.8, .16, .09);                             // chin
      z += .03 * gs(x, y, 0, -.42, .16, .06) * f;                        // lips
      x += .035 * Math.sign(x) * gs(Math.abs(x), y, .55, -.05, .12, .12); // cheekbones
    }
    P.setXYZ(i, x * r * .92, y * r * 1.08, z * r);
  }
  g.computeVertexNormals();
  return (HEAD_GEO[fem] = g);
}
// where a point on the front of the face (unit coordinates: x across, y up) lands on the texture
function fp(x, y) {
  const th = Math.acos(clamp(y, -1, 1)), s = Math.max(.2, Math.sin(th)), dd = Math.asin(clamp(x / s, -1, 1));
  const vv = th < .7 ? th / .7 * .15 : th < 2.6 ? .15 + (th - .7) / 1.9 * .75 : .9 + (th - 2.6) / (Math.PI - 2.6) * .1;
  return [(.5 + dd / 1.2 * .35) * FACE_W, vv * FACE_W];
}
const KX = FACE_W * .35 / 1.2, KY = FACE_W * .75 / 1.9;   // pixels per unit near the middle of the face
const css = (c, k = 1, a = 1) => { const col = new THREE.Color(c).multiplyScalar(k); return `rgba(${Math.round(clamp(col.r) * 255)},${Math.round(clamp(col.g) * 255)},${Math.round(clamp(col.b) * 255)},${a})`; };
function makeFace(o) {
  const c = document.createElement('canvas'); c.width = c.height = FACE_W;
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;   // linear, so painted skin matches the body's flat skin colour
  const seed = Math.floor(Math.random() * 1e9), r = mulberry32(seed);
  const spots = Array.from({ length: 14 }, () => [r() * 2 - 1, r() * 1.4 - .9, .02 + r() * .05]);
  return { c, g: c.getContext('2d'), tex, key: '', t: 0, o, spots, iris: o.iris != null ? o.iris : IRIS[Math.floor(r() * IRIS.length)] };
}
function paintFace(h, s) {
  const fc = h.fc, g = fc.g, o = fc.o, W = FACE_W, fem = o.sex === 'f', zombie = !!o.zombie;
  const skin = new THREE.Color(o.skinC).lerp(new THREE.Color(0xd8d6c8), (s.pale || 0) * .3);
  g.fillStyle = css(skin); g.fillRect(0, 0, W, W);
  // soft modelling: darker toward the sides, under the jaw, and in the eye sockets
  let gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, css(skin, .9)); gr.addColorStop(.3, css(skin, .99)); gr.addColorStop(.5, css(skin, 1.01)); gr.addColorStop(.7, css(skin, .99)); gr.addColorStop(1, css(skin, .9));
  g.fillStyle = gr; g.fillRect(0, 0, W, W);
  gr = g.createLinearGradient(0, fp(0, -.6)[1], 0, fp(0, -.95)[1]); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,20,10,.28)'); g.fillStyle = gr; g.fillRect(0, fp(0, -.6)[1], W, W);
  const blob = (x, y, rx, ry, col) => { const [px, py] = fp(x, y), q = g.createRadialGradient(px, py, 0, px, py, rx * KX); q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(px, py); g.scale(1, ry / rx); g.translate(-px, -py); g.fillStyle = q; g.fillRect(px - rx * KX, py - rx * KX, rx * KX * 2, rx * KX * 2); g.restore(); };
  for (const sx of [-1, 1]) blob(sx * .33, .1, .2, .14, `rgba(60,30,20,${.12 + (s.tired || 0) * .25})`);
  // cheeks: a little colour, more when flushed
  const blush = (fem ? .12 : .05) + (s.blush || 0) * .4;
  for (const sx of [-1, 1]) blob(sx * .42, -.2, .2, .13, `rgba(200,80,70,${blush})`);
  // stubble and beard on men; it fills in over the days
  if (!fem && !zombie) {
    const bd = clamp(.18 + (s.beard || 0));
    g.save(); g.globalAlpha = bd * .55; g.fillStyle = css(o.hair, .9);
    g.beginPath(); const [ax, ay] = fp(-.62, -.15), [bx, by] = fp(.62, -.15), [cx2, cy2] = fp(0, -1);
    g.moveTo(ax, ay); g.quadraticCurveTo(fp(-.55, -.85)[0], cy2, cx2, cy2); g.quadraticCurveTo(fp(.55, -.85)[0], cy2, bx, by);
    const [mx, my] = fp(0, -.3); g.quadraticCurveTo(mx + 20, my - 6, mx, my - 4); g.quadraticCurveTo(mx - 20, my - 6, ax, ay); g.fill(); g.restore();
    if ((s.beard || 0) > .3) { g.globalAlpha = .4; for (let i = 0; i < 160; i++) { const x = Math.random() * 1.2 - .6, y = -.3 - Math.random() * .65, [px, py] = fp(x, y); g.fillStyle = css(o.hair, .7); g.fillRect(px, py, 1.5, 2.5); } g.globalAlpha = 1; }
  }
  // hair: painted with a hairline, and down the back and sides
  if (o.hairStyle !== 2) {
    const front = fp(0, fem ? .6 : .64)[1], nape = fp(0, o.hairStyle === 1 ? -.55 : -.25)[1], temple = fp(0, fem ? .25 : .35)[1];
    g.fillStyle = css(o.hair); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0);
    for (let X = W; X >= 0; X -= 4) { const dd = Math.abs(X / W - .5); const y = dd < .1 ? front + Math.cos(dd / .1 * Math.PI) * -4 + 4 : dd < .26 ? lerp(front, temple, smooth(.1, .26, dd)) : lerp(temple, nape, smooth(.26, .4, dd)); g.lineTo(X, y); }
    g.closePath(); g.fill();
    g.strokeStyle = css(o.hair, .7); g.lineWidth = 1;
    for (let i = 0; i < 70; i++) { const X = (i / 70) * W, y0 = 0; g.globalAlpha = .35; g.beginPath(); g.moveTo(X, y0); g.quadraticCurveTo(X + 6, front * .6, X + (X < W / 2 ? -4 : 4), front * .95); g.stroke(); }
    g.globalAlpha = 1;
  }
  // brows
  const browC = o.hairStyle === 2 ? css(o.hair, .8) : css(o.hair, .85);
  for (const sx of [-1, 1]) {
    const lift = (s.brow || 0) * .06 + (s.sad || 0) * .02 - (s.knit || 0) * .03, tilt = (s.knit || 0) * .5 - (s.sad || 0) * .45;
    const [px, py] = fp(sx * .31, .31 + lift);
    g.save(); g.translate(px, py); g.rotate(sx * (-.08 + tilt)); g.fillStyle = browC;
    g.beginPath(); g.ellipse(0, 0, .15 * KX, (fem ? .024 : .036) * KY, 0, Math.PI, 0); g.ellipse(0, 0, .15 * KX, (fem ? .01 : .016) * KY, 0, 0, Math.PI); g.fill(); g.restore();
  }
  // eyes: whites, iris, pupil, a highlight, and lids that close
  const open = clamp(1 - (s.shut || 0)) * (1 + (s.brow || 0) * .25);
  for (const sx of [-1, 1]) {
    const [px, py] = fp(sx * .31, .1), ew = .125 * KX, eh = .06 * KY * open;
    if (eh > 1) {
      g.save(); g.beginPath(); g.ellipse(px, py, ew, eh, 0, 0, TAU); g.clip();
      g.fillStyle = zombie ? '#cfcbb0' : '#f3efe8'; g.fillRect(px - ew, py - eh, ew * 2, eh * 2);
      if (!zombie) {
        const ix = px + (s.gaze || 0) * ew * .45;
        g.fillStyle = css(fc.iris); g.beginPath(); g.arc(ix, py, ew * .5, 0, TAU); g.fill();
        g.fillStyle = '#0d0b0a'; g.beginPath(); g.arc(ix, py, ew * (.22 + (s.brow || 0) * .1), 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(ix + ew * .15, py - ew * .15, ew * .1, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px - ew, py - eh, ew * 2, eh * .5);
      g.restore();
    }
    // upper lid line and lashes; a closed eye is just the line
    g.strokeStyle = 'rgba(25,15,10,.9)'; g.lineWidth = fem ? 2.6 : 1.8;
    g.beginPath(); g.ellipse(px, py, ew * 1.04, Math.max(1, eh) * 1.05, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    if (fem) { g.lineWidth = 1.4; for (let k = 0; k < 4; k++) { const a = Math.PI * (1.15 + k * .22), lx = px + Math.cos(a) * ew, ly = py + Math.sin(a) * Math.max(1, eh); g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + sx * 2.5 * Math.cos(a) * 0 + (k - 1.5) * 1.2, ly - 3); g.stroke(); } }
    if (eh <= 1) { g.beginPath(); g.ellipse(px, py, ew, 3, 0, 0, Math.PI); g.stroke(); }
    // tears
    if ((s.tears || 0) > .05) { g.strokeStyle = `rgba(170,200,230,${s.tears * .7})`; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px + sx * ew * .4, py + eh); g.quadraticCurveTo(px + sx * ew * .6, py + KY * .2, px + sx * ew * .5, py + KY * .38); g.stroke(); }
  }
  // nose shading and nostrils
  blob(-.08, -.08, .06, .16, 'rgba(70,35,20,.16)');
  for (const sx of [-1, 1]) { const [px, py] = fp(sx * .055, -.24); g.fillStyle = 'rgba(60,25,15,.55)'; g.beginPath(); g.ellipse(px, py, 3.2, 1.8, sx * .4, 0, TAU); g.fill(); }
  // mouth: lips shaped by the smile; open shows dark
  {
    const [mx, my] = fp(0, -.43), mw = (fem ? .25 : .23) * KX, sm = clamp(s.smile || 0, -1, 1), op = clamp(s.open || 0);
    const lip = new THREE.Color(o.skinC).lerp(new THREE.Color(zombie ? 0x4a4038 : fem ? 0xb0464e : 0x9a5550), fem ? .55 : .4);
    const cy = my - sm * 5, oh = op * 9;
    if (oh > 1) { g.fillStyle = '#2a1210'; g.beginPath(); g.ellipse(mx, my + oh * .3, mw * .7, oh, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(240,235,225,.9)'; g.fillRect(mx - mw * .45, my - oh * .5, mw * .9, Math.min(3, oh * .4)); }
    g.fillStyle = css(lip, 1.0);
    g.beginPath(); g.moveTo(mx - mw, cy); g.quadraticCurveTo(mx - mw * .4, my - (fem ? 10 : 7) - oh * .3, mx, my - 4 - oh * .3); g.quadraticCurveTo(mx + mw * .4, my - (fem ? 10 : 7) - oh * .3, mx + mw, cy);
    g.quadraticCurveTo(mx, my + sm * 4 - oh * .2, mx - mw, cy); g.fill();
    g.fillStyle = css(lip, 1.08);
    g.beginPath(); g.moveTo(mx - mw * .9, cy + 1); g.quadraticCurveTo(mx, my + sm * 4 + oh, mx + mw * .9, cy + 1); g.quadraticCurveTo(mx, my + (fem ? 13 : 9) + oh * 1.2, mx - mw * .9, cy + 1); g.fill();
    g.strokeStyle = 'rgba(60,20,15,.6)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(mx - mw, cy); g.quadraticCurveTo(mx, my + sm * 4 - 1, mx + mw, cy); g.stroke();
  }
  // grime, a sick sheen, a dead look
  if ((s.dirt || 0) > .1) for (const [x, y, rr] of fc.spots) blob(x, y, rr * 1.6, rr, `rgba(70,55,35,${(s.dirt - .1) * .5})`);
  if (zombie) { blob(.33, .05, .22, .16, 'rgba(60,70,40,.35)'); blob(-.33, .05, .22, .16, 'rgba(60,70,40,.35)'); }
  fc.tex.needsUpdate = true;
}
