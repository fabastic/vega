
// =====================================================================
// THE WORLD: terrain, villages, roads, a lake, forests and the facility
// =====================================================================
const H_PER_SEC = .1;                 // at 1x one real second is six sim minutes
const WALK = 36;                      // metres a person covers in a sim hour, at an easy pace
const scene = new THREE.Scene();
const sky = makeSky(); scene.add(sky);
scene.fog = new THREE.Fog(0xdfe3dc, 90, 430);
const hemi = new THREE.HemisphereLight(0xf4f1e6, 0x5b5444, .55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d8, 1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005;
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 360 });
scene.add(sun, sun.target);
const moon = new THREE.DirectionalLight(0x8fa6d6, 0); scene.add(moon, moon.target);

const VILLAGE_DEFS = [
  { name: 'Ashford', x: -62, z: 46 }, { name: 'Millbrook', x: 92, z: 58 },
  { name: 'Stonereach', x: 18, z: -104 }, { name: 'Fernhollow', x: -118, z: -66 },
];
const VILL = [];
const FAC = { x: 8, z: 4, h: 0, door: new THREE.Vector3(), lit: false };
const LAKE = { x: 74, z: -36, r: 26, level: 0 };
let ROADS = [];
const TREES = [], ROCKS = [], BUSHES = [], BUILDS = [], HOUSES = [];
const WORLD = { food: 1, blight: false, rot: 0, lastRot: -1, winter: 0, lastWinter: -1, season: 'spring' };
const OUT = [];

function baseH(x, z) {
  let h = (fbm(x * .0065 + 11, z * .0065 - 7) - .5) * 20 + (fbm(x * .03, z * .03) - .5) * 3;
  h += smooth(170, 228, Math.hypot(x, z)) * 30;
  return h;
}
function heightAt(x, z) {
  let h = baseH(x, z);
  for (const v of VILL) { const d = Math.hypot(x - v.x, z - v.z); if (d < 46) h = lerp(h, v.h, smooth(46, 28, d)); }
  const fd = Math.hypot(x - FAC.x, z - FAC.z); if (fd < 28) h = lerp(h, FAC.h, smooth(28, 16, fd));
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r + 16) h = lerp(h, Math.min(h, LAKE.level - 3.2), smooth(LAKE.r + 16, LAKE.r * .55, ld));
  return h;
}
const WORLD_R = 195;   // the walkable country; beyond it the hills get too steep
const onGround = v => { const r = Math.hypot(v.x, v.z); if (r > WORLD_R) { v.x *= WORLD_R / r; v.z *= WORLD_R / r; } v.y = heightAt(v.x, v.z); return v; };
const P = (x, z) => onGround(new THREE.Vector3(x, 0, z));
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
const roadDist = (x, z) => { let d = 1e9; for (const r of ROADS) d = Math.min(d, segDist(x, z, r[0], r[1], r[2], r[3])); return d; };
const villDist = (x, z) => { let d = 1e9, vi = -1; for (const v of VILL) { const e = Math.hypot(x - v.x, z - v.z); if (e < d) { d = e; vi = v.i; } } return [d, vi]; };

// ---------- terrain ----------
const TER_SIZE = 470, TER_SEG = 150;
let terrainGeo, terColors, terInfo, water;
const TERRAIN = { mesh: null };
const TC = { grassA: new THREE.Color(0x667f3d), grassB: new THREE.Color(0x8c9550), lush: new THREE.Color(0x4f6a2e), dry: new THREE.Color(0x9a8f5a),
  rock: new THREE.Color(0x7b776e), yard: new THREE.Color(0x8d8558), plaza: new THREE.Color(0xb7a98a), dirt: new THREE.Color(0x9a8566),
  sand: new THREE.Color(0xbfb08a), mud: new THREE.Color(0x4f5444), snow: new THREE.Color(0xe9ecef), concrete: new THREE.Color(0x9a9a93), t: new THREE.Color() };
function buildTerrain() {
  terrainGeo = new THREE.PlaneGeometry(TER_SIZE, TER_SIZE, TER_SEG, TER_SEG);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position, n = pos.count;
  terColors = new Float32Array(n * 3); terInfo = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
    pos.setY(i, h);
    terInfo[i] = { h, road: roadDist(x, z), vil: villDist(x, z)[0], fac: Math.hypot(x - FAC.x, z - FAC.z), lake: Math.hypot(x - LAKE.x, z - LAKE.z), n1: fbm(x * .05 + 3, z * .05), n2: vnoise(x * .3, z * .3) };
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(terColors, 3));
  terrainGeo.computeVertexNormals();
  const ter = TERRAIN.mesh = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ter.receiveShadow = true; scene.add(ter);
  water = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 9, 56), new THREE.MeshStandardMaterial({ color: 0x3f5d68, roughness: .12, metalness: .15, transparent: true, opacity: .86 }));
  water.rotation.x = -Math.PI / 2; water.position.set(LAKE.x, LAKE.level, LAKE.z); scene.add(water);
}
function recolorTerrain(rot, winter) {
  const c = TC.t;
  for (let i = 0; i < terInfo.length; i++) {
    const b = terInfo[i];
    c.copy(TC.grassA).lerp(TC.grassB, b.n1).lerp(TC.dry, b.n2 * .18);
    if (rot > 0) c.lerp(TC.lush, rot * .55 * (1 - b.n2 * .5));
    if (b.h > 13 + b.n1 * 8) c.lerp(TC.rock, smooth(13, 19, b.h - b.n1 * 8));
    if (b.vil < 32) c.lerp(TC.yard, smooth(32, 14, b.vil) * (1 - rot * .75) * .8);
    if (b.vil < 8) c.lerp(TC.plaza, smooth(8, 4, b.vil) * (1 - rot * .55));
    if (b.fac < 18) c.lerp(TC.concrete, smooth(18, 12, b.fac) * (1 - rot * .4));
    if (b.road < 2.8) c.lerp(TC.dirt, (1 - b.road / 2.8) * (1 - rot * .7));
    if (b.lake < LAKE.r + 14 && b.h < LAKE.level + .9) c.lerp(TC.sand, .85);
    if (b.h < LAKE.level - .3) c.copy(TC.mud);
    if (winter > 0 && b.h > LAKE.level - .3) c.lerp(TC.snow, winter * .88);
    terColors[i * 3] = c.r; terColors[i * 3 + 1] = c.g; terColors[i * 3 + 2] = c.b;
  }
  terrainGeo.attributes.color.needsUpdate = true;
  water.material.color.set(0x3f5d68).lerp(new THREE.Color(0xc9d6dc), winter * .8);
}

// ---------- forests, rocks, berry bushes, wild grass ----------
let pineTrunks, pineTops, leafTrunks, leafTops, rockMesh, grassMesh;
const leafMat = stdMat(0x5e7a3c, .9), pineMat = stdMat(0x3f5a34, .9);
const GRASS = [];
const dummy = new THREE.Object3D();
function buildNature() {
  const pines = [], leaves = [];
  for (let k = 0; k < 5200; k++) {
    const x = rnd(-215, 215), z = rnd(-215, 215), f = fbm(x * .012 + 40, z * .012 - 13);
    if (f < .53 && R() > .025) continue;
    if (villDist(x, z)[0] < 36 || Math.hypot(x - FAC.x, z - FAC.z) < 24 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 8 || roadDist(x, z) < 5 || Math.hypot(x, z) > 212) continue;
    const t = { x, z, y: heightAt(x, z), s: rnd(.75, 1.45), wood: 4, type: f > .6 || R() < .45 ? 'pine' : 'leaf' };
    (t.type === 'pine' ? pines : leaves).push(t); TREES.push(t);
    if (TREES.length > 900) break;
  }
  const inst = (geo, mat, list, fn) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); m.castShadow = true; m.receiveShadow = true; list.forEach((t, i) => { fn(t); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); scene.add(m); return m; };
  const trunkMat = stdMat(0x5a4632, .95);
  pineTrunks = inst(GEO.cyl(.18, .26, 2.4, 6), trunkMat, pines, t => { dummy.position.set(t.x, t.y + 1.2 * t.s, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(t.s); });
  pineTops = inst(new THREE.ConeGeometry(1.7, 5.2, 7), pineMat, pines, t => { dummy.position.set(t.x, t.y + 4.4 * t.s, t.z); dummy.rotation.set(0, t.x, 0); dummy.scale.setScalar(t.s); });
  leafTrunks = inst(GEO.cyl(.2, .3, 3, 6), trunkMat, leaves, t => { dummy.position.set(t.x, t.y + 1.5 * t.s, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(t.s); });
  leafTops = inst(new THREE.IcosahedronGeometry(2.1, 1), leafMat, leaves, t => { dummy.position.set(t.x, t.y + 4.1 * t.s, t.z); dummy.rotation.set(t.z, t.x, 0); dummy.scale.set(t.s, t.s * .85, t.s); });
  for (let k = 0; k < 900 && ROCKS.length < 150; k++) {
    const x = rnd(-205, 205), z = rnd(-205, 205);
    if (villDist(x, z)[0] < 30 || roadDist(x, z) < 4 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4) continue;
    const y = heightAt(x, z); if (y < 3 && R() < .7) continue;
    ROCKS.push({ x, z, y, s: rnd(.5, 1.6), stone: 6 });
  }
  rockMesh = inst(new THREE.DodecahedronGeometry(.9, 0), stdMat(0x84807a, .95), ROCKS, r => { dummy.position.set(r.x, r.y + .2 * r.s, r.z); dummy.rotation.set(r.x, r.z, 0); dummy.scale.set(r.s, r.s * .7, r.s); });
  const bushMat = stdMat(0x4e6b33, .95), berryMat = stdMat(0xa3263a, .5);
  for (let k = 0; k < 2000 && BUSHES.length < 110; k++) {
    const x = rnd(-205, 205), z = rnd(-205, 205), f = fbm(x * .012 + 40, z * .012 - 13);
    if (f < .45 || f > .56 || villDist(x, z)[0] < 30 || roadDist(x, z) < 4 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 6) continue;
    const g = new THREE.Group(), y = heightAt(x, z);
    const b = new THREE.Mesh(GEO.sph(.7, 9, 7), bushMat); b.scale.set(1, .7, 1); b.position.y = .4; b.castShadow = true; g.add(b);
    const berries = new THREE.Group(); for (let j = 0; j < 7; j++) { const be = new THREE.Mesh(GEO.sph(.06, 6, 5), berryMat); be.position.set(rnd(-.55, .55), rnd(.4, .8), rnd(-.55, .55)); berries.add(be); } mergeStatic(berries); g.add(berries);
    g.position.set(x, y, z); scene.add(g);
    BUSHES.push({ x, z, y, g, berries, stock: 4 });
  }
  // wild grass that takes over the villages once nobody tends them
  for (let k = 0; k < 2400; k++) {
    const near = R() < .65, v = VILL[Math.floor(R() * VILL.length)], a = rnd(0, TAU), r = near ? Math.sqrt(R()) * 34 : rnd(0, 200);
    const x = near ? v.x + Math.cos(a) * r : Math.cos(a) * r, z = near ? v.z + Math.sin(a) * r : Math.sin(a) * r;
    GRASS.push({ x, z, y: heightAt(x, z), s: rnd(.4, 1.2), rot: rnd(0, TAU), village: near });
  }
  grassMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(.16, .7, 4), stdMat(0x5d7038, .95), GRASS.length); grassMesh.castShadow = false;
  scene.add(grassMesh); growGrass(0);
}
function growGrass(rot) {
  GRASS.forEach((w, i) => { const s = w.village ? .05 + rot * 1.1 : .55; dummy.position.set(w.x, w.y + .3 * w.s * s, w.z); dummy.rotation.set(0, w.rot, 0); dummy.scale.setScalar(Math.max(.001, w.s * s)); dummy.updateMatrix(); grassMesh.setMatrixAt(i, dummy.matrix); });
  grassMesh.instanceMatrix.needsUpdate = true;
}
function seasonalFoliage(season, winter) {
  const leaf = { spring: 0x6c8a40, summer: 0x5e7a3c, autumn: 0xa86d2c, winter: 0x6f6a5c }[season];
  leafMat.color.set(leaf).lerp(new THREE.Color(0xdfe2e4), winter * .5);
  pineMat.color.set(0x3f5a34).lerp(new THREE.Color(0xd5dadc), winter * .45);
  for (const b of BUSHES) b.berries.visible = (season === 'summer' || season === 'autumn') && b.stock > 0;
}

