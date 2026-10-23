// =====================================================================
// THE WHITE CHAMBER
// =====================================================================
const roomScene = new THREE.Scene();
roomScene.background = new THREE.Color(0xfafaf7);
const roomGroup = new THREE.Group(); roomScene.add(roomGroup);
const mindGroup = new THREE.Group(); roomScene.add(mindGroup);
const rHemi = new THREE.HemisphereLight(0xffffff, 0xd9d9d2, .78); roomScene.add(rHemi);
const rLamp = new THREE.PointLight(0xffffff, .75, 16, 1.4); rLamp.castShadow = true; rLamp.shadow.mapSize.set(1024, 1024); roomScene.add(rLamp);
let RS = 3, RH = 3;
const WALLS = [], DOOR = { x: .8, w: .92, h: 2.05 };
let panelMat, lightPanel, doorPivot, outsideLight, tray, memory, memMats = [], floorGrass, doppel = null, CORNERS = [];
const FURN = {};
let viewMode = 'mind';     // 'mind' shows what he perceives; 'real' is what a camera records
const pt = (x, z, yaw) => ({ x, z, yaw });
const wallUV = (i, x, z) => i === 0 ? (x + RS) / (2 * RS) : i === 1 ? (z + RS) / (2 * RS) : i === 2 ? (RS - x) / (2 * RS) : (RS - z) / (2 * RS);
const wallPx = (u, y) => [u * 1024, (1 - y / RH) * 512];
function wallSpot(i, s, off = .5) { const a = s * (RS - .5); return [pt(a, -RS + off, Math.PI), pt(RS - off, a, -Math.PI / 2), pt(-a, RS - off, 0), pt(-RS + off, -a, Math.PI / 2)][i]; }
const wallOf = t => t.z < -RS + 1 ? 0 : t.x > RS - 1 ? 1 : t.z > RS - 1 ? 2 : 3;

