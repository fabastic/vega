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

// ---------- people ----------
// Bodies are a hierarchy of simple shapes, in the low-poly, readable style of Project Zomboid survivors:
// layered clothes (shirt under an open jacket, jeans, boots), a face that shows what they feel, and a fist
// that can hold a tool.
const GEO = {
  cyl: (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s),
  sph: (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
};
const stdMat = (c, rough = .85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
const HAIR_STYLES = 6;   // 0 short, 1 long, 2 bald, 3 ponytail, 4 bun, 5 curly
// People are rigged characters, built the way the Codrops interactive character is: one skinned mesh over
// a skeleton of bones, so the body bends smoothly at the shoulders, elbows, hips and knees instead of
// coming apart at the joints. A morph target thins the whole body when he starves. The head, hands,
// boots and hair are rigid parts carried by their bones.
// bones: 0 body, 1 hips, 2 spine, 3 neck, 4 head, 5 L shoulder, 6 L elbow, 7 R shoulder, 8 R elbow, 9 L hip, 10 L knee, 11 R hip, 12 R knee
// ---------- clothes as textures ----------
// Knitwear: a turtleneck or crew-neck sweater, striped in bands that carry across the sleeves at the same
// height, with a stitch texture; and denim with twill and fading. The body's v coordinate is height in
// metres / 2, so a band painted at a height lands at that height on the torso and on both sleeves.
const TEXC = {};
const STACY = [0x6b4a36, 0x4e6763, 0xe7e1cf, 0xc89a2c, 0x2f241d];
const STACY_BANDS = [[0, 1.05, 0], [1.05, 1.1, 1], [1.1, 1.16, 0], [1.16, 1.25, 2], [1.25, 1.28, 3], [1.28, 1.33, 2], [1.33, 1.355, 4], [1.355, 1.43, 1], [1.43, 1.47, 0], [1.47, 1.556, 2], [1.556, 2, 4]];
function knitTex(kind, cols, neckCol) {
  const key = kind + cols.join(',') + neckCol;
  if (TEXC[key]) return TEXC[key];
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d');
  const Y = y => (1 - y / 2) * 512, hx = h => '#' + new THREE.Color(h).convertSRGBToLinear().getHexString();
  g.fillStyle = hx(cols[0]); g.fillRect(0, 0, 64, 512);
  if (kind === 'stripes') for (const [a, b, ci] of (cols.bands || STACY_BANDS)) { g.fillStyle = hx(cols[ci % cols.length]); g.fillRect(0, Y(b), 64, Y(a) - Y(b) + 1); }
  if (neckCol != null) { g.fillStyle = hx(neckCol); g.fillRect(0, 0, 64, Y(1.556)); }
  // stitches: little vees in rows, and a rib down the cuffs and collar
  for (let y = 0; y < 512; y += 4) for (let x = 0; x < 64; x += 4) { g.fillStyle = `rgba(0,0,0,${.06 + ((x * 7 + y * 3) % 5) * .012})`; g.fillRect(x, y, 1, 3); g.fillRect(x + 2, y, 1, 3); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 1, y + 1, 1, 2); }
  if (kind === 'rib') for (let x = 0; x < 64; x += 3) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, 0, 1, 512); }
  g.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < 64; x += 2) g.fillRect(x, Y(.99), 1, 10);   // ribbed hem
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.anisotropy = 4;
  return (TEXC[key] = t);
}
function denimTex(col) {
  const key = 'denim' + col; if (TEXC[key]) return TEXC[key];
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d'), base = new THREE.Color(col).convertSRGBToLinear();
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 2) for (let x = 0; x < 64; x += 2) { const v = ((x + y) % 4 === 0 ? .06 : 0) + Math.random() * .04; g.fillStyle = `rgba(255,255,255,${v * .35})`; g.fillRect(x, y, 1, 1); }
  const Y = y => (1 - y / 2) * 512;
  let gr = g.createLinearGradient(0, Y(.56), 0, Y(.4)); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, Y(.56), 64, Y(.4) - Y(.56));
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 1, 512); g.fillRect(32, 0, 1, 512);   // seams
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); t.anisotropy = 4;
  return (TEXC[key] = t);
}
function strandTex(col) {
  const key = 'hair' + col; if (TEXC[key]) return TEXC[key];
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'), base = new THREE.Color(col).convertSRGBToLinear();
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 128, 64);
  for (let x = 0; x < 128; x++) { const k = .75 + Math.random() * .5; g.fillStyle = '#' + base.clone().multiplyScalar(k).getHexString(); g.globalAlpha = .55; g.fillRect(x, 0, 1, 64); }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return (TEXC[key] = t);
}
// several small shapes merged into one geometry (hands, trainers)
function mergeGeos(parts) {
  const P = [], N = [];
  for (const [geo, m] of parts) { const g = geo.index ? geo.toNonIndexed() : geo; g.applyMatrix4(m); g.computeVertexNormals(); P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return out;
}
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const HANDG = {};
function handGeometry(side) {
  if (HANDG[side]) return HANDG[side];
  const parts = [[GEO.box(.046, .064, .022), M4(0, -.3, 0)]];
  for (let i = 0; i < 4; i++) parts.push([GEO.cyl(.0085, .0075, .052 - Math.abs(i - 1.5) * .006, 6), M4((i - 1.5) * .012, -.355, .006, .28, 0, 0)]);
  parts.push([GEO.cyl(.0095, .008, .045, 6), M4(-side * .027, -.3, .012, .3, 0, side * .55)]);
  return (HANDG[side] = mergeGeos(parts));
}
let SNEAKER = null;
function sneakerGeometry() {
  if (SNEAKER) return SNEAKER;
  SNEAKER = { upper: mergeGeos([[GEO.box(.088, .06, .17), M4(0, -.418, .03)], [GEO.sph(.046, 10, 8), M4(0, -.432, .115, 0, 0, 0, .95, .62, 1)], [GEO.cyl(.045, .048, .06, 10), M4(0, -.385, -.02)]]),
    sole: mergeGeos([[GEO.box(.095, .024, .24), M4(0, -.458, .05)]]) };
  return SNEAKER;
}
const HAIRCAP = {};
function hairCapGeometry() {
  if (HAIRCAP.g) return HAIRCAP.g;
  const g = new THREE.SphereGeometry(.108, 28, 14, 0, TAU, 0, 1.455); g.rotateX(-.525); g.scale(.95, 1.1, 1.04);
  return (HAIRCAP.g = g);
}

function bodyGeometry(b, shW, hpW, fem, o) {
  const pos = [], uv = [], thin = [], si = [], sw = [], idx = [[], [], []];   // groups: 0 top, 1 trousers, 2 skin
  const SEG = 24, smoothW = (a, b2, x) => smooth(a, b2, x);
  const turtle = o.neck === 'turtle', sleeveEnd = o.sleeve === 'short' ? 1.29 : o.sleeve === 'mid' ? 1.15 : .95;
  const tube = (rings, cx, matOf, capBottom) => {
    const base = pos.length / 3;
    for (const r of rings) {
      for (let k = 0; k <= SEG; k++) {
        const a = k / SEG * TAU, ca = Math.cos(a), sa = Math.sin(a);
        let x = cx + ca * r.rx, z = sa * r.rz;
        // the bust: two lobes either side of the breastbone
        const lobe = r.bump ? r.bump * (Math.exp(-((a - Math.PI / 2 - .4) ** 2) / .09) + Math.exp(-((a - Math.PI / 2 + .4) ** 2) / .09)) : 0;
        z += lobe * sa; x += lobe * ca * .35;
        pos.push(x, r.y, z); uv.push(k / SEG, r.y / 2);
        thin.push(cx + ca * r.rx * (r.thin ?? .62) + lobe * ca * .3, r.y, sa * r.rz * (r.thin ?? .62) + lobe * .85 * sa);
        const ws = r.w.slice(0, 4); while (ws.length < 4) ws.push([0, 0]);
        const tot = ws.reduce((s, x2) => s + x2[1], 0) || 1;
        for (const [bi, wv] of ws) { si.push(bi); sw.push(wv / tot); }
      }
    }
    const RW = SEG + 1;
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < SEG; k++) {
      const a = base + i * RW + k, b2 = a + 1, c = a + RW, d = b2 + RW;
      const m = matOf((rings[i].y + rings[i + 1].y) / 2);
      idx[m].push(a, c, b2, b2, c, d);
    }
    if (capBottom != null) {
      const r = rings[0], ci = pos.length / 3; pos.push(cx, r.y - .02, 0); uv.push(.5, r.y / 2); thin.push(cx, r.y - .02, 0);
      const ws = r.w.slice(0, 4); while (ws.length < 4) ws.push([0, 0]); const tot = ws.reduce((s, x2) => s + x2[1], 0) || 1; for (const [bi, wv] of ws) { si.push(bi); sw.push(wv / tot); }
      for (let k = 0; k < SEG; k++) idx[capBottom].push(ci, base + k, base + k + 1);
    }
  };
  const tw = y => y < .95 ? [[1, 1]] : y < 1.08 ? [[1, 1 - smoothW(.95, 1.08, y)], [2, smoothW(.95, 1.08, y)]] : y < 1.53 ? [[2, 1]] : y < 1.6 ? [[2, 1 - smoothW(1.53, 1.6, y)], [3, smoothW(1.53, 1.6, y)]] : [[3, 1]];
  const W = fem ? .9 : 1;   // a woman's waist draws in further
  const T = [[.8, .158 * hpW, .114], [.86, .17 * hpW, .122], [.93, .172 * hpW, .124], [.99, .16 * hpW, .116], [1.06, .148 * W, .106], [1.14, .152 * W, .108], [1.22, .166 * shW, .114],
    [1.26, .174 * shW, .118], [1.3, .182 * shW, .122], [1.34, .188 * shW, .123], [1.38, .194 * shW, .124], [1.41, .195 * shW, .121], [1.45, .195 * shW, .116], [1.5, .168 * shW, .1], [1.54, .1, .076], ...(turtle ? [[1.57, .066, .064], [1.62, .062, .061], [1.65, .058, .058]] : [[1.57, .056, .054], [1.63, .051, .051]])];
  tube(T.map(([y, rx, rz]) => ({ y, rx: rx * b, rz: rz * b, w: tw(y), bump: fem && !o.child ? .088 * Math.pow(Math.max(0, Math.sin((y - 1.23) / .2 * Math.PI)), 1.3) * (y > 1.23 && y < 1.43 ? 1 : 0) : 0, thin: y > 1.54 ? .88 : .66 })), 0,
    y => y < .985 ? 1 : y > 1.555 && !turtle ? 2 : 0, 1);
  const armK = fem ? .88 : 1;
  for (const side of [1, -1]) {
    const sh = side > 0 ? 5 : 7, el = sh + 1, cx = side * .215 * b * shW;
    const aw = y => y > 1.44 ? [[2, smoothW(1.44, 1.52, y) * .7], [sh, 1 - smoothW(1.44, 1.52, y) * .7]] : y > 1.235 ? [[sh, 1]] : y > 1.13 ? [[sh, 1 - smoothW(1.13, 1.235, 2.365 - y)], [el, smoothW(1.13, 1.235, 2.365 - y)]] : [[el, 1]];
    let A = [[1.55, .05], [1.52, .062], [1.46, .06], [1.38, .054], [1.3, .05], [1.22, .045], [1.18, .043], [1.12, .043], [1.04, .039], [.97, .033], [.91, .03]];
    // a short sleeve ends in a slightly flared hem, then bare arm
    if (o.sleeve === 'short') A = [[1.55, .05], [1.52, .064], [1.46, .063], [1.38, .06], [1.3, .058], [1.295, .046], [1.22, .044], [1.18, .042], [1.12, .042], [1.04, .038], [.97, .032], [.91, .03]];
    tube(A.slice().reverse().map(([y, r]) => ({ y, rx: r * b * armK, rz: r * b * armK * .92, w: aw(y), thin: .68 })), cx, y => y > sleeveEnd ? 0 : 2, 2);
  }
  for (const side of [1, -1]) {
    const hp = side > 0 ? 9 : 11, kn = hp + 1, cx = side * .095 * b * hpW;
    const lw = y => y > .9 ? [[1, smoothW(.9, 1.0, y) * .8], [hp, 1 - smoothW(.9, 1.0, y) * .8]] : y > .51 ? [[hp, 1]] : y > .39 ? [[hp, smoothW(.39, .51, y)], [kn, 1 - smoothW(.39, .51, y)]] : [[kn, 1]];
    const Lg = [[1.0, .088], [.92, .086], [.82, .078], [.7, .068], [.58, .058], [.48, .054], [.42, .053], [.33, .052], [.22, .045], [.1, .041]];
    tube(Lg.slice().reverse().map(([y, r]) => ({ y, rx: r * b, rz: r * b * .95, w: lw(y), thin: .72 })), cx, () => 1, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const all = []; idx.forEach((list, m) => { geo.addGroup(all.length, list.length, m); all.push(...list); });
  geo.setIndex(all); geo.computeVertexNormals();
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(thin, 3)];
  return geo;
}
function makeHuman(o) {
  const ghost = !!o.ghost, shadow = !!o.shadow, fem = o.sex === 'f', child = !!o.child;
  const mat = (c, rough, skinned, map) => {
    const m = ghost || shadow ? new THREE.MeshBasicMaterial({ color: shadow ? 0x0b0b0e : c, transparent: true, opacity: 0, depthWrite: false }) : new THREE.MeshStandardMaterial({ color: map ? 0xffffff : c, roughness: rough, map: map || null });
    if (skinned) { m.skinning = true; m.morphTargets = true; }
    return m;
  };
  // the palette is authored in sRGB; convert so the colours render as picked
  const lin = c => new THREE.Color(c).convertSRGBToLinear().getHex();
  const raw = o;
  o = Object.assign({}, o, { skin: lin(o.skin), shirt: lin(o.shirt), pants: lin(o.pants), hair: lin(o.hair), jacket: o.jacket != null ? lin(o.jacket) : null, boots: o.boots != null ? lin(o.boots) : null });
  const skinC = o.zombie ? new THREE.Color(o.skin).lerp(new THREE.Color(0x4a5a3a), .6).getHex() : o.skin;
  const jacketed = o.jacket != null, knit = !ghost && !shadow;
  const topTex = knit ? knitTex(raw.top || 'plain', raw.stripes || [raw.shirt], raw.neck === 'turtle' ? (raw.neckCol != null ? raw.neckCol : null) : null) : null;
  const topMat = mat(jacketed ? o.jacket : o.shirt, .92, true, jacketed ? null : topTex), pants = mat(o.pants, .88, true, knit ? denimTex(raw.pants) : null), skinBody = mat(skinC, .62, true);
  const skin = mat(skinC, .62), shirt = mat(o.shirt, .9, false, topTex), hair = knit ? new THREE.MeshStandardMaterial({ map: strandTex(raw.hair), roughness: .55 }) : mat(o.hair, .9);
  const shoeC = raw.shoes === 'sneaker' ? 0xe9e9e6 : (o.boots != null ? o.boots : 0x3a2c22);
  const shoe = mat(shoeC, raw.shoes === 'sneaker' ? .5 : .75), sole = mat(raw.shoes === 'sneaker' ? 0xb9bab6 : 0x17140f, .9), belt = mat(0x2e241c, .6), buckle = mat(0xb59a5a, .35);
  const handL = mat(skinC, .62), handR = mat(skinC, .62);
  const b = (o.build || 1) * (child ? .85 : 1), shW = fem ? .9 : 1, hpW = fem ? 1.1 : 1;
  const bone = (parent, x, y, z) => { const bn = new THREE.Bone(); bn.position.set(x, y, z); if (parent) parent.add(bn); return bn; };
  const root = new THREE.Group();
  const body = bone(null, 0, .95, 0); root.add(body);
  const hips = bone(body, 0, 0, 0), spine = bone(hips, 0, .06, 0), neck = bone(spine, 0, .55, 0), head = bone(neck, 0, .08, 0);
  const shL = bone(spine, .215 * b * shW, .47, 0), elL = bone(shL, 0, -.3, 0), shR = bone(spine, -.215 * b * shW, .47, 0), elR = bone(shR, 0, -.3, 0);
  const hpL = bone(hips, .095 * b * hpW, -.06, 0), knL = bone(hpL, 0, -.44, 0), hpR = bone(hips, -.095 * b * hpW, -.06, 0), knR = bone(hpR, 0, -.44, 0);
  const bones = [body, hips, spine, neck, head, shL, elL, shR, elR, hpL, knL, hpR, knR];
  const geo = bodyGeometry(b, shW, hpW, fem, { neck: raw.neck, sleeve: raw.sleeve, child });
  const mesh = new THREE.SkinnedMesh(geo, [topMat, pants, skinBody]);
  mesh.castShadow = mesh.receiveShadow = !(ghost || shadow); mesh.frustumCulled = false;
  root.add(mesh); root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.morphTargetInfluences[0] = 0;
  const add = (p, g, m, y = 0, x = 0, z = 0) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = !(ghost || shadow); me.receiveShadow = !(ghost || shadow); p.add(me); return me; };
  // a belt that peeks out under the hem, and the open jacket's front
  add(hips, GEO.cyl(.165 * b * hpW, .165 * b * hpW, .03, 18), belt, .015).scale.z = .72;
  if (!fem) add(hips, GEO.box(.04, .028, .01), buckle, .015, 0, .121 * b);
  if (jacketed) add(spine, GEO.box(.1 * b, .46, .02), shirt, .26, 0, .123 * b).rotation.x = -.06;
  // head: one sculpted mesh with a painted face
  if (child) head.scale.setScalar(1.28);
  const fc = shadow ? null : makeFace({ skinC, hair: o.hair, hairStyle: o.hairStyle || 0, sex: o.sex, zombie: !!o.zombie, iris: o.iris });
  const headMat = shadow ? mat(0x0b0b0e) : ghost ? new THREE.MeshBasicMaterial({ map: fc.tex, color: 0xc9c4bc, transparent: true, opacity: 0, depthWrite: false }) : new THREE.MeshStandardMaterial({ map: fc.tex, roughness: .55 });
  const headMesh = add(head, headGeometry(fem), headMat, .085);
  for (const s of [-1, 1]) add(head, GEO.sph(.022, 8, 6), skin, .082, s * .092, -.005).scale.set(.45, 1, .8);
  // hair: swept back over the crown with strands, then the style's own shape
  const style = o.hairStyle || 0, hairMeshes = [];
  if (style !== 2) { const cp = add(head, hairCapGeometry(), hair, .085, 0, -.004); hairMeshes.push(cp); }
  if (style === 1) { const back = add(head, GEO.sph(.1, 16, 12), hair, .0, 0, -.045); back.scale.set(.95, 1.25, .55); hairMeshes.push(back); }
  if (style === 3) { const t = add(head, GEO.cyl(.024, .008, .24, 8), hair, .03, 0, -.14); t.rotation.x = .45; hairMeshes.push(t); add(head, GEO.sph(.026, 8, 6), hair, .1, 0, -.11); }
  if (style === 4) { hairMeshes.push(add(head, GEO.sph(.05, 14, 12), hair, .12, 0, -.115)); hairMeshes[hairMeshes.length - 1].scale.set(1, .9, .85); }
  if (style === 5) for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; hairMeshes.push(add(head, GEO.sph(.036, 8, 6), hair, .16 + Math.sin(a * 2) * .01, Math.cos(a) * .074, Math.sin(a) * .07 - .02)); }
  // hands with fingers, trainers or boots
  const handOn = (el, side) => {
    const hand = add(el, handGeometry(side), side > 0 ? handL : handR);
    const sock = new THREE.Group(); sock.position.set(0, -.345, .01); el.add(sock);
    if (jacketed) add(el, GEO.cyl(.05, .047, .05, 12), mat(o.jacket, .85), -.02);
    return { hand, sock };
  };
  const hl = handOn(elL, 1), hr = handOn(elR, -1);
  for (const kn of [knL, knR]) {
    if (raw.shoes === 'sneaker') { const sg = sneakerGeometry(); add(kn, sg.upper, shoe); add(kn, sg.sole, sole); }
    else { add(kn, GEO.cyl(.052, .055, .12, 12), shoe, -.36); add(kn, GEO.box(.096, .068, .2), shoe, -.425, 0, .045); add(kn, GEO.box(.1, .022, .23), sole, -.462, 0, .05); }
  }
  const pack = new THREE.Group(); pack.visible = false; spine.add(pack);
  { const pm = mat(0x55603f, .9), sm = mat(0x3a3324, .8);
    add(pack, GEO.box(.27, .34, .13), pm, .33, 0, -.18); add(pack, GEO.box(.24, .12, .05), pm, .22, 0, -.26);
    add(pack, GEO.box(.28, .07, .15), sm, .52, 0, -.17); add(pack, GEO.cyl(.05, .05, .3, 8), mat(0x6f6a5a, .9), .1, 0, -.2).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) add(pack, GEO.box(.035, .36, .02), sm, .34, s * .1, .13).rotation.x = .12; }
  root.scale.setScalar((o.height || 1.75) / 1.75);
  const L = { sh: shL, el: elL, hand: hl.hand, sock: hl.sock }, Rr = { sh: shR, el: elR, hand: hr.hand, sock: hr.sock };
  const hm = { root, body, hips, spine, neck, head, mesh, headMesh, fc, L, R: Rr, LL: { hp: hpL, kn: knL }, RL: { hp: hpR, kn: knR }, handL, handR, hairMeshes, pack,
    socketR: Rr.sock, socketL: L.sock, skin: new THREE.Color(skinC), shirtMat: topMat, shirtBase: topMat.color.clone(), pantsMat: pants, pantsBase: pants.color.clone(),
    mats: [topMat, pants, skinBody, skin, shirt, hair, shoe, sole, belt, buckle, headMat, handL, handR], pose: basePose(), phase: 0, mass: 1, ghost, shadow, fem, child,
    face: { brow: 0, knit: 0, sad: 0, smile: 0, open: 0, shut: 0, gaze: 0 }, blink: Math.random() * 4, look: null, lookW: 0, lookYaw: 0, lookPitch: 0, beardAmt: 0, dirt: 0 };
  if (fc) paintFace(hm, {});
  return hm;
}
// what people wear: the women in the striped turtleneck, slim dark jeans and white trainers of the
// reference character; the men in the same spirit, in knitwear, slim jeans and trainers or boots
const MALE_KNITS = [[0x2b3a52, 0x8c939a, 0xe6e2d8], [0x3c4a34, 0xd8cfb4, 0x7a5a3a], [0x5a2a2a, 0x9a9a96, 0x2a2a2e], [0x2f2f33, 0x6a7a8a, 0xd8d4c8], [0x6a5a48, 0xe0d8c4, 0x3a4a5a]];
const MALE_BANDS = [[0, 1.12, 0], [1.12, 1.17, 1], [1.17, 1.21, 2], [1.21, 1.26, 1], [1.26, 1.36, 0], [1.36, 1.4, 2], [1.4, 2, 0]];
function wardrobe(sex, isVega, shirt) {
  if (isVega) return { top: 'rib', stripes: [shirt], neck: 'crew', sleeve: 'long', shoes: 'boot', pants: 0x2c3442 };
  if (sex === 'f') {
    const exact = R() < .6, pal = exact ? STACY : STACY.map(c => new THREE.Color(c).offsetHSL(rnd(-.025, .025), rnd(-.05, .03), rnd(-.04, .04)).getHex());
    return { top: 'stripes', stripes: pal, neck: 'turtle', neckCol: pal[4], sleeve: 'short', shoes: 'sneaker', pants: pick([0x1e2622, 0x1f2430, 0x232220, 0x2a2f3a]) };
  }
  const k = R();
  if (k < .5) { const pal = pick(MALE_KNITS); pal.bands = MALE_BANDS; return { top: 'stripes', stripes: pal, neck: R() < .3 ? 'turtle' : 'crew', neckCol: pal[0], sleeve: R() < .7 ? 'long' : 'short', shoes: R() < .5 ? 'sneaker' : 'boot', pants: pick([0x2f4058, 0x1f2430, 0x3a3a3e, 0x5a5444]) }; }
  return { top: k < .8 ? 'rib' : 'plain', stripes: [pick([0x3a4a5a, 0x5a3a2a, 0x4a5a3a, 0x7a6a5a, 0x2a2a2e, 0x8a7a5a])], neck: R() < .35 ? 'turtle' : 'crew', sleeve: R() < .75 ? 'long' : 'short', shoes: R() < .5 ? 'sneaker' : 'boot', pants: pick([0x2f4058, 0x1f2430, 0x3a3a3e, 0x5a5444]) };
}
// After the pose is applied, the neck and head turn toward whatever he is looking at, the way the
// Codrops character follows the cursor: the turn is split between neck and head and clamped to what a
// neck can do.
const _lv = new THREE.Vector3();
function lookAtPoint(h, target, dt, weight = 1) {
  const want = target && weight > 0 && Math.abs(h.pose.tx) < .4 && Math.abs(h.pose.tz) < .4;
  h.lookW += ((want ? weight : 0) - h.lookW) * Math.min(1, dt * 4);
  if (want) {
    h.neck.getWorldPosition(_lv);
    const dx = target.x - _lv.x, dz = target.z - _lv.z, dy = target.y - _lv.y - .1;
    const yaw = clamp(angDiff(h.root.rotation.y, Math.atan2(dx, dz)), -1.25, 1.25), pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -.55, .6);
    h.lookYaw += (yaw - h.lookYaw) * Math.min(1, dt * 5); h.lookPitch += (pitch - h.lookPitch) * Math.min(1, dt * 5);
  }
  if (h.lookW < .01) return;
  h.neck.rotation.y += h.lookYaw * .55 * h.lookW; h.head.rotation.y = h.lookYaw * .45 * h.lookW;
  h.neck.rotation.x += h.lookPitch * .5 * h.lookW; h.head.rotation.x = h.lookPitch * .4 * h.lookW;
  h.face.gaze = clamp(h.lookYaw * .9, -1, 1) * h.lookW;
}
const PK = ['y', 'tx', 'tz', 'sx', 'sz', 'nx', 'ny', 'nz', 'lsx', 'lsz', 'lex', 'rsx', 'rsz', 'rex', 'lhx', 'lhz', 'lkx', 'rhx', 'rhz', 'rkx', 'mo'];
function basePose() { const p = {}; PK.forEach(k => p[k] = 0); p.lsz = p.rsz = .07; p.lex = p.rex = .15; return p; }
function applyPose(h, t, k) {
  const p = h.pose;
  for (const key of PK) p[key] += (t[key] - p[key]) * k;
  h.body.position.y = .95 + p.y; h.body.rotation.x = p.tx; h.body.rotation.z = p.tz;
  h.spine.rotation.x = p.sx; h.spine.rotation.z = p.sz;
  h.neck.rotation.x = p.nx; h.neck.rotation.y = p.ny; h.neck.rotation.z = p.nz;
  h.L.sh.rotation.x = -p.lsx; h.L.sh.rotation.z = p.lsz; h.L.el.rotation.x = -p.lex;
  h.R.sh.rotation.x = -p.rsx; h.R.sh.rotation.z = -p.rsz; h.R.el.rotation.x = -p.rex;
  h.LL.hp.rotation.x = -p.lhx; h.LL.hp.rotation.z = p.lhz; h.LL.kn.rotation.x = p.lkx;
  h.RL.hp.rotation.x = -p.rhx; h.RL.hp.rotation.z = -p.rhz; h.RL.kn.rotation.x = p.rkx;
}
// Faces: brows lift with fear, knit with anger, tilt up in the middle with sadness; the mouth
// corners follow mood; eyes blink on their own and close in sleep.
function setFace(h, e, dt) {
  const F = h.face, k = Math.min(1, dt * 5);
  for (const key of ['brow', 'knit', 'sad', 'smile', 'open', 'shut']) F[key] += ((e[key] || 0) - F[key]) * k;
  h.blink -= dt;
  let lid = F.shut;
  if (h.blink < 0) { lid = 1; if (h.blink < -.14) h.blink = (e.nervous ? .7 : 2.2) + Math.random() * 3; }
  if (!h.fc) return;
  const st = { brow: F.brow, knit: F.knit, sad: F.sad, smile: F.smile, open: Math.max(F.open, h.pose.mo * .8), shut: lid, gaze: F.gaze, blush: e.blush || 0, tears: e.tears || 0, tired: e.tired || 0, pale: e.pale || 0, dirt: h.dirt, beard: h.beardAmt };
  const q = v => Math.round(v * 8);
  const key = Object.values(st).map(q).join(',');
  const now = performance.now();
  if (key !== h.fc.key && now - h.fc.t > 70) { h.fc.key = key; h.fc.t = now; paintFace(h, st); }
}
// what his body shows of his state of mind
const faceFrom = (s, asleep, x = {}) => ({ brow: clamp(s.fear * .9 - .25 + (s.surprise || 0) * .6), knit: clamp(s.anger * 1.2), sad: clamp(Math.max(s.grief || 0, (1 - s.hope) * .7, s.loneliness * .6, s.heartbreak || 0) - .15),
  smile: clamp((s.hope - .45) * .8 + (s.joy || 0) * .5 + (s.love || 0) * .2 - (s.grief || 0) * .6 - s.fear * .3, -1, 1), open: s.fear > .75 ? .25 : 0, shut: asleep ? 1 : 0, nervous: s.fear > .55,
  blush: clamp((s.attraction || 0) * (x.crushNear ? 1 : .2) + (s.lust || 0) * .3 + (s.shame || 0) * .3), tears: clamp(((s.grief || 0) + (1 - s.hope) * .5 + (s.heartbreak || 0)) - .9), tired: clamp((s.sleep || 0) - .3), pale: clamp(1 - (s.health == null ? 1 : s.health) - .2) });