// ---------- buildings ----------
// Single-storey clapboard houses in the Project Zomboid manner: a raised slab, plank siding, a pitched
// shingle roof with gables, trimmed windows, a porch, and a furnished inside that shows through when the
// walls nearest the camera are cut away.
const WIN_MAT = new THREE.MeshStandardMaterial({ color: 0x3a4a56, roughness: .15, metalness: .3, emissive: 0xffb860, emissiveIntensity: 0 });
const DOOR_MAT = stdMat(0x5a3f2c, .75);
const TRIM_MAT = stdMat(0xe9e6dc, .7), FOUND_MAT = stdMat(0x8a8780, .95), DARK_MAT = stdMat(0x1e1c1a, .9);
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
let SIDING, SHINGLE, PLANKS;
function houseTextures() {
  if (SIDING) return;
  SIDING = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(.25, '#ffffff'); gr.addColorStop(1, '#f0f0f0'); g.fillStyle = gr; g.fillRect(0, y, w, 16); g.fillStyle = '#9a9a9a'; g.fillRect(0, y + 15, w, 1); } });
  SHINGLE = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) { const y = r * 8, off = r % 2 ? 8 : 0; g.fillStyle = '#8c8c8c'; g.fillRect(0, y + 7, w, 1); for (let x = -16; x < w; x += 16) { g.fillStyle = `rgb(${215 + (x * 7 + r * 13) % 35},${215 + (x * 7 + r * 13) % 35},${215 + (x * 7 + r * 13) % 35})`; g.fillRect(x + off + 1, y, 14, 7); } } });
  PLANKS = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#a57c55'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? '#9a7350' : '#ad8560'; g.fillRect(x, 0, 7, h); g.fillStyle = '#6f5237'; g.fillRect(x + 7, 0, 1, h); g.fillRect(x, (x * 13) % h, 7, 1); } });
}
// a box whose texture repeats by its real size, so boards stay the same width on every wall
function tiledBox(x, y, z, scale = 1.2) {
  const geo = GEO.box(x, y, z), uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const [su, sv] = ax > .5 ? [z, y] : ay > .5 ? [x, z] : [x, y];
    uv.setXY(i, uv.getX(i) * su / scale, uv.getY(i) * sv / scale);
  }
  return geo;
}
function house(x, z, rotY, wallC, roofC, w = 4.6, d = 4, h = 2.6, opts = {}) {
  houseTextures();
  const g = new THREE.Group(), y = heightAt(x, z), F = .35;   // floor height above the slab
  const wallMat = new THREE.MeshStandardMaterial({ color: wallC, roughness: .9, map: SIDING });
  const roofMat = new THREE.MeshStandardMaterial({ color: roofC, roughness: .9, map: SHINGLE, side: THREE.DoubleSide });
  const mats = {}, matOf = c => mats[c] || (mats[c] = stdMat(c, .8));   // shared per house, so its pieces can be merged
  const mk = (geo, m, px, py, pz, parent = g, shadow = true) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = shadow; me.receiveShadow = true; parent.add(me); return me; };
  mk(GEO.box(w + .4, F + .3, d + .4), FOUND_MAT, 0, (F - .3) / 2, 0);
  mk(tiledBox(w - .1, .04, d - .1, 1.6), new THREE.MeshStandardMaterial({ map: PLANKS, roughness: .85 }), 0, F + .02, 0, g, false);
  // walls: each is its own group so the side facing the camera can be cut down to a stub
  const walls = new THREE.Group(); g.add(walls);
  const T = .14, panels = [];
  const panel = (len, nx, nz) => {
    const p = new THREE.Group(); walls.add(p);
    p.position.set(nx * (w / 2 - T / 2), F, nz * (d / 2 - T / 2)); p.rotation.y = Math.atan2(nx, nz);
    const m = mk(tiledBox(len, h, T), wallMat, 0, h / 2, 0, p); const fx = new THREE.Group(); p.add(fx);
    const rec = { p, m, fx, nx, nz, len }; panels.push(rec); return rec;
  };
  const front = panel(w, 0, 1), back = panel(w, 0, -1), left = panel(d - 2 * T, -1, 0), right = panel(d - 2 * T, 1, 0);
  const glass = [];
  const windowOn = (pn, u) => {
    const fr = mk(GEO.box(.86, .92, .05), TRIM_MAT, u, 1.45, T / 2 + .02, pn.fx, false);
    const gl = mk(GEO.box(.72, .78, .03), WIN_MAT, u, 1.45, T / 2 + .03, pn.fx, false); gl.userData.live = true;
    const hole = mk(GEO.box(.72, .78, .03), DARK_MAT, u, 1.45, T / 2 + .028, pn.fx, false); hole.visible = false; hole.userData.live = true;
    mk(GEO.box(.04, .78, .04), TRIM_MAT, u, 1.45, T / 2 + .045, pn.fx, false); mk(GEO.box(.72, .04, .04), TRIM_MAT, u, 1.45, T / 2 + .045, pn.fx, false);
    mk(GEO.box(.95, .06, .12), TRIM_MAT, u, .97, T / 2 + .06, pn.fx, false);   // sill
    if (opts.shutters) for (const s of [-1, 1]) mk(GEO.box(.3, .9, .03), matOf(opts.shutters), u + s * .6, 1.45, T / 2 + .03, pn.fx, false);
    const boards = new THREE.Group(); boards.visible = false; pn.fx.add(boards);
    for (let k = 0; k < 3; k++) { const bd = mk(GEO.box(1, .14, .04), stdMat(0x8a6a48, .9), u, 1.2 + k * .25, T / 2 + .08, boards, false); bd.rotation.z = (k - 1) * .12 + rnd(-.05, .05); }
    glass.push({ gl, hole, boards, broken: false, brk: R() });
  };
  // front: door and one or two windows; sides and back: a window each
  const doorX = opts.doorX ?? -w * .18;
  mk(GEO.box(1.05, 2.15, .06), TRIM_MAT, doorX, 1.075, T / 2 + .02, front.fx, false);
  const door = new THREE.Group(); door.position.set(doorX - .45, 0, T / 2 + .05); front.p.add(door);
  mk(GEO.box(.9, 2.02, .05), DOOR_MAT, .45, 1.01, 0, door, false);
  mk(GEO.sph(.03, 6, 5), stdMat(0xb59a5a, .4), .8, 1.0, .04, door, false);
  windowOn(front, w * .25); if (w > 5.5) windowOn(front, -w * .38);
  windowOn(back, 0); windowOn(left, 0); windowOn(right, 0);
  // pitched roof along the long side, with gable ends
  const pitch = .55, run = d / 2 + .35, rise = Math.tan(pitch) * (d / 2), slab = run / Math.cos(pitch);
  const roof = new THREE.Group(); roof.position.y = F + h; g.add(roof);
  for (const s of [-1, 1]) { const r = mk(tiledBox(w + .6, .08, slab, 1.1), roofMat, 0, (rise - Math.tan(pitch) * .35) / 2, s * run / 2, roof); r.rotation.x = s * pitch; }
  mk(GEO.box(w + .65, .1, .14), stdMat(0x4a4038, .9), 0, rise + .02, 0, roof);
  const gable = new THREE.Shape(); gable.moveTo(-d / 2, 0); gable.lineTo(d / 2, 0); gable.lineTo(0, rise); gable.lineTo(-d / 2, 0);
  const gMat = new THREE.MeshStandardMaterial({ color: wallC, roughness: .9, side: THREE.DoubleSide });
  for (const s of [-1, 1]) { const gm = mk(new THREE.ShapeGeometry(gable), gMat, s * (w / 2 - .02), 0, 0, roof); gm.rotation.y = Math.PI / 2; }
  const chim = mk(GEO.box(.45, 1.3, .45), stdMat(0x7a5d4e, .9), w * .28, rise * .55 + .3, -d * .18, roof);
  // porch with a little roof of its own
  if (opts.porch !== false) {
    const pw = Math.min(w * .62, 3), pd = 1.3;
    mk(tiledBox(pw, .12, pd, 1.6), new THREE.MeshStandardMaterial({ map: PLANKS, roughness: .9, color: 0xd8d0c4 }), doorX + .3, F - .02, d / 2 + pd / 2);
    mk(GEO.box(1, .14, .35), FOUND_MAT, doorX, .1, d / 2 + pd + .15);
    for (const s of [-1, 1]) mk(GEO.box(.1, 2.1, .1), TRIM_MAT, doorX + .3 + s * (pw / 2 - .1), F + 1.05, d / 2 + pd - .1);
    const pr = mk(tiledBox(pw + .3, .07, pd + .3, 1.1), roofMat, doorX + .3, F + 2.15, d / 2 + pd / 2); pr.rotation.x = .18;
  }
  // inside: only drawn while the walls are cut away
  const inside = new THREE.Group(); inside.visible = false; g.add(inside);
  const fm = (geo, c, px, py, pz, r) => { const me = mk(geo, matOf(c), px, F + py, pz, inside, false); if (r) me.rotation.y = r; return me; };
  const W = w / 2 - T - .1, D = d / 2 - T - .1;
  fm(GEO.box(1.6, .02, 1.1), opts.rug || pick([0x7a3b30, 0x2f4f5f, 0x6b5a2e]), .2, .02, .1);
  if (opts.kind === 'store') { /* shelves are added by the store */ }
  else if (opts.kind !== 'library' && opts.kind !== 'workshop' && opts.kind !== 'market') {
    fm(GEO.box(.95, .3, 1.9), 0x6b4f35, W - .5, .15, -D + 1); fm(GEO.box(.9, .12, 1.85), 0xe8e4da, W - .5, .36, -D + 1); fm(GEO.box(.88, .06, 1.2), pick([0x3d5a7a, 0x7a3d3d, 0x5d6f3a]), W - .5, .45, -D + 1.3); fm(GEO.box(.6, .1, .3), 0xf4f1ea, W - .5, .46, -D + .3);
    fm(GEO.box(1, .06, .7), 0x7a5a3a, -W + .9, .75, D - .7); for (const s of [-1, 1]) fm(GEO.box(.4, .45, .4), 0x6b4f35, -W + .9 + s * .7, .22, D - .7);
    fm(GEO.box(1.4, .9, .55), 0xcfcac0, -W + .75, .45, -D + .3); fm(GEO.box(.55, .02, .45), 0x2a2a2a, -W + .5, .91, -D + .3);   // counter and stove top
    fm(GEO.box(.6, 1.6, .6), 0xe9e9e4, -W + 1.75, .8, -D + .32);   // the fridge
  } else {
    for (let k = 0; k < 3; k++) { fm(GEO.box(1.6, 1.8, .35), 0x6b4f35, -W + 1 + k * 1.9, .9, -D + .2); for (let r = 0; r < 4; r++) fm(GEO.box(1.4, .28, .25), pick([0x8a3b2c, 0x2b5a7a, 0x5d6f3a, 0xa8692a, 0x3d3d55]), -W + 1 + k * 1.9, .25 + r * .42, -D + .27); }
    fm(GEO.box(2, .08, .9), 0x7a5a3a, 0, .85, D - 1);
  }
  const bedPos = new THREE.Vector3(W - .5, 0, -D + 1);
  for (const grp of [g, roof, inside, ...panels.map(pn => pn.fx)]) mergeStatic(grp);
  g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
  const rec = { g, walls, wallMat, roof, roofMat, gMat, door, panels, glass, inside, roofY: roof.position.y, h, w, d, F, wallBase: new THREE.Color(wallC), roofBase: new THREE.Color(roofC),
    tx: rnd(-.3, .3), tz: rnd(-.25, .25), collapse: R() < .3, doorSwing: rnd(.6, 1.6), cut: false, chim,
    bedWorld: () => g.localToWorld(bedPos.clone()), center: new THREE.Vector3(x, y, z) };
  BUILDS.push(rec);
  return rec;
}
// cut away the walls between the camera and whoever we are looking at, and lift the roof off
const _cv = new THREE.Vector3();
function cutaways(focus, on) {
  const cx0 = camera.position.x, cz0 = camera.position.z, sx = focus.x - cx0, sz = focus.z - cz0, sl = sx * sx + sz * sz || 1;
  for (const b of BUILDS) {
    const r = Math.max(b.w, b.d) * .5 + 1.6;
    let near = on && Math.hypot(focus.x - b.center.x, focus.z - b.center.z) < r && !b.burnt;
    if (on && !near && !b.burnt) {   // standing between the camera and him?
      const t = clamp(((b.center.x - cx0) * sx + (b.center.z - cz0) * sz) / sl);
      near = t > .05 && t < .98 && Math.hypot(cx0 + sx * t - b.center.x, cz0 + sz * t - b.center.z) < r * .8 && Math.hypot(sx, sz) < 90;
    }
    if (!near && !b.cut) continue;
    b.cut = near; b.roof.visible = !near; b.inside.visible = near;
    _cv.copy(camera.position).sub(b.center); const cx = _cv.x, cz = _cv.z, ry = b.g.rotation.y;
    for (const pn of b.panels) {
      const wx = pn.nx * Math.cos(ry) + pn.nz * Math.sin(ry), wz = -pn.nx * Math.sin(ry) + pn.nz * Math.cos(ry);
      const facing = near && (wx * cx + wz * cz) > 0;
      pn.m.scale.y = facing ? .18 : 1; pn.m.position.y = b.h * (facing ? .09 : .5); pn.fx.visible = !facing;
    }
  }
}
// rusting cars along the roads
function car(x, z, rotY, col) {
  const g = new THREE.Group(), y = heightAt(x, z), body = stdMat(col, .55), glassM = stdMat(0x2b3640, .2), tire = stdMat(0x1c1c1c, .9);
  const mk = (geo, m, px, py, pz) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
  mk(GEO.box(1.75, .55, 4.2), body, 0, .62, 0); mk(GEO.box(1.6, .5, 2.1), body, 0, 1.12, -.25);
  mk(GEO.box(1.55, .4, .05), glassM, 0, 1.13, .82).rotation.x = -.35; mk(GEO.box(1.5, .38, .05), glassM, 0, 1.13, -1.31);
  for (const s of [-1, 1]) mk(GEO.box(.05, .36, 1.8), glassM, s * .8, 1.14, -.25);
  const wheels = [];
  for (const [wx, wz] of [[-.82, 1.3], [.82, 1.3], [-.82, -1.35], [.82, -1.35]]) { const wh = mk(GEO.cyl(.34, .34, .24, 12), tire, wx, .34, wz); wh.rotation.z = Math.PI / 2; wh.userData.live = true; wheels.push(wh); }
  for (const s of [-1, 1]) mk(GEO.box(.3, .15, .05), stdMat(0xf0ead0, .3), s * .6, .7, 2.11);
  g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g); mergeStatic(g);
  CARS.push({ g, body, base: new THREE.Color(col), wheels });
}
const CARS = [];
function fenceRun(x0, z0, x1, z1, col = 0xe6e1d6) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / .35)), m = stdMat(col, .8), a = Math.atan2(x1 - x0, z1 - z0);
  const g = new THREE.Group(); g.position.set(x0, heightAt(x0, z0), z0); g.rotation.y = a; scene.add(g);
  for (let i = 0; i <= n; i++) { const pk = new THREE.Mesh(GEO.box(.08, .8, .03), m); pk.position.set(0, .4, i / n * len); pk.castShadow = true; g.add(pk); }
  for (const h of [.25, .6]) { const r = new THREE.Mesh(GEO.box(.04, .06, len), m); r.position.set(0, h, len / 2); g.add(r); }
  mergeStatic(g);
  FENCES.push({ g, m, base: new THREE.Color(col), lean: rnd(-.25, .25) });
}
const FENCES = [];
function mailbox(p, rotY) {
  const g = new THREE.Group(); g.position.copy(p); g.rotation.y = rotY;
  const post = new THREE.Mesh(GEO.box(.08, 1, .08), stdMat(0x6b4f35)); post.position.y = .5; g.add(post);
  const box = new THREE.Mesh(GEO.box(.22, .2, .42), stdMat(pick([0x3b5a7a, 0x7a2d2a, 0x5a5a5a]), .5)); box.position.y = 1.08; box.castShadow = true; g.add(box);
  scene.add(g);
}
let fieldTex = null;
function cropTexture() {
  if (fieldTex) return fieldTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#7a6a45'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#8ea14f' : '#6f8a3c'; g.fillRect(0, i * 8, 128, 5); }
  fieldTex = new THREE.CanvasTexture(c); fieldTex.encoding = THREE.sRGBEncoding; fieldTex.wrapS = fieldTex.wrapT = THREE.RepeatWrapping; fieldTex.repeat.set(1, 2);
  return fieldTex;
}
function buildVillage(def, i, pop) {
  const v = { i, name: def.name, x: def.x, z: def.z, h: 0, houses: [], visited: false, stalls: [], fields: null };
  v.h = baseH(def.x, def.z);
  VILL.push(v);
  return v;
}
function furnishVillage(v, pop) {
  const at = (dx, dz) => P(v.x + dx, v.z + dz);
  const away = Math.atan2(v.z - FAC.z, v.x - FAC.x);
  v.places = {
    plaza: { pos: at(0, 0), r: 4.5 }, well: { pos: at(2.5, -1.5), r: 1.4 }, market: { pos: at(-13, -6), r: 2.6 },
    workshop: { pos: at(13, -6), r: 2.6 }, library: { pos: at(10, 12), r: 2.2 }, fields: { pos: at(-13, 13), r: 4.5 },
    cemetery: { pos: at(Math.cos(away + .5) * 35, Math.sin(away + .5) * 35), r: 4 },
  };
  v.graves = 0;
  const well = new THREE.Group(); well.position.copy(v.places.well.pos);
  const ring = new THREE.Mesh(GEO.cyl(.9, 1, .8, 16), stdMat(0x8f8a80)); ring.position.y = .4; ring.castShadow = true; well.add(ring);
  for (const s of [-1, 1]) { const post = new THREE.Mesh(GEO.box(.1, 1.6, .1), stdMat(0x5a4632)); post.position.set(s * .8, 1.2, 0); well.add(post); }
  const wr = new THREE.Mesh(new THREE.ConeGeometry(1.3, .6, 4), stdMat(0x7a4b30)); wr.position.y = 2.2; wr.rotation.y = Math.PI / 4; wr.castShadow = true; well.add(wr);
  const bk = makeTool('bucket'); bk.position.set(0, 1.5, 0); well.add(bk);
  scene.add(well);
  const hall = house(v.x - 13, v.z - 11.5, 0, 0xd8c7a0, 0x5a4a3e, 7, 4.2, 2.9, { kind: 'market', porch: false, doorX: 0 }); hall.kind = 'market';
  for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(GEO.box(1.6, .9, .9), stdMat([0xb5552e, 0xd19a3c, 0x5f7f4a, 0x9a6b4f][k])); s.position.copy(at(-16 + k * 2.2, -6.8)); s.position.y += .45; s.castShadow = true; scene.add(s); v.stalls.push(s); }
  const ws = house(v.x + 13, v.z - 12, 0, 0xb9b3a6, 0x55514a, 7, 4.5, 3.2, { kind: 'workshop', porch: false, doorX: 0 }); ws.kind = 'workshop';
  const lib = house(v.x + 10, v.z + 16.5, Math.PI, 0xe1dccf, 0x3d4a5a, 6.4, 4.4, 3.4, { kind: 'library', doorX: 0, shutters: 0x2b4a5a }); lib.kind = 'library';
  v.houses.push({ door: at(10, 13.6), pos: at(10, 16.5), v: v.i, stock: { food: Math.floor(rnd(0, 3)), seeds: 0, books: Math.floor(rnd(7, 13)), medicine: Math.floor(rnd(0, 2)), tools: 0 }, searched: false, library: true, rec: lib });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(13, 9, 8, 6), new THREE.MeshStandardMaterial({ map: cropTexture(), roughness: 1, color: 0xffffff }));
  field.rotation.x = -Math.PI / 2; const fp = at(-13, 13); field.position.set(fp.x, fp.y + .05, fp.z); field.receiveShadow = true; scene.add(field); v.fields = field;
  const nHouses = Math.max(4, Math.ceil(pop / 2.4) + 1);
  const SIDINGS = [0xe8e4d8, 0xb9cdd6, 0xe6d9a8, 0xbcd0b4, 0xd8c8b0, 0xc8c8c4, 0xd9b8a8], ROOFS = [0x4a4a4e, 0x5d4a3e, 0x3e4a3a, 0x6a3a30, 0x55514a];
  for (let k = 0; k < nHouses; k++) {
    const a = (k / nHouses) * TAU + .35 + v.i, r = 23, x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
    if (Math.hypot(x - (v.x - 13), z - (v.z + 13)) < 9) continue;
    const w = rnd(4.4, 6), d = rnd(3.8, 4.6), rotY = Math.atan2(v.x - x, v.z - z);
    const rec = house(x, z, rotY, pick(SIDINGS), pick(ROOFS), w, d, 2.6, { shutters: R() < .4 ? pick([0x2b4a5a, 0x5a2b2b, 0x2e4a2e, 0x333333]) : null });
    rec.g.updateMatrixWorld(true);
    const L = (lx, lz) => rec.g.localToWorld(new THREE.Vector3(lx, 0, lz));
    const dx = -w * .18, door = onGround(L(dx, d / 2 + 1.9));
    if (R() < .45) { const zf = d / 2 + 3, p1 = L(-w / 2 - .8, zf), p2 = L(dx - .7, zf), p3 = L(dx + .7, zf), p4 = L(w / 2 + .8, zf); fenceRun(p1.x, p1.z, p2.x, p2.z); fenceRun(p3.x, p3.z, p4.x, p4.z); }
    mailbox(onGround(L(dx + 1.2, d / 2 + 3.2)), rotY);
    v.houses.push({ door, pos: P(x, z), v: v.i, stock: { food: Math.floor(rnd(1, 6)), seeds: Math.floor(rnd(0, 3)), books: Math.floor(rnd(0, 2)), medicine: R() < .3 ? 1 : 0, tools: R() < .25 ? 1 : 0 }, searched: false, rec, owners: [] });
  }
  HOUSES.push(...v.houses);
  // a car or two left by the road out of town
  for (let k = 0; k < 1 + (R() < .5 ? 1 : 0); k++) {
    const t = rnd(.25, .45), rx = lerp(v.x, FAC.x, t), rz = lerp(v.z, FAC.z, t), ang = Math.atan2(FAC.x - v.x, FAC.z - v.z);
    car(rx + Math.cos(ang) * 3.2 * (k ? -1 : 1), rz - Math.sin(ang) * 3.2 * (k ? -1 : 1), ang + rnd(-.3, .3), pick([0x8a2a22, 0x2a4a6a, 0xd8d4c8, 0x3a5a3a, 0x8a7a4a, 0x2a2a2e]));
  }
  // the cemetery: low fence, a gate, a big tree
  const cp = v.places.cemetery.pos, cw = 11, cd = 8;
  fenceRun(cp.x - cw / 2, cp.z - cd / 2, cp.x + cw / 2, cp.z - cd / 2, 0x8a8478); fenceRun(cp.x - cw / 2, cp.z + cd / 2, cp.x + cw / 2, cp.z + cd / 2, 0x8a8478);
  fenceRun(cp.x - cw / 2, cp.z - cd / 2, cp.x - cw / 2, cp.z + cd / 2, 0x8a8478); fenceRun(cp.x + cw / 2, cp.z - cd / 2, cp.x + cw / 2, cp.z - 1, 0x8a8478); fenceRun(cp.x + cw / 2, cp.z + 1, cp.x + cw / 2, cp.z + cd / 2, 0x8a8478);
  for (let k = 0; k < 3; k++) { const old = new THREE.Mesh(GEO.box(.4, .6, .1), stdMat(0x77746c, .95)); old.position.copy(P(cp.x - 4 + k * 1.8, cp.z - 3)); old.position.y += .3; old.rotation.z = rnd(-.15, .15); old.castShadow = true; scene.add(old); }
}
// where the next grave in a village's cemetery goes
function graveSlot(vi) { const v = VILL[vi], cp = v.places.cemetery.pos, n = v.graves++; return P(cp.x - 4 + (n % 5) * 1.9, cp.z - 1.2 + Math.floor(n / 5) * 2.3 - (n >= 15 ? 6.5 : 0)); }
let facility, facWin;
function buildFacility() {
  FAC.h = baseH(FAC.x, FAC.z);
  const y = heightAt(FAC.x, FAC.z), g = new THREE.Group();
  const block = new THREE.Mesh(GEO.box(16, 5.5, 11), stdMat(0x8d918f, .9)); block.position.y = 2.75; block.castShadow = block.receiveShadow = true; g.add(block);
  const roofSlab = new THREE.Mesh(GEO.box(16.6, .4, 11.6), stdMat(0x6f7372)); roofSlab.position.y = 5.7; g.add(roofSlab);
  facWin = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: .3, emissive: 0xd8f0ff, emissiveIntensity: 0 });
  for (let k = 0; k < 6; k++) { const w = new THREE.Mesh(GEO.box(1.6, .35, .06), facWin); w.position.set(-6 + k * 2.4, 4.4, 5.53); g.add(w); }
  const door = new THREE.Mesh(GEO.box(1.4, 2.4, .1), stdMat(0x3b3f42, .6)); door.position.set(0, 1.2, 5.55); g.add(door); FAC.doorMesh = door;
  const mast = new THREE.Mesh(GEO.cyl(.08, .12, 7, 6), stdMat(0x5d6163)); mast.position.set(5.5, 9.3, -3); g.add(mast);
  for (let k = 0; k < 28; k++) { const a = k / 28 * TAU, p = new THREE.Mesh(GEO.box(.1, 1.8, .1), stdMat(0x5d6163)); p.position.set(Math.cos(a) * 15, .9, Math.sin(a) * 13); g.add(p); }
  g.position.set(FAC.x, y, FAC.z); scene.add(g); facility = g;
  car(FAC.x - 10, FAC.z + 8, .5, 0xd8d4c8); car(FAC.x + 11, FAC.z + 9, -.3, 0x2a2a2e);
  FAC.door = P(FAC.x, FAC.z + 7.2);
}

