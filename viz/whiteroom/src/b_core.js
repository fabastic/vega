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