// ---------- tools and things people carry ----------
const TOOLMAT = {};
const tmat = (c, r = .7, m = 0, e = 0) => TOOLMAT[[c, r, m, e]] || (TOOLMAT[[c, r, m, e]] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e ? c : 0, emissiveIntensity: e }));
function makeTool(kind) {
  const g = new THREE.Group(), wood = tmat(0x7a5a3a, .8), steel = tmat(0x8d9399, .35, .6), dark = tmat(0x2e2c2a, .5, .3), H = Math.PI / 2;
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = true; g.add(me); return me; };
  switch (kind) {
    case 'axe': add(GEO.cyl(.018, .022, .72, 6), wood, 0, 0, .22, H); add(GEO.box(.022, .07, .12), dark, 0, .02, .54); add(GEO.box(.012, .17, .05), steel, 0, .06, .6); break;
    case 'hammer': add(GEO.cyl(.014, .017, .36, 6), wood, 0, 0, .1, H); add(GEO.box(.04, .12, .04), dark, 0, .02, .28); break;
    case 'spear': add(GEO.cyl(.016, .016, 1.8, 6), wood, 0, 0, .3, H); add(new THREE.ConeGeometry(.035, .18, 6), steel, 0, 0, 1.28, H); add(GEO.cyl(.022, .022, .05, 6), tmat(0x4a3a2a), 0, 0, 1.17, H); break;
    case 'rod': add(GEO.cyl(.007, .014, 1.7, 5), wood, 0, 0, .7, H); add(GEO.cyl(.002, .002, 1.3, 3), tmat(0xdcdcdc, .5), 0, -.62, 1.55); break;
    case 'shovel': add(GEO.cyl(.017, .017, 1.05, 6), wood, 0, 0, .35, H); add(GEO.box(.16, .2, .015), steel, 0, -.05, .93, .4); add(GEO.box(.12, .025, .025), wood, 0, 0, -.18); break;
    case 'crowbar': add(GEO.cyl(.012, .012, .62, 6), dark, 0, 0, .2, H); add(GEO.box(.02, .07, .02), dark, 0, .03, .52, .6); break;
    case 'knife': add(GEO.box(.006, .028, .16), steel, 0, 0, .12); add(GEO.box(.018, .024, .09), dark, 0, 0, -.01); break;
    case 'book': add(GEO.box(.16, .035, .21), tmat(pick([0x8a3b2c, 0x2b5a7a, 0x5d6f3a, 0x6a4f9c])), 0, .02, .06); add(GEO.box(.15, .03, .2), tmat(0xeee8d8, .9), .005, .022, .06); break;
    case 'journal': add(GEO.box(.13, .02, .18), tmat(0x5a4632), 0, .015, .06); add(GEO.box(.006, .006, .14), dark, .09, .03, .05, 0, .4); break;
    case 'bread': add(GEO.box(.12, .06, .08), tmat(0xc89b5e, .9), 0, .02, .05); break;
    case 'meat': add(GEO.box(.12, .05, .08), tmat(0x9a3b30, .6), 0, .02, .05); break;
    case 'photo': add(GEO.box(.09, .12, .004), tmat(0xf2efe6, .9), 0, .05, .05, -.3); add(GEO.box(.075, .09, .005), tmat(0x8a7058, .8), 0, .055, .053, -.3); break;
    case 'mirror': add(GEO.box(.13, .17, .012), dark, 0, .07, .05, -.3); add(GEO.box(.11, .15, .004), tmat(0xcfd8de, .08, .25, .15), 0, .07, .057, -.3); break;
    case 'torch': add(GEO.cyl(.018, .022, .5, 6), wood, 0, .2, .02); add(new THREE.ConeGeometry(.05, .15, 6), tmat(0xffa040, .5, 0, 1.4), 0, .5, .02); break;
    case 'bucket': add(GEO.cyl(.11, .09, .2, 12), tmat(0x7d8288, .4, .5), 0, -.16, 0); add(new THREE.TorusGeometry(.1, .006, 4, 12, Math.PI), dark, 0, -.05, 0); break;
    case 'basket': add(GEO.cyl(.15, .11, .14, 10), tmat(0xa9844f, .95), 0, -.12, 0); break;
    case 'rock': add(GEO.sph(.06, 7, 6), tmat(0x84807a, .95), 0, 0, .03); break;
    case 'nail': add(GEO.cyl(.004, .004, .07, 4), steel, 0, 0, .04, H); break;
    case 'syringe': add(GEO.cyl(.01, .01, .1, 6), tmat(0xd9e3e6, .2), 0, 0, .06, H); add(GEO.cyl(.002, .002, .05, 3), steel, 0, 0, .13, H); break;
    case 'saw': add(GEO.box(.006, .1, .4), steel, 0, -.03, .22); add(GEO.box(.025, .06, .1), wood, 0, 0, -.02); break;
    case 'rifle': add(GEO.box(.035, .06, .9), tmat(0x4a3826), 0, 0, .25); add(GEO.cyl(.012, .012, .5, 6), dark, 0, .03, .65, H); break;
    case 'flower': add(GEO.cyl(.004, .004, .2, 4), tmat(0x4f7038), 0, .08, .02); add(GEO.sph(.025, 6, 5), tmat(0xd8b23a), 0, .19, .02); break;
  }
  return g;
}
function holdTool(h, kind, left) {
  const sock = left ? h.socketL : h.socketR;
  if (!sock || sock.userData.kind === kind) return;
  sock.userData.kind = kind;
  for (const c of sock.children) c.visible = false;
  if (!kind) return;
  h.toolCache = h.toolCache || {};
  const key = (left ? 'L' : 'R') + kind;
  let t = h.toolCache[key]; if (!t) { t = makeTool(kind); h.toolCache[key] = t; sock.add(t); }
  t.visible = true;
}
function setMass(h, m) { h.mass = m; if (h.mesh) h.mesh.morphTargetInfluences[0] = clamp((1 - m) * 1.6); }
// beard and hair grow; clothes collect dirt
function setGrooming(h, days, dirt) {
  h.beardAmt = h.fem ? 0 : clamp(days / 40) * .9; h.dirt = dirt;
  for (const m of h.hairMeshes) m.scale.y = 1.15 + clamp(days / 120) * .4;
  h.shirtMat.color.copy(h.shirtBase).lerp(new THREE.Color(0x4a3f33), dirt * .55);
  h.pantsMat.color.copy(h.pantsBase).lerp(new THREE.Color(0x3d342a), dirt * .5);
}