function buildWorld() {
  seedNoise(cfg.world.seed);
  R = mulberry32(cfg.world.seed);
  const n = cfg.world.villages;
  for (let i = 0; i < n; i++) buildVillage(VILLAGE_DEFS[i], i);
  LAKE.level = baseH(LAKE.x, LAKE.z) - 1.2;
  ROADS = VILL.map(v => [v.x, v.z, FAC.x, FAC.z]);
  if (n > 2) for (let i = 0; i < n; i++) { const a = VILL[i], b = VILL[(i + 1) % n]; ROADS.push([a.x, a.z, b.x, b.z]); }
  else if (n === 2) ROADS.push([VILL[0].x, VILL[0].z, VILL[1].x, VILL[1].z]);
  FAC.h = baseH(FAC.x, FAC.z);
  buildTerrain();
  for (const v of VILL) { furnishVillage(v, cfg.world.perVillage); furnishStores(v); }
  buildFacility();
  buildNature();
  WORLD.season = seasonAt(sim.hours);
  recolorTerrain(0, 0); seasonalFoliage(WORLD.season, 0);
}

// ---------- seasons ----------
const YEAR = 120;   // days in a sim year: thirty a season keeps winters coming
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const seasonAt = h => SEASONS[Math.floor(((h / 24 + (cfg ? SEASONS.indexOf(cfg.world.season) * 30 : 0)) % YEAR) / 30)];
const winterAmt = h => { const d = ((h / 24 + SEASONS.indexOf(cfg.world.season) * 30) % YEAR); return d >= 88 && d < 120 ? clamp(Math.min(d - 88, 120 - d) / 6) : 0; };
const tempAt = h => { const s = seasonAt(h), hour = h % 24, base = { spring: 12, summer: 22, autumn: 11, winter: -4 }[s]; return base + Math.sin((hour - 9) / 24 * TAU) * 6; };