function buildChamber() {
  const C = cfg.chamber;
  RS = { small: 2, medium: 3, large: 4.5 }[C.size]; RH = RS > 4 ? 3.4 : 3;
  DOOR.x = Math.min(.8, RS - .8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RS * 2, RS * 2), stdMat(0xefefeb, .95)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; roomGroup.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RS * 2, RS * 2), stdMat(0xf6f6f2, 1)); ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; roomGroup.add(ceil);
  panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  lightPanel = new THREE.Mesh(new THREE.PlaneGeometry(RS * .55, RS * .55), panelMat); lightPanel.rotation.x = Math.PI / 2; lightPanel.position.y = RH - .01; roomGroup.add(lightPanel);
  rLamp.position.set(0, RH - .15, 0);
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d'); g.fillStyle = '#f3f3ef'; g.fillRect(0, 0, 1024, 512);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .95, transparent: true, emissive: 0x000000 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(RS * 2, RH), mat); m.receiveShadow = true;
    m.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][i]; m.position.set([0, RS, 0, -RS][i], RH / 2, [-RS, 0, RS, 0][i]);
    roomGroup.add(m); WALLS.push({ c, g, tex, m, mat });
  }
  drawDoorSeam(C.door === 'none' ? 0 : .035);
  { const g = WALLS[2].g, [x0, y0] = wallPx(.5 - .1 * 3 / RS, .55); g.strokeStyle = 'rgba(80,80,78,.5)'; g.lineWidth = 2; g.strokeRect(x0, y0, 1024 * .2 * 3 / RS, 512 * (.35 / RH)); WALLS[2].tex.needsUpdate = true; }
  doorPivot = new THREE.Group(); doorPivot.position.set(DOOR.x - DOOR.w / 2, 0, -RS + .02); roomGroup.add(doorPivot);
  const dp = new THREE.Mesh(GEO.box(DOOR.w, DOOR.h, .05), stdMat(0xf3f3ef, .95)); dp.position.set(DOOR.w / 2, DOOR.h / 2, 0); dp.castShadow = true; doorPivot.add(dp); doorPivot.visible = false;
  outsideLight = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w, DOOR.h), new THREE.MeshBasicMaterial({ color: 0xd9dccf })); outsideLight.position.set(DOOR.x, DOOR.h / 2, -RS + .005); outsideLight.visible = false; roomGroup.add(outsideLight);
  tray = new THREE.Group();
  { const t = new THREE.Mesh(GEO.box(.4, .03, .28), stdMat(0x9a9a94)); t.position.y = .015; tray.add(t);
    const bread = new THREE.Mesh(GEO.box(.14, .06, .09), stdMat(0xc89b5e)); bread.position.set(-.08, .06, 0); tray.add(bread);
    const cup = new THREE.Mesh(GEO.cyl(.04, .035, .1, 12), stdMat(0xdadad5)); cup.position.set(.1, .08, 0); tray.add(cup);
    tray.position.set(0, 0, RS - .3); tray.visible = false; roomGroup.add(tray); tray.traverse(o => o.castShadow = true); }
  // furniture
  if (C.furnish !== 'bare') {
    const bed = new THREE.Group();
    const frame = new THREE.Mesh(GEO.box(.95, .28, 2.0), stdMat(0xb9bbb8, .6)); frame.position.y = .14; bed.add(frame);
    const mat = new THREE.Mesh(GEO.box(.88, .16, 1.9), stdMat(0xf4f4f1, .95)); mat.position.y = .36; bed.add(mat);
    const pillow = new THREE.Mesh(GEO.box(.6, .1, .32), stdMat(0xfafaf8, .95)); pillow.position.set(0, .48, -.75); bed.add(pillow);
    bed.position.set(-RS + .55, 0, -RS + 1.15); bed.traverse(o => { o.castShadow = o.receiveShadow = true; }); roomGroup.add(bed);
    FURN.bed = pt(-RS + .55, -RS + 1.15, 0);
    const toilet = new THREE.Group();
    const bowl = new THREE.Mesh(GEO.cyl(.2, .16, .4, 14), stdMat(0xc9ccce, .25)); bowl.position.y = .2; toilet.add(bowl);
    const tank = new THREE.Mesh(GEO.box(.38, .3, .15), stdMat(0xc9ccce, .25)); tank.position.set(0, .45, -.2); toilet.add(tank);
    toilet.position.set(RS - .4, 0, -RS + .45 + (RS < 2.5 ? .3 : 0)); toilet.rotation.y = -Math.PI / 2; roomGroup.add(toilet); toilet.traverse(o => o.castShadow = true);
    FURN.toilet = pt(RS - .95, toilet.position.z, -Math.PI / 2);
  }
  if (C.furnish === 'books') {
    const shelf = new THREE.Group();
    const sb = new THREE.Mesh(GEO.box(.3, 1.6, 1.2), stdMat(0xd8d2c4, .8)); sb.position.y = .8; shelf.add(sb);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(GEO.box(.2, .26, .1), stdMat(pick([0x8a3b2c, 0x2b5a7a, 0x5d6f3a, 0xa8692a, 0x3d3d55]))); b.position.set(-.04, .45 + r * .45, -.45 + k * .15); shelf.add(b); }
    shelf.position.set(-RS + .2, 0, RS - 1.5); roomGroup.add(shelf); shelf.traverse(o => o.castShadow = true);
    FURN.books = pt(-RS + .85, RS - 1.5, Math.PI / 2);
  }
  CORNERS = [pt(RS - .55, -RS + .55 + (FURN.toilet ? 1 : 0), -Math.PI * .25), pt(-RS + .55, RS - .55 - (FURN.books ? 1.6 : 0), Math.PI * .75)];
  if (!FURN.bed) CORNERS.push(pt(-RS + .55, -RS + .55, Math.PI * .25));
  buildMind();
  buildHallLayers();
}
function drawDoorSeam(alpha) {
  const g = WALLS[0].g, [x0, y0] = wallPx(wallUV(0, DOOR.x - DOOR.w / 2, 0), DOOR.h), [x1] = wallPx(wallUV(0, DOOR.x + DOOR.w / 2, 0), 0);
  g.strokeStyle = `rgba(60,60,58,${alpha})`; g.lineWidth = 1.4; g.strokeRect(x0, y0, x1 - x0, 512 - y0 - 1); WALLS[0].tex.needsUpdate = true;
}
