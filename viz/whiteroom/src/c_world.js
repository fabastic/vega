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
    const berries = new THREE.Group(); for (let j = 0; j < 7; j++) { const be = new THREE.Mesh(GEO.sph(.06, 6, 5), berryMat); be.position.set(rnd(-.55, .55), rnd(.4, .8), rnd(-.55, .55)); berries.add(be); } g.add(berries);
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