// ---------- light ----------
const SKY = { dayTop: new THREE.Color(0x7ea7d4), dayBot: new THREE.Color(0xdfe5e0), duskTop: new THREE.Color(0x3c4a78), duskBot: new THREE.Color(0xe7a774), nightTop: new THREE.Color(0x070b18), nightBot: new THREE.Color(0x1b2233), grey: new THREE.Color(0x9ea39b), t1: new THREE.Color(), t2: new THREE.Color() };
function lightWorld(focus, rot, winter) {
  const h24 = sim.hours % 24, sunA = (h24 - 6) / 12 * Math.PI;
  const day = clamp(Math.sin(sunA) * 1.6 + .1), dusk = clamp(1 - Math.abs(Math.sin(sunA)) * 3) * (h24 > 4 && h24 < 21 ? 1 : 0);
  const dir = new THREE.Vector3(Math.cos(sunA) * .8, Math.max(.12, Math.sin(sunA)), .45).normalize();
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(dir, 160);
  sun.intensity = (.05 + day * .95) * (1 - rot * .25) * (1 - winter * .2);
  sun.color.set(0xfff1d8).lerp(new THREE.Color(0xffa860), dusk * .7);
  moon.target.position.copy(focus); moon.position.copy(focus).add(new THREE.Vector3(-60, 90, -40)); moon.intensity = (1 - day) * .22;
  hemi.intensity = (.22 + day * .42) * (1 - rot * .1);
  const top = SKY.t1.copy(SKY.nightTop).lerp(SKY.duskTop, clamp(day * 2)).lerp(SKY.dayTop, clamp(day * 1.4 - .3)).lerp(SKY.grey, rot * .35 * day + winter * .3 * day);
  const bot = SKY.t2.copy(SKY.nightBot).lerp(SKY.duskBot, clamp(day * 2.5) * (1 - clamp(day * 1.5 - .5))).lerp(SKY.dayBot, clamp(day * 1.6 - .4)).lerp(SKY.grey, rot * .35 * day + winter * .4 * day);
  sky.material.uniforms.top.value.copy(top); sky.material.uniforms.bottom.value.copy(bot);
  sky.position.copy(camera.position);
  scene.fog.color.copy(bot); scene.fog.near = lerp(110, 45, rot * .7 + winter * .3); scene.fog.far = lerp(460, 260, rot * .6 + winter * .3);
  if (camMode === 'map') { scene.fog.near = 500; scene.fog.far = 1400; }
  renderer.toneMappingExposure = 1.05 + (1 - day) * .45;   // night stays readable
  const lit = sim.phase === 'life' || sim.phase === 'setup' ? (1 - day) : 0;
  WIN_MAT.emissiveIntensity = lit * .9;
  facWin.emissiveIntensity = FAC.lit ? (1 - day) * 1.2 + .2 : 0;
  return day;
}