// Poses: every activity is a function of a phase and the body's condition (slump, tremor).
function pose(kind, ph, c = {}) {
  const p = basePose();
  const slump = c.slump || 0, trem = c.tremor || 0;
  const breathe = Math.sin(ph * .5) * .02;
  p.sx = .03 + slump * .3 + breathe; p.nx = .04 + slump * .35;
  switch (kind) {
    case 'stand': p.sz = Math.sin(ph * .21) * .025; p.tz = Math.sin(ph * .21) * .015; p.ny = Math.sin(ph * .13) * .25; p.lhz = Math.max(0, Math.sin(ph * .21)) * .05; p.rhz = Math.max(0, -Math.sin(ph * .21)) * .05; break;
    case 'walk': case 'pace': case 'shamble': case 'stagger': {
      const a = c.amp == null ? 1 : c.amp, s = Math.sin(ph);
      p.lhx = s * .5 * a; p.rhx = -s * .5 * a;
      p.lkx = Math.max(0, Math.sin(ph - 1.3)) * .9 * a + .05; p.rkx = Math.max(0, Math.sin(ph + Math.PI - 1.3)) * .9 * a + .05;
      p.lsx = -s * .38 * a; p.rsx = s * .38 * a; p.lex = p.rex = .3;
      p.y = Math.abs(Math.cos(ph)) * .03 - .02; p.sx += .06; p.sz = Math.sin(ph) * .03; p.ny = -Math.sin(ph) * .05;
      if (kind === 'shamble') { p.lsx = p.rsx = 1.35 + s * .1; p.lex = p.rex = .15; p.nz = .25; p.nx = .3; p.sz = .12 * Math.sin(ph * .5); p.lhx *= .6; p.rhx *= .6; }
      if (kind === 'stagger') { p.tz = Math.sin(ph * .5) * .12; p.sx += .25; p.nx += .2; }
      break;
    }
    case 'run': {
      const s = Math.sin(ph);
      p.lhx = s * .8; p.rhx = -s * .8; p.lkx = Math.max(0, Math.sin(ph - 1.2)) * 1.5 + .2; p.rkx = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * 1.5 + .2;
      p.lsx = -s * .7; p.rsx = s * .7; p.lex = p.rex = 1.3; p.sx = .2; p.y = Math.abs(Math.cos(ph)) * .06 - .03; break;
    }
    case 'turn': { const s = Math.sin(ph * 2); p.lhx = Math.max(0, s) * .3; p.rhx = Math.max(0, -s) * .3; p.lkx = Math.max(0, s) * .4; p.rkx = Math.max(0, -s) * .4; break; }
    case 'sit_hug': case 'rock':
      p.y = -.8; p.lhx = p.rhx = 1.95; p.lkx = p.rkx = 2.3; p.sx = .5 + slump * .2; p.nx = .4;
      p.lsx = p.rsx = .85; p.lsz = p.rsz = .28; p.lex = p.rex = 1.55;
      if (kind === 'rock') p.sx += Math.sin(ph) * .28; break;
    case 'sit_wall': case 'read': case 'warm': case 'fish': case 'hold_sit':
      p.y = -.8; p.lhx = p.rhx = 1.5; p.lkx = p.rkx = .15; p.lhz = p.rhz = .1; p.sx = .02 + slump * .45; p.nx = .1 + slump * .4;
      p.lsx = p.rsx = .3; p.lex = p.rex = .35;
      if (kind === 'read') { p.lsx = p.rsx = .55; p.lex = p.rex = 1.3; p.nx = .45; }
      if (kind === 'hold_sit') { p.rsx = .9; p.rex = 1.5; p.nx = .45; p.lkx = 1.2; }
      if (kind === 'warm') { p.lsx = p.rsx = .95; p.lex = p.rex = .4; p.lkx = p.rkx = 1.2; p.sx = .3; }
      if (kind === 'fish') { p.rsx = 1.0 + Math.sin(ph * .3) * .05; p.rex = .3; p.lsx = .9; p.lex = .5; p.nx = .15; }
      break;
    case 'sit_bed':
      p.y = -.47; p.lhx = p.rhx = 1.5; p.lkx = p.rkx = 1.45; p.sx = .2 + slump * .4; p.nx = .2 + slump * .4; p.lsx = p.rsx = .45; p.lex = p.rex = .9; p.lsz = p.rsz = .12; break;
    case 'bed':
      p.y = -.35; p.tx = -Math.PI / 2; p.lsz = p.rsz = .2; p.lkx = p.rkx = .15; p.lhx = p.rhx = .12; p.sx = breathe; break;
    case 'eat_sit':
      p.y = -.8; p.lhx = p.rhx = 1.5; p.lkx = 1.6; p.rkx = .3; p.sx = .25;
      p.rsx = .9; p.rex = 2.2 + Math.sin(ph * 2) * .2; p.lsx = .7; p.lex = 1.4; p.nx = .2; p.mo = Math.max(0, Math.sin(ph * 4)) * .5; break;
    case 'eat_stand':
      p.rsx = .9; p.rex = 2.1 + Math.sin(ph * 2) * .2; p.lsx = .4; p.lex = 1.1; p.mo = Math.max(0, Math.sin(ph * 4)) * .5; break;
    case 'lie':
      p.y = -.83; p.tx = -Math.PI / 2; p.sx = breathe; p.nx = 0; p.lsz = p.rsz = .2; p.lkx = p.rkx = .15; p.lhx = p.rhx = .12; break;
    case 'curl':
      p.y = -.8; p.tz = Math.PI / 2; p.lhx = p.rhx = 1.4; p.lkx = p.rkx = 1.8; p.sx = .55; p.nx = .5;
      p.lsx = p.rsx = 1.3; p.lex = p.rex = 1.9; p.lsz = p.rsz = .1; break;
    case 'collapsed':
      p.y = -.84; p.tx = -Math.PI / 2; p.tz = .25; p.lsz = .9; p.rsz = .3; p.lex = .2; p.rex = .9; p.lhz = .25; p.lkx = .5; p.nx = -.3; p.ny = .7; break;
    case 'reach_wall': {
      const s = Math.sin(ph * .8);
      p.lsx = 1.45 + s * .12; p.rsx = 1.45 - s * .12; p.lsz = .3 + s * .15; p.rsz = .3 - s * .15; p.lex = p.rex = .25;
      p.lhz = Math.max(0, s) * .18; p.rhz = Math.max(0, -s) * .18; p.nx = .1; break;
    }
    case 'punch': {
      const a = Math.max(0, Math.sin(ph * 2.2));
      p.rsx = .85 + .7 * a; p.rex = 1.8 * (1 - a) + .05; p.lsx = .95; p.lex = 1.7; p.lsz = .15;
      p.sx = .12 + a * .12; p.sz = -a * .12; p.lhx = .25; p.rkx = .25; p.y = -.04; p.mo = a * .6; break;
    }
    case 'hammer': case 'build': {
      const a = Math.max(0, Math.sin(ph * 2));
      p.rsx = 1.3 + a * 1.1; p.rex = .5 + a * .6; p.lsx = .9; p.lex = 1; p.sx = .35; p.nx = .3;
      if (kind === 'build') { p.y = -.25; p.lkx = p.rkx = 1; p.lhx = p.rhx = .7; } break;
    }
    case 'chop': {
      const a = (Math.sin(ph * 1.6) + 1) / 2;
      p.lsx = p.rsx = .6 + a * 2.2; p.lsz = p.rsz = .05; p.lex = p.rex = .3 + (1 - a) * .3; p.sx = .45 - a * .5; p.lhx = .25; p.rhx = -.1; p.lkx = .3; break;
    }
    case 'spear': {
      const a = Math.max(0, Math.sin(ph * 1.8));
      p.rsx = .9 + a * .9; p.rex = 1.6 * (1 - a); p.lsx = .8 + a * .5; p.lex = .9; p.sx = .2 + a * .2; p.lhx = .4; p.lkx = .4; p.rhx = -.2; break;
    }
    case 'swing': {
      const a = Math.sin(ph * 2.4);
      p.rsx = 1.2 + a * .5; p.rsz = .4 + a * .7; p.rex = .4; p.lsx = 1.1; p.lex = 1.2; p.sz = a * .22; p.sx = .2; p.lhx = .35; p.lkx = .35; p.rhx = -.15; break;
    }
    case 'dig': case 'forage': {
      const a = (Math.sin(ph * 2) + 1) / 2;
      p.y = kind === 'dig' ? -.15 : -.35; p.lhx = p.rhx = kind === 'dig' ? .5 : 1.1; p.lkx = p.rkx = kind === 'dig' ? .7 : 1.6; p.sx = kind === 'dig' ? .5 + a * .3 : .7;
      p.lsx = p.rsx = .6 + a * .7; p.lex = p.rex = .3; break;
    }
    case 'carry':
      p.lsx = p.rsx = .8; p.lex = p.rex = 1.3; p.lsz = p.rsz = .25; break;
    case 'wash':
      p.y = -.4; p.lhx = p.rhx = 1.2; p.lkx = p.rkx = 1.9; p.sx = .7; p.lsx = p.rsx = 1.8 + Math.sin(ph * 3) * .3; p.lex = p.rex = 2.0; p.lsz = p.rsz = .3; break;
    case 'pry': {
      const s = Math.sin(ph * 1.6);
      p.lsx = p.rsx = 1.35; p.lsz = p.rsz = .06; p.lex = p.rex = .55 + .35 * s; p.sx = -.08 + .14 * s; p.lhx = .35; p.lkx = .5; p.rhx = -.15; p.y = -.06; break;
    }
    case 'shout': {
      const s = Math.sin(ph * 1.3);
      p.nx = -.5; p.sx = -.12; p.lsz = p.rsz = .75 + .2 * s; p.lsx = p.rsx = .6; p.lex = p.rex = .45; p.mo = 1; break;
    }
    case 'tally':
      p.rsx = 1.65 + Math.sin(ph * 3) * .15; p.rex = .55; p.lsx = .9; p.lsz = .25; p.lex = .35; p.nx = .1; break;
    case 'write':
      p.rsx = 1.8 + Math.sin(ph * 2) * .25; p.rsz = .2 + Math.sin(ph * 1.3) * .3; p.rex = .4; p.lsx = .3; p.lex = .3; break;
    case 'jump': {
      const s = Math.sin(ph * 1.8), up = Math.max(0, s);
      p.lsx = p.rsx = 2.9; p.lsz = p.rsz = .15; p.lex = p.rex = .1; p.y = up * .38 - Math.max(0, -s) * .14;
      p.lhx = p.rhx = Math.max(0, -s) * .7; p.lkx = p.rkx = Math.max(0, -s) * 1.2; p.nx = -.5; break;
    }
    case 'pushup': {
      const a = (Math.sin(ph * 1.5) + 1) / 2;
      p.tx = 1.12; p.y = -.64 - (1 - a) * .1; p.sx = 0; p.nx = -.35; p.lsx = p.rsx = Math.PI / 2 - .05 - (1 - a) * .25; p.lsz = p.rsz = .22; p.lex = p.rex = (1 - a) * .9; p.lhx = p.rhx = 0; p.lkx = p.rkx = 0; break;
    }
    case 'squat': {
      const a = (Math.sin(ph * 1.4) + 1) / 2;
      p.y = -.38 * a; p.lhx = p.rhx = 1.45 * a; p.lkx = p.rkx = 2.1 * a; p.lsx = p.rsx = 1.45 * a; p.lex = p.rex = .1; p.sx = .25 * a; break;
    }
    case 'stretch': p.lsx = p.rsx = 2.95; p.lsz = p.rsz = .25; p.lex = p.rex = .1; p.nx = -.35; p.sx = -.12; p.y = .02; break;
    case 'scratch': p.rsx = 2.6; p.rex = 2.3 + Math.sin(ph * 6) * .25; p.nx = .25; p.ny = .2; p.lsx = .1; break;
    case 'shiver': p.lsx = p.rsx = .75; p.lex = p.rex = 2.0; p.lsz = p.rsz = -.28; p.sx = .3; p.nx = .3; p.y = -.03; break;
    case 'cower':
      p.y = -.52; p.lhx = p.rhx = 1.7; p.lkx = p.rkx = 2.4; p.sx = .8; p.nx = .55; p.lsx = p.rsx = 2.5; p.lex = p.rex = 2.1; p.lsz = p.rsz = .45; break;
    case 'meditate':
      p.y = -.82; p.lhx = p.rhx = 1.35; p.lhz = p.rhz = .8; p.lkx = p.rkx = 2.5; p.sx = breathe * .5; p.nx = .12 + Math.sin(ph * .2) * .02;
      p.lsx = p.rsx = .35; p.lsz = p.rsz = .28; p.lex = p.rex = 1.05; break;
    case 'gaze_up': p.nx = -.7; p.sx = -.12; p.lsx = p.rsx = .1; p.ny = Math.sin(ph * .15) * .3; break;
    case 'hold_up': p.rsx = 1.0; p.rex = 1.55; p.rsz = .05; p.nx = .38; p.lsx = .15; p.lex = .3; break;
    case 'pet':
      p.y = -.45; p.lhx = .2; p.lkx = 1.6; p.rhx = 1.4; p.rkx = 1.5; p.sx = .7; p.nx = .4; p.rsx = 1.1 + Math.sin(ph * 2) * .15; p.rex = .2; p.lsx = .3; p.lex = .6; break;
    case 'cradle':
      p.lsx = p.rsx = .75; p.lex = p.rex = 1.75; p.lsz = p.rsz = .15; p.nx = .45; p.sz = Math.sin(ph * .8) * .06; p.tz = Math.sin(ph * .8) * .03; break;
    case 'pray':
      p.y = -.47; p.lhx = p.rhx = .05; p.lkx = p.rkx = 1.6; p.sx = .15; p.nx = .45; p.lsx = p.rsx = .95; p.lex = p.rex = 1.75; p.lsz = p.rsz = -.3; break;
    case 'talk': case 'chat': {
      const s = Math.sin(ph * 1.4);
      p.rsx = .5 + .25 * s; p.rex = 1.2 + .35 * Math.sin(ph * 1.9); p.lsx = .25; p.lex = .55; p.nx = -.03 + .05 * s; p.ny = .1 * Math.sin(ph * .7);
      p.mo = Math.max(0, Math.sin(ph * 5)) * .4; break;
    }
    case 'stare':
      p.nx = .2 + slump * .3; p.lsz = p.rsz = .02; p.lex = p.rex = .02; p.sx = .1 + slump * .3; break;
    case 'clutch':
      p.lsx = p.rsx = 2.5; p.lsz = p.rsz = .65; p.lex = p.rex = 2.3; p.sx = .45; p.nx = .55; p.lkx = p.rkx = .4; p.lhx = p.rhx = .3; p.y = -.08; break;
    case 'kneel':
      p.y = -.45; p.lhx = .2; p.lkx = 1.6; p.rhx = 1.4; p.rkx = 1.5; p.sx = .45; p.nx = .5; p.lsx = p.rsx = .3; p.lex = p.rex = .6; break;
    case 'look':
      p.ny = Math.sin(ph * .4) * .7; p.nx = -.1; break;
  }
  if (trem > 0) for (const k of ['sx', 'nx', 'lsx', 'rsx', 'lex', 'rex']) p[k] += (Math.random() - .5) * trem;
  return p;
}
// how high a pose puts the head, for labels
const poseHeight = k => /^(lie|curl|bed|collapsed|pushup)$/.test(k) ? .75 : /^(sit|rock|eat_sit|read|warm|fish|hold_sit|meditate|cower)/.test(k) ? 1.25 : /^(kneel|pray|pet|sit_bed|forage|wash)/.test(k) ? 1.6 : 2.15;
// the poses that put him on the floor; getting up from them goes through sitting and kneeling
const GROUND = new Set(['lie', 'curl', 'bed', 'collapsed', 'sit_hug', 'rock', 'sit_wall', 'read', 'warm', 'fish', 'hold_sit', 'eat_sit', 'meditate', 'cower', 'pushup']);

