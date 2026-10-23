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