// ---------- the people ----------
const NAMES = ['Mira', 'Tomas', 'Anaya', 'Kofi', 'Lena', 'Ravi', 'Ines', 'Jun', 'Sana', 'Ola', 'Pavel', 'Noor', 'Dario', 'Hana', 'Felix', 'Amara', 'Yusuf', 'Elif', 'Bram', 'Keiko', 'Luca', 'Zara', 'Ade', 'Rhea', 'Mateo', 'Ivy', 'Omar', 'Tess', 'Nils', 'Priya', 'Sol', 'Edda', 'Kasim', 'Lio', 'Maren', 'Theo', 'Uma', 'Bea', 'Joon', 'Farah', 'Aksel', 'Nia', 'Oren', 'Saoirse', 'Tobi', 'Wren', 'Yara', 'Cyrus', 'Dalia', 'Emil', 'Gita', 'Hugo', 'Ilse', 'Kian', 'Lucia', 'Milo', 'Nadia', 'Otto', 'Paz', 'Rune', 'Selin', 'Tarek', 'Vida'];
const FEMALE = new Set(['Mira', 'Anaya', 'Lena', 'Ines', 'Sana', 'Ola', 'Noor', 'Hana', 'Amara', 'Elif', 'Keiko', 'Zara', 'Rhea', 'Ivy', 'Tess', 'Priya', 'Edda', 'Maren', 'Uma', 'Bea', 'Farah', 'Nia', 'Saoirse', 'Wren', 'Yara', 'Dalia', 'Gita', 'Ilse', 'Lucia', 'Nadia', 'Paz', 'Selin', 'Vida']);
const sexOf = name => FEMALE.has(name) ? 'f' : 'm';
function roster(c) {
  const n = c.world.villages, per = c.world.perVillage, home = Math.min(c.vega.home, n - 1);
  const order = [home, ...[...Array(n).keys()].filter(v => v !== home)];
  const list = []; let ni = 0;
  for (const v of order) for (let k = 0; k < per; k++) {
    if (v === home && k === 0) list.push({ name: c.vega.name || 'Vega', village: v, vega: true, sex: 'm' });
    else { let nm = NAMES[ni++ % NAMES.length]; if (nm === c.vega.name) nm = NAMES[ni++ % NAMES.length]; list.push({ name: nm, village: v, sex: sexOf(nm) }); }
  }
  return list;
}
const SKINS = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x5c3a21, 0xa66a3f];
const HAIRS = [0x1d1a17, 0x3b2a1e, 0x6a4a2c, 0xb08a52, 0x2a2a2a, 0x8c8c86, 0x7a3b1e];
const TRAIT_NAMES = { openness: 'open', conscientiousness: 'careful', extraversion: 'outgoing', agreeableness: 'kind', emotional_stability: 'steady', curiosity: 'curious', ambition: 'ambitious', independence: 'independent', persistence: 'stubborn', impulsiveness: 'impulsive' };
const TRAIT_LOW = { openness: 'set in their ways', conscientiousness: 'scattered', extraversion: 'quiet', agreeableness: 'prickly', emotional_stability: 'anxious', curiosity: 'incurious', ambition: 'content', independence: 'dependent', persistence: 'gives up easily', impulsiveness: 'deliberate' };
const LIFE_WANTS = { family: 'Wants a family of their own', freedom: 'Wants to leave and see the coast', wealth: 'Wants to own a market stall', knowledge: 'Wants to read every book in the library', status: 'Wants to be someone people listen to', community: 'Wants to belong somewhere' };
const WANT_LABEL = { social: 'Company', achieve: 'To achieve', know: 'To learn', free: 'Freedom', family: 'Family' };
const OCC = { farmer: 'farmer', crafter: 'crafter', hunter: 'hunter', scholar: 'scholar', healer: 'healer' };