// ---------- animals ----------
const ANIMAL = {
  deer: { w: .42, h: .5, len: 1.25, leg: .72, head: .15, neck: .55, col: 0x8a6240, speed: 30, flee: 18, meat: 6, hide: 1, hunt: true },
  boar: { w: .45, h: .48, len: 1.05, leg: .34, head: .2, neck: .12, col: 0x3d332b, speed: 24, flee: 9, meat: 5, hide: 1, hunt: true, fights: true },
  wolf: { w: .32, h: .38, len: 1.0, leg: .48, head: .15, neck: .25, col: 0x6d6a64, speed: 36, flee: 0, meat: 3, hide: 1, hunt: true, fights: true, predator: true },
  rabbit: { w: .14, h: .16, len: .32, leg: .1, head: .08, neck: .06, col: 0x9a8a74, speed: 26, flee: 8, meat: 1, hide: 0, hunt: true, small: true },
  chicken: { w: .14, h: .2, len: .26, leg: .16, head: .06, neck: .1, col: 0xe9e4d6, speed: 10, flee: 4, meat: 1, hide: 0, hunt: true, small: true, biped: true },
  bear: { w: .85, h: .8, len: 1.75, leg: .55, head: .28, neck: .22, col: 0x4a3524, speed: 30, flee: 0, meat: 14, hide: 2, hunt: false, fights: true, predator: true, big: true },
  dog: { w: .24, h: .3, len: .78, leg: .38, head: .12, neck: .16, col: 0x5a4a3a, speed: 34, flee: 0, meat: 2, hide: 1, hunt: false, fights: true, predator: true },
  rat: { w: .06, h: .06, len: .17, leg: .03, head: .035, neck: .02, col: 0x6b625a, speed: 6, flee: 1.5, meat: .3, hide: 0, hunt: true, small: true },
};
function makeAnimal(type) {
  const s = ANIMAL[type], m = c => stdMat(c, .95);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const col = new THREE.Color(s.col).offsetHSL(rnd(-.02, .02), 0, rnd(-.06, .06)).getHex();
  const torso = new THREE.Mesh(GEO.sph(.5, 12, 8), m(col)); torso.scale.set(s.w, s.h, s.len); torso.position.y = s.leg + s.h * .4; torso.castShadow = true; body.add(torso);
  const headG = new THREE.Group(); headG.position.set(0, s.leg + s.h * .55 + s.neck * .5, s.len * .45); body.add(headG);
  if (s.neck > .1) { const nk = new THREE.Mesh(GEO.cyl(s.head * .45, s.head * .6, s.neck, 8), m(col)); nk.position.set(0, -s.neck * .3, -s.head * .3); nk.rotation.x = .5; headG.add(nk); }
  const hd = new THREE.Mesh(GEO.sph(s.head, 10, 8), m(col)); hd.scale.set(.8, .85, 1.35); hd.position.z = s.head * .3; hd.castShadow = true; headG.add(hd);
  if (type === 'deer' && R() < .5) for (const x of [-1, 1]) { const an = new THREE.Mesh(GEO.cyl(.012, .018, .38, 5), m(0xd8c9a8)); an.position.set(x * .06, s.head * .9, 0); an.rotation.z = x * .4; headG.add(an); }
  if (type === 'boar') { const sn = new THREE.Mesh(GEO.cyl(.06, .07, .08, 8), m(0x5a4a40)); sn.rotation.x = Math.PI / 2; sn.position.z = s.head * 1.6; headG.add(sn); }
  if (type === 'chicken') { const cb = new THREE.Mesh(GEO.box(.02, .05, .05), m(0xc23a2a)); cb.position.set(0, s.head * 1.1, .01); headG.add(cb); }
  if (type === 'bear') for (const x of [-1, 1]) { const ear = new THREE.Mesh(GEO.sph(.07, 6, 5), m(col)); ear.position.set(x * .16, s.head * .8, -.05); headG.add(ear); }
  if (type === 'rat') { const t = new THREE.Mesh(GEO.cyl(.006, .002, .16, 4), m(0xc9a69a)); t.rotation.x = -1.2; t.position.set(0, s.leg + s.h * .3, -s.len * .7); body.add(t); }
  if (type === 'rabbit') for (const x of [-1, 1]) { const ear = new THREE.Mesh(GEO.box(.025, .11, .015), m(col)); ear.position.set(x * .03, s.head * 1.3, -.01); headG.add(ear); }
  const tail = new THREE.Mesh(GEO.sph(type === 'rabbit' ? .04 : .05, 6, 5), m(type === 'rabbit' ? 0xf0ebe0 : col)); tail.position.set(0, s.leg + s.h * .5, -s.len * .5); body.add(tail);
  const legs = [];
  const spots = s.biped ? [[-.05, 0], [.05, 0]] : [[-s.w * .32, s.len * .32], [s.w * .32, s.len * .32], [-s.w * .32, -s.len * .32], [s.w * .32, -s.len * .32]];
  for (const [x, z] of spots) {
    const g = new THREE.Group(); g.position.set(x, s.leg, z); body.add(g);
    const l = new THREE.Mesh(GEO.cyl(Math.max(.012, s.w * .1), Math.max(.008, s.w * .07), s.leg, 6), m(s.biped ? 0xd8a23a : col)); l.position.y = -s.leg / 2; l.castShadow = true; g.add(l);
    legs.push(g);
  }
  return { root, body, legs, head: headG, s, type, phase: rnd(0, TAU) };
}
function animateAnimal(a, gait, dt, graze) {
  a.phase += gait * dt * 9;
  const off = [0, Math.PI, Math.PI, 0];
  a.legs.forEach((l, i) => { l.rotation.x = Math.sin(a.phase + off[i]) * .55 * Math.min(1, gait); });
  a.head.rotation.x = lerp(a.head.rotation.x, graze ? .9 : 0, Math.min(1, dt * 3));
  a.body.position.y = a.s.small && gait > .1 ? Math.abs(Math.sin(a.phase)) * .08 : 0;
}