const citizens = [];
let vegaC = null;
function makeCitizen(entry, idx) {
  const isVega = !!entry.vega, V = cfg.vega;
  const p = {}; for (const k of Object.keys(TRAIT_NAMES)) p[k] = wide();
  const v = { family: wide(), freedom: wide(), wealth: wide(), knowledge: wide(), status: wide(), community: wide() };
  if (isVega) {
    Object.assign(p, { openness: V.openness, conscientiousness: V.conscientiousness, extraversion: V.extraversion, agreeableness: V.agreeableness, emotional_stability: V.stability, curiosity: V.curiosity, ambition: V.ambition, independence: V.independence, persistence: V.persistence, impulsiveness: V.impulsiveness });
    Object.assign(v, { family: V.family, freedom: V.freedom, wealth: V.wealth, knowledge: V.knowledge, status: V.status, community: V.community });
  }
  const w = {
    social: { w: .2 + .8 * (p.extraversion * .6 + v.community * .4), l: rnd(.4, .8) },
    achieve: { w: .2 + .8 * (p.ambition * .5 + v.wealth * .5), l: rnd(.4, .8) },
    know: { w: .2 + .8 * (p.curiosity * .6 + v.knowledge * .4), l: rnd(.4, .8) },
    free: { w: .2 + .8 * (p.independence * .5 + v.freedom * .5), l: rnd(.4, .8) },
    family: { w: .1 + .8 * v.family, l: rnd(.4, .8) },
  };
  const topVal = Object.entries(v).sort((a, b) => b[1] - a[1])[0][0];
  const shirt = isVega ? new THREE.Color(V.shirt).getHex() : new THREE.Color().setHSL(rnd(0, 1), rnd(.25, .55), rnd(.32, .58)).getHex();
  const sex = entry.sex || 'm', fem = sex === 'f';
  const wear = wardrobe(sex, isVega, shirt);
  const look = Object.assign({ sex, skin: isVega ? SKINS[V.skin % SKINS.length] : pick(SKINS), shirt, hair: isVega ? HAIRS[V.hair % HAIRS.length] : fem ? pick([0x9a4a2a, 0x9a4a2a, 0x7a3b1e, 0x3b2a1e, 0xb08a52, 0x1d1a17]) : pick(HAIRS),
    height: isVega ? V.height : (fem ? rnd(1.6, 1.8) : rnd(1.68, 1.94)), hairStyle: isVega ? 0 : fem ? pick([4, 4, 4, 3, 1]) : pick([0, 0, 2, 5, 0]), build: isVega ? V.build : fem ? rnd(.92, 1.02) : rnd(.95, 1.1),
    jacket: !isVega && !fem && R() < .2 ? pick([0x3d5a7a, 0x5a3f2c, 0x55603f, 0x2e3a4a]) : null, boots: pick([0x3a2c22, 0x2a2622, 0x5a4632]) }, wear);
  const h = makeHuman(look);
  const vil = VILL[entry.village];
  const homes = vil.houses.filter(x => !x.library);
  const home = homes[Math.floor(idx / 1) % homes.length];
  home.owners = home.owners || []; home.owners.push(entry.name);
  const c = {
    i: idx, name: entry.name, isVega, sex, orient: isVega ? (cfg.vega.orient || 'f') : (() => { const r = R(); return r < .86 ? (sex === 'f' ? 'm' : 'f') : r < .93 ? sex : 'both'; })(), p, v, w, h, look, home, shirt, village: entry.village, homeVillage: entry.village,
    occupation: isVega ? V.occupation : pick(Object.keys(OCC)),
    life: isVega ? V.life : LIFE_WANTS[topVal],
    rates: isVega ? { hunger: .035 * V.appetite, thirst: .06 * V.thirst, sleep: .045 * V.sleepNeed } : { hunger: .035 * rnd(.7, 1.4), thirst: .06 * rnd(.75, 1.3), sleep: .045 * rnd(.8, 1.25) },
    chrono: isVega ? V.bedtime : 21.5 + rnd(-2, 2.5),
    needs: { hunger: rnd(.1, .4), thirst: rnd(.1, .4), sleep: rnd(0, .2), energy: rnd(.7, 1), health: 1 },
    money: rnd(5, 25), rel: new Map(), act: null, thought: '', pos: home.door.clone().add(new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1))), yaw: rnd(0, TAU), chatLine: null,
    alive: true, sick: false, sickAt: Infinity, deathAt: Infinity, cause: '', deathPos: null, found: false, buried: false, remains: null, grave: null,
    survivor: false, relocated: false, met: false, revived: null,
  };
  onGround(c.pos);
  h.root.position.copy(c.pos);
  h.root.traverse(o => { o.userData.cit = c; });
  scene.add(h.root);
  return c;
}
function buildPeople() {
  const list = roster(cfg);
  list.forEach((e, idx) => citizens.push(makeCitizen(e, idx)));
  vegaC = citizens[0];
  // everyone knows a few neighbours already
  for (const c of citizens) for (const o of citizens) if (o !== c && o.village === c.village && R() < .3) c.rel.set(o, rnd(.04, .2));
  for (const name of cfg.vega.friends) {
    const f = citizens.find(c => c.name === name && !c.isVega); if (!f) continue;
    vegaC.rel.set(f, .55); f.rel.set(vegaC, .5);
  }
  seedRomance(citizens);
  const crush = cfg.vega.crush && citizens.find(c => c.name === cfg.vega.crush && !c.isVega);
  if (crush && attractedTo(vegaC, crush)) { vegaC.spark.set(crush, .95); vegaC.att.set(crush, .5); }
  for (const name of cfg.outside.survivors) { const s = citizens.find(c => c.name === name && !c.isVega); if (s && cfg.outside.ending === 'survivors') s.survivor = true; }
}

const isNight = (h, c) => { const hh = h % 24, s = c.chrono % 24, e = (c.chrono + 8.5) % 24; return s < e ? hh >= s && hh < e : hh >= s || hh < e; };
function nearPlace(v, k, rr) { const pl = VILL[v].places[k], a = rnd(0, TAU), r = Math.sqrt(R()) * (rr ?? pl.r); return P(pl.pos.x + Math.cos(a) * r, pl.pos.z + Math.sin(a) * r); }
function topFriend(c, n = 1) { const arr = [...c.rel.entries()].filter(([o]) => o !== c).sort((a, b) => b[1] - a[1]); return n === 1 ? (arr[0] && arr[0][1] > .15 ? arr[0][0] : null) : arr.slice(0, n); }
const inTown = c => c.alive && (!c.isVega || sim.phase === 'life' || sim.phase === 'setup');

const CIV_THOUGHTS = {
  eat: c => c.needs.hunger > .7 ? 'Starving. Market, now.' : (WORLD.food < .5 ? 'The stalls are half empty again.' : pick(['Something to eat first.', 'Bread, then the rest of the day.'])),
  forage: c => WORLD.food < .5 ? 'Digging for anything the blight left.' : pick(['No coins. The fields will have to do.', 'Picking whatever grows.']),
  drink: c => c.needs.thirst > .7 ? 'Mouth like sand. The well.' : 'A drink at the well.',
  sleep: c => c.sick ? 'Burning up. Can\'t get out of bed.' : (c.needs.sleep > .7 ? 'Can barely keep my eyes open.' : 'Home, and bed.'),
  work: c => c.money < 8 ? 'Need coin before the market closes.' : pick(['Back to the bench.', `Every job gets me closer. ${c.life.replace('Wants', 'I want').replace('their own', 'my own')}.`]),
  learn: c => pick(['There was a book I didn\'t finish.', 'The library is quiet this time of day.']),
  social: c => { const f = topFriend(c); if (!c.isVega && vegaC && (vegaC.rel.get(c) || 0) > .3 && sim.phase !== 'life') return `Nobody has seen ${vegaC.name} in weeks.`; return f ? `Maybe ${f.name} is at the plaza.` : 'I could use some company.'; },
  wander: c => c.p.independence > .6 ? 'Walking the edge of town. Thinking about leaving.' : 'Just walking.',
  visit: c => `Walking to ${VILL[c.act.visitV].name}. ${pick(['Trading.', 'Seeing family there.', 'News travels slowly otherwise.'])}`,
  family: c => pick(['Supper at home tonight. Everyone at the table.', 'Home early. They\'ll be waiting.']),
  shop: c => c.crush && !c.partner && !c.gift ? `Something small for ${c.crush.name}. Is that too much?` : pick(['Payday. The store.', 'A new book, maybe.', 'Tins for the cupboard. You never know.']),
  date: c => c.partner ? pick([`Meeting ${c.partner.name} by the well tonight.`, `${c.partner.name}. I've been thinking about ${c.partner.name} all day.`, `A walk with ${c.partner.name} before dark.`]) : 'Walking.',
  court: c => c.crush ? pick([`If ${c.crush.name} is at the plaza, I'll say something this time.`, `I keep finding reasons to walk past ${c.crush.name}'s door.`, `What do I even say to ${c.crush.name}?`]) : 'Walking.',
};
function civDecide(c, hour) {
  const n = c.needs, W = c.w, noise = () => R() * .25 * (.5 + c.p.impulsiveness);
  const want = k => W[k].w * Math.pow(1 - W[k].l, 1.3) * 1.25;
  const night = isNight(hour, c), day = hour % 24 > 7 && hour % 24 < 19, vi = c.village;
  const U = {
    eat: c.money >= 4 && WORLD.food > .15 ? Math.pow(n.hunger, 1.4) * 2.4 : 0,
    forage: c.money < 4 || WORLD.food <= .15 ? Math.pow(n.hunger, 1.4) * 2 : 0,
    drink: Math.pow(n.thirst, 1.4) * 2.4,
    sleep: Math.pow(n.sleep, 1.5) * 2 + (night ? (n.sleep > .3 ? 1 : .35) : 0) + (n.energy < .15 ? 1 : 0) + (c.sick ? 4 : 0),
    work: day ? want('achieve') + (c.money < 10 ? .35 : 0) : 0,
    learn: want('know') * (night ? .4 : 1),
    social: want('social') * (night ? .45 : 1),
    wander: want('free') * (night ? .3 : 1) * .8,
    visit: VILL.length > 1 && day && !c.sick && WORLD.food > .3 ? want('free') * .35 + c.p.extraversion * .1 : 0,
    family: hour % 24 > 17 && hour % 24 < 21 ? want('family') * .9 : 0,
    shop: c.money > 14 && day && VILL[vi].places.store ? (.12 + want('achieve') * .15 + want('know') * .1 + (c.crush && !c.partner && !c.gift ? .35 : 0) + (WORLD.blight ? .3 : 0)) * Math.min(1.6, c.money / 25) : 0,
    date: c.partner && inTown(c.partner) && !c.partner.sick && hour % 24 > 17 && hour % 24 < 22 && !c.sick ? .55 + c.emo.love * .7 + c.emo.lust * .3 : 0,
    court: c.crush && !c.partner && inTown(c.crush) && day && !c.sick ? (c.att.get(c.crush) || 0) * (.35 + c.p.extraversion * .5) : 0,
  };
  let best = 'wander', bv = -1;
  for (const k in U) { const u = U[k] + noise(); if (u > bv) { bv = u; best = k; } }
  let target, dur, yaw = null, visitV = null;
  switch (best) {
    case 'eat': target = nearPlace(vi, 'market', 2.4); dur = .8; c.money -= 4; break;
    case 'forage': target = nearPlace(vi, 'fields'); dur = 1.5; break;
    case 'drink': target = nearPlace(vi, 'well', 1.8); dur = .4; break;
    case 'sleep': target = c.home.door.clone(); dur = c.sick ? 24 : 8; break;
    case 'work': target = nearPlace(vi, 'workshop', 2.6); dur = rnd(2.5, 4.5); break;
    case 'learn': target = nearPlace(vi, 'library', 2.2); dur = rnd(1.5, 3); break;
    case 'social': target = nearPlace(vi, 'plaza'); dur = rnd(1.2, 2.8); break;
    case 'family': target = c.home.door.clone().add(new THREE.Vector3(rnd(-1.5, 1.5), 0, rnd(-1.5, 1.5))); dur = rnd(1, 2); break;
    case 'visit': { visitV = pick(VILL.filter(x => x.i !== vi)).i; target = nearPlace(visitV, 'plaza'); dur = rnd(2, 4); break; }
    case 'date': { target = nearPlace(c.partner.village, pick(['well', 'plaza', 'fields']), 2.5); dur = rnd(1, 2.2); const o = c.partner; if (!o.act || !['sleep', 'eat', 'date'].includes(o.act.kind)) { o.act = { kind: 'date', target: target.clone().add(new THREE.Vector3(.9, 0, .4)), dur, t: 0, arrived: false }; o.thought = CIV_THOUGHTS.date(o); } break; }
    case 'shop': target = VILL[vi].places.store.pos.clone().add(new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1))); dur = rnd(.4, .9); break;
    case 'court': { const o = c.crush; target = o.pos.clone().add(new THREE.Vector3(rnd(-1.4, 1.4), 0, rnd(-1.4, 1.4))); dur = rnd(.6, 1.4); break; }
    case 'wander': { const a = rnd(0, TAU), r = rnd(26, 44), V = VILL[vi]; target = P(V.x + Math.cos(a) * r, V.z + Math.sin(a) * r); dur = rnd(.6, 1.6); break; }
  }
  onGround(target);
  c.act = { kind: best, target, dur, t: 0, yaw, arrived: false, visitV };
  c.thought = CIV_THOUGHTS[best](c);
}
const CIV_POSE = { shop: 'reach_wall', eat: 'eat_stand', forage: 'forage', drink: 'eat_stand', sleep: 'lie', work: 'hammer', learn: 'read', social: 'chat', wander: 'look', visit: 'chat', family: 'chat', date: 'chat', court: 'chat' };
const CIV_TOOL = { eat: 'bread', forage: 'basket', drink: 'bucket', work: 'hammer', learn: 'book', date: 'flower', shop: 'basket' };
const CHAT = c => {
  const f = topFriend(c);
  const lines = [c.life.replace('Wants', 'I want').replace('their own', 'my own') + '.', 'Did you hear the well rope snapped?', 'Market prices again.', 'Long day at the bench.', 'Rain tomorrow, maybe.'];
  if (f) lines.push(`Have you seen ${f.name}?`);
  if (c.act && c.act.kind === 'visit') lines.push(`How are things in ${VILL[c.homeVillage].name}?`, 'I walked all morning to get here.');
  if (c.isVega) lines.push('I want to see the coast one day.', 'What do you think is in that grey building?');
  if (WORLD.food < .7) lines.push('The fields are black.', 'My hands won\'t stop shaking.', 'Three more buried this week.');
  if (c.survivor && WORLD.blight) lines.push('We should go somewhere the fever hasn\'t reached.');
  const o = c.chatPartner;
  if (o && c.partner === o) return pick([`I could stay out here all night with you, ${o.name}.`, 'Your hand is cold. Here.', 'Do you ever think about leaving? Together?', 'Stay a bit longer.', 'I missed you today.']);
  if (o && c.crush === o) return pick(['I... like your coat.', `Oh. Hi, ${o.name}.`, 'Are you going to the market tomorrow? I might be.', 'Sorry. I forgot what I was saying.']);
  if (c.emo && c.emo.jealousy > .4 && (c.partner || c.crush)) return pick([`Who was ${(c.partner || c.crush).name} laughing with?`, 'Never mind. It\'s nothing.']);
  return pick(lines);
};

function die(c) {
  c.alive = false;
  const asleep = c.act && c.act.kind === 'sleep' && c.act.arrived;
  c.deathPos = asleep && c.home.rec && c.home.rec.bedWorld ? c.home.rec.bedWorld() : onGround(c.pos.clone().add(new THREE.Vector3(rnd(-.6, .6), 0, rnd(-.6, .6))));
  c.h.root.visible = false;
  const friend = vegaC && (vegaC.rel.get(c) || 0) > .25;
  OUT.push({ h: sim.hours, text: `${c.name} died of ${c.cause}${asleep ? ' at home' : ''} in ${VILL[c.village].name}.`, friend });
  if (sim.phase === 'after') { makeRemains(c); }
  const left = citizens.filter(o => o.alive && !o.isVega && !o.survivor).length;
  if (left === 0 && !OUT.noneLeft) { OUT.noneLeft = true; OUT.push({ h: sim.hours, text: citizens.some(o => o.survivor) ? 'Only the few who fled are left.' : 'Nobody is left.' }); }
}

function civStep(dtH, dtR) {
  const hour = sim.hours;
  if (hour >= sim.collapseAt) {
    if (!WORLD.blight) {
      WORLD.blight = true;
      OUT.push({ h: hour, text: { fever: 'A fever starts in the market and spreads house to house.', famine: 'A black rot spreads through every field.', both: 'A black rot takes the fields. Then a fever comes.' }[cfg.outside.cause] });
    }
    if (cfg.outside.cause !== 'fever') WORLD.food = clamp(WORLD.food - dtH / (24 * 22), .08, 1);
    else WORLD.food = clamp(WORLD.food - dtH / (24 * 60), .45, 1);
  }
  storesDuringCollapse(dtH);
  for (const c of citizens) {
    if (!inTown(c) || c.companion) continue;
    const n = c.needs;
    if (c.survivor && WORLD.blight && !c.relocated && hour >= sim.collapseAt + 48) relocate(c);
    if (!c.sick && hour >= c.sickAt) { c.sick = true; c.act = null; if (R() < .25) OUT.push({ h: hour, text: `${c.name} has the fever.` }); }
    if (hour >= c.deathAt) { die(c); continue; }
    const a = c.act, sleeping = a && a.kind === 'sleep' && a.arrived;
    n.hunger = clamp(n.hunger + c.rates.hunger * dtH * (sleeping ? .5 : 1));
    n.thirst = clamp(n.thirst + c.rates.thirst * dtH * (sleeping ? .4 : 1));
    if (c.survivor) n.hunger = Math.min(n.hunger, .7);   // they ration; that is how they lasted
    if (!sleeping) { n.sleep = clamp(n.sleep + c.rates.sleep * dtH); n.energy = clamp(n.energy - .03 * dtH); }
    if (c.sick) n.health = clamp(n.health - .01 * dtH);
    else if (n.hunger > .85 || n.thirst > .92) n.health = clamp(n.health - .02 * dtH); else n.health = clamp(n.health + .01 * dtH);
    for (const k in c.w) c.w[k].l = clamp(c.w[k].l - c.w[k].w * .014 * dtH);   // wants drain slowly enough that a day of living can keep up
    romanceStep(c, dtH);
    if (c.gift && c.crush && c.chatPartner === c.crush && c.act && c.act.arrived) { c.gift = false; const o = c.crush; if (o.att && o.spark.has(c)) { o.att.set(c, clamp((o.att.get(c) || 0) + .18)); o.emo.joy = clamp(o.emo.joy + .2); } c.chatLine = { text: pick(['I saw this and thought of you.', 'It\'s nothing. It\'s a bird. Here.']), until: performance.now() + 3200 }; }
    if (c.partner && c.partner.village === c.village && c.partner.home !== c.home && c.emo.love > .45 && c.i < c.partner.i) { c.partner.home = c.home; if (c.isVega || c.partner.isVega) OUT.push({ h: hour, text: `${vegaC.name} and ${(c.isVega ? c.partner : c).name} move in together.`, heart: true }); }
    if (!c.act || c.act.t >= c.act.dur || (!c.sick && n.hunger > .85 && c.act.kind !== 'eat' && c.act.kind !== 'forage') || (!c.sick && n.thirst > .9 && c.act.kind !== 'drink')) {
      c.h.root.visible = true;
      civDecide(c, hour);
    }
    const act = c.act;
    const dx = act.target.x - c.pos.x, dz = act.target.z - c.pos.z, dist = Math.hypot(dx, dz);
    if (!act.arrived) {
      const step = Math.min(dist, WALK * dtH * (.6 + .4 * n.energy) * (c.sick ? .4 : 1));
      if (dist > .15) { c.pos.x += dx / dist * step; c.pos.z += dz / dist * step; onGround(c.pos); if (dtR) c.yaw += angDiff(c.yaw, Math.atan2(dx, dz)) * Math.min(1, dtR * 8); c.h.phase += step * 4.4; }
      else act.arrived = true;
    } else {
      act.t += dtH;
      const k = act.kind;
      if (k === 'eat') n.hunger = clamp(n.hunger - .65 * WORLD.food * dtH);
      if (k === 'forage') n.hunger = clamp(n.hunger - .22 * Math.max(.3, WORLD.food) * dtH);
      if (k === 'drink') { n.thirst = clamp(n.thirst - 1.6 * dtH); if (n.thirst < .03) act.t = act.dur; }
      if (k === 'sleep') { n.sleep = clamp(n.sleep - .17 * dtH); n.energy = clamp(n.energy + .13 * dtH); c.h.root.visible = false; if (!c.sick && n.sleep < .03 && !isNight(hour, c)) act.t = act.dur; }
      if (k === 'work') { c.money += 6 * dtH; n.energy = clamp(n.energy - .03 * dtH); c.w.achieve.l = clamp(c.w.achieve.l + .13 * dtH); }
      if (k === 'learn') c.w.know.l = clamp(c.w.know.l + .16 * dtH);
      if (k === 'wander' || k === 'visit') c.w.free.l = clamp(c.w.free.l + .2 * dtH);
      if (k === 'family') c.w.family.l = clamp(c.w.family.l + .2 * dtH);
      if (k === 'shop' && !act.bought) { act.bought = true; buy(c); }
      if (k === 'date' || k === 'court') { c.w.social.l = clamp(c.w.social.l + .2 * dtH); if (k === 'date') { c.emo.affection = clamp(c.emo.affection + .04 * dtH); c.emo.lust = clamp(c.emo.lust - .02 * dtH); } }
      if (k === 'social' || k === 'work' || k === 'visit' || k === 'date' || k === 'court') {
        let best = null, bd = 3.6;
        for (const o of citizens) {
          if (o === c || !inTown(o) || !o.act || !o.act.arrived) continue;
          const talky = x => x === 'social' || x === 'visit' || x === 'date' || x === 'court';
          if (!(o.act.kind === k || (talky(k) && talky(o.act.kind)))) continue;
          const dd = o.pos.distanceTo(c.pos); if (dd < bd && (k !== 'date' || o === c.partner || !best || best !== c.partner)) { bd = dd; best = o; }
          if (dd < 3.6) { c.rel.set(o, clamp((c.rel.get(o) || 0) + (k === 'work' ? .025 : .09) * dtH * (.3 + (c.p.agreeableness + o.p.agreeableness) / 2))); romanceNear(c, o, dtH, k); }
        }
        if (k !== 'work') {
          c.w.social.l = clamp(c.w.social.l + .17 * dtH * (best ? 1 + (c.rel.get(best) || 0) : .4));
          c.chatPartner = best;
          if (best && dtR) { const dd = best.pos.clone().sub(c.pos); c.yaw += angDiff(c.yaw, Math.atan2(dd.x, dd.z)) * Math.min(1, dtR * 4); }
          if (best && R() < dtH * .6) c.chatLine = { text: CHAT(c), until: performance.now() + 2600 };
        }
      }
    }
  }
}
// what wages buy: a gift for someone, a book, a tool, tins for the cupboard, a new jumper. It is kept at
// home, and some of it will still be there when he comes back.
function buy(c) {
  const st = STORES.find(s => s.v === c.village && s.store === 'grocery'), home = c.home.stock || (c.home.stock = {});
  const opts = [];
  if (c.crush && !c.partner && !c.gift) opts.push(['gift', 6, 3]);
  opts.push(['cans', 4, 1 + (WORLD.blight ? 2 : 0)], ['book', 7, c.w.know.w], ['tool', 10, c.occupation === 'crafter' || c.occupation === 'hunter' ? 1 : .3], ['clothes', 9, c.v.status]);
  let best = null, bv = -1; for (const o of opts) { const v = o[2] * (.6 + R() * .8); if (c.money >= o[1] && v > bv) { bv = v; best = o; } }
  if (!best) return;
  c.money -= best[1];
  if (best[0] === 'gift') { c.gift = true; c.thought = `I bought ${c.crush.name} a little carved bird.`; }
  if (best[0] === 'cans') { home.cans = (home.cans || 0) + 2; if (st) st.stock.cans = Math.max(0, st.stock.cans - 2); }
  if (best[0] === 'book') home.books = (home.books || 0) + 1;
  if (best[0] === 'tool') home.tools = (home.tools || 0) + 1;
  if (best[0] === 'clothes') { c.w.achieve.l = clamp(c.w.achieve.l + .1); c.emo.joy = clamp(c.emo.joy + .1); }
  c.purchases = (c.purchases || 0) + 1;
}
function relocate(c) {
  c.relocated = true;
  const ref = refugeVillage();
  c.village = ref;
  const hs = VILL[ref].houses.filter(x => !x.library);
  c.home = hs[Math.floor(R() * hs.length)];
  c.act = null;
  OUT.push({ h: sim.hours, text: `${c.name} packs what they can carry and leaves for ${VILL[ref].name}.`, friend: (vegaC.rel.get(c) || 0) > .25 });
}
function refugeVillage() {
  if (cfg.outside.refuge !== 'far' && +cfg.outside.refuge < VILL.length) return +cfg.outside.refuge;
  const home = VILL[vegaC.homeVillage];
  return VILL.slice().sort((a, b) => Math.hypot(b.x - home.x, b.z - home.z) - Math.hypot(a.x - home.x, a.z - home.z))[0].i;
}

const _lookP = new THREE.Vector3();
function renderPeople(dtR, now, filter) {
  for (const c of citizens) {
    if (!filter(c)) continue;
    const a = c.act, h = c.h;
    h.root.position.copy(c.pos); h.root.rotation.y = c.yaw;
    let kind = 'stand';
    if (a) kind = a.arrived ? CIV_POSE[a.kind] : 'walk';
    h.phase += (a && a.arrived ? dtR * 3 : 0);
    applyPose(h, pose(kind, h.phase, { slump: c.sick ? .6 : 0, tremor: c.sick ? .05 : 0 }), 1 - Math.exp(-dtR * 9));
    holdTool(h, a && a.arrived ? CIV_TOOL[a.kind] || null : (a && a.kind === 'date' ? 'flower' : null));
    if (dtR && camera.position.distanceTo(c.pos) < 30) {
      const st = lifeState(c);
      setFace(h, faceFrom(st, a && a.kind === 'sleep' && a.arrived), dtR);
      const o = c.chatPartner && a && a.arrived ? c.chatPartner : (c.crush && c.crush.pos.distanceTo(c.pos) < 9 && inTown(c.crush) ? c.crush : null);
      lookAtPoint(h, o ? _lookP.set(o.pos.x, o.pos.y + 1.55, o.pos.z) : null, dtR, o ? 1 : 0);
    }
    if (c.chatLine && now < c.chatLine.until && h.root.visible && camera.position.distanceTo(c.pos) < 70) tag('chat' + c.i, c.chatLine.text, new THREE.Vector3(c.pos.x, c.pos.y + 2.3, c.pos.z), 'bub');
  }
}

// ---------- decay ----------
function applyDecay(rot) {
  WORLD.rot = rot;
  const dark = new THREE.Color(0x544c40), rust = new THREE.Color(0x7a4a2a);
  for (const b of BUILDS) {
    if (b.repaired || b.burnt) continue;
    b.wallMat.color.copy(b.wallBase).lerp(dark, rot * .45); b.gMat.color.copy(b.wallMat.color);
    b.roofMat.color.copy(b.roofBase).lerp(dark, rot * .5);
    b.roof.rotation.z = b.tz * rot * .35; b.roof.rotation.x = b.tx * rot * .35;
    b.door.rotation.y = rot > .2 ? -b.doorSwing * clamp(rot * 2) : 0;
    for (const gl of b.glass) { const br = rot > .15 && gl.brk < rot * 1.3; if (br !== gl.broken && !gl.boarded) { gl.broken = br; gl.gl.visible = !br; gl.hole.visible = br; } }
    if (b.collapse) { const k = smooth(.35, .8, rot); b.walls.scale.y = 1 - k * .3; b.roof.position.y = b.F + b.h * (1 - k * .3) - k * .2; b.roof.rotation.x = b.tx * rot * .35 + k * .3; }
  }
  for (const c of CARS) { c.body.color.copy(c.base).lerp(rust, rot * .75); c.wheels.forEach((w, i) => { w.position.y = .34 - (i % 2 ? rot : rot * .6) * .14; }); }
  for (const f of FENCES) { f.g.rotation.z = f.lean * rot; f.m.color.copy(f.base).lerp(dark, rot * .5); }
  for (const v of VILL) {
    v.stalls.forEach((s, k) => { const t = smooth(.15, .5, rot); s.rotation.z = t * (1 + k * .15); s.position.y = heightAt(s.position.x, s.position.z) + .45 - t * .1; });
    v.fields.material.color.set(0xffffff).lerp(new THREE.Color(0x6a7a3a), rot);
  }
  growGrass(rot);
}
