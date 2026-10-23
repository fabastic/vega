// =====================================================================
// AFTER: the dead country, and whatever he makes of it
// =====================================================================
const A = {
  pos: new THREE.Vector3(), yaw: 0, yawT: null, beh: null, base: new THREE.Vector3(), directive: 'free', ended: false,
  inv: { food: 0, cans: 0, meat: 0, wood: 0, stone: 0, seeds: 0, books: 0, medicine: 0, specimens: 0, hides: 0 }, weapon: null, barricade: 0, sleepIndoors: false, backpack: false, lostAt: -1e9, revengeAt: -1e9,
  tools: false, coat: false, sickLeft: 0, sick: 0, buried: 0, found: 0, searches: 0, kills: 0, fish: 0, revived: 0, restored: 0, putDown: 0,
  built: {}, prog: {}, garden: null, pen: 0, research: { done: {}, active: null, progress: 0 }, carrying: null, ghostTown: 0, lastSeason: '', bubble: null, yearSaid: false, met: 0, journal: 0,
};
const COMPANIONS = [], ANIMALS = [], GRAVES = [], STRUCTS = [];
const aloneDays = () => (sim.hours - sim.aloneStart) / 24;
const harm = () => ({ forgiving: .5, realistic: 1, brutal: 1.6 }[cfg.after.difficulty] || 1);   // scales everything that hurts him outside
const nearestVillage = p => villDist(p.x, p.z)[1];

// ---------- research ----------
const RESEARCH = [
  { id: 'tools', name: 'Tools and weapons', books: 1, spec: 0, hours: 18, need: [], desc: 'A spear, an axe, a fishing line. Hunting, chopping and fishing all get easier.' },
  { id: 'agri', name: 'Agriculture', books: 2, spec: 0, hours: 40, need: ['tools'], desc: 'Seed saving and crop rotation. Gardens yield twice as much.' },
  { id: 'husbandry', name: 'Animal husbandry', books: 1, spec: 2, hours: 30, need: ['tools'], desc: 'He can pen chickens he catches. Eggs every day.' },
  { id: 'medicine', name: 'Medicine', books: 3, spec: 2, hours: 70, need: ['agri'], desc: 'Fever remedies from the library\'s herbals. He can study the dead to learn what killed them.' },
  { id: 'power', name: 'Power', books: 3, spec: 0, hours: 90, need: ['tools'], desc: 'Restart the facility\'s generator. The lab works again and research runs twice as fast.' },
  { id: 'biology', name: 'Biology', books: 4, spec: 6, hours: 140, need: ['medicine', 'power'], desc: 'How cells live and die. The first step toward undoing death.' },
  { id: 'reanimation', name: 'Reanimation', books: 2, spec: 8, hours: 180, need: ['biology'], revival: 'zombie', desc: 'Restart a body. What comes back is not quite the person.' },
  { id: 'regeneration', name: 'Regeneration', books: 5, spec: 15, hours: 420, need: ['reanimation'], revival: 'full', desc: 'Rebuild what decay took. Bring someone back as themselves.' },
];
const researchOn = () => cfg.after.research !== 'off';
const resAllowed = n => !n.revival || (n.revival === 'zombie' ? cfg.after.revival !== 'off' : cfg.after.revival === 'full');
function nextResearch() {
  if (!researchOn()) return null;
  return RESEARCH.find(n => !A.research.done[n.id] && resAllowed(n) && n.need.every(x => A.research.done[x])) || null;
}
const researchRate = () => ({ slow: .5, normal: 1, fast: 3 }[cfg.after.research] || 1) * (.5 + vegaC.p.curiosity * .5 + (vegaC.occupation === 'scholar' ? .5 : 0)) * (A.research.done.power ? 2 : A.built.workbench ? 1 : .5) * (.4 + S.grip * .6);

// ---------- structures he can build near home ----------
const STRUCT = {
  campfire: { wood: 3, stone: 2, hours: 2, label: 'Campfire', off: [2.6, 2.4] },
  shelter: { wood: 8, stone: 2, hours: 8, label: 'Repaired roof' },
  garden: { wood: 2, seeds: 1, hours: 5, label: 'Garden', off: [-4.5, 3.5] },
  workbench: { wood: 6, stone: 2, hours: 6, label: 'Workbench', off: [3.8, -1.8] },
  smokehouse: { wood: 6, stone: 4, hours: 8, label: 'Smokehouse', off: [5.5, 4.5] },
  pen: { wood: 10, hours: 10, label: 'Chicken pen', off: [-6, -3.5], need: 'husbandry' },
  fence: { wood: 14, hours: 12, label: 'Palisade', need: 'tools' },
  memorial: { stone: 6, hours: 6, label: 'Memorial stone', off: [0, 7] },
};
function nextBuild() {
  const order = ['campfire', 'shelter', 'garden', 'workbench', 'smokehouse', 'pen', 'fence', 'memorial'];
  for (const k of order) {
    if (A.built[k]) continue;
    const s = STRUCT[k];
    if (s.need && !A.research.done[s.need]) continue;
    if (k === 'garden' && A.inv.seeds < 1) continue;
    if (k === 'workbench' && !researchOn()) continue;
    if (k === 'smokehouse' && A.kills < 2) continue;
    if (k === 'fence' && !cfg.after.wolves) continue;
    if (k === 'memorial' && A.buried < 4) continue;
    return k;
  }
  return null;
}
const lacks = k => { const s = STRUCT[k]; return { wood: Math.max(0, (s.wood || 0) - A.inv.wood), stone: Math.max(0, (s.stone || 0) - A.inv.stone), seeds: Math.max(0, (s.seeds || 0) - A.inv.seeds) }; };
function structPos(k) { const s = STRUCT[k]; if (!s.off) return A.base.clone(); return P(A.base.x + s.off[0], A.base.z + s.off[1]); }
function placeStructure(k) {
  const p = structPos(k), g = new THREE.Group();
  const wood = stdMat(0x6b4f35, .9), stone = stdMat(0x8a8780, .95);
  if (k === 'campfire') {
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(GEO.sph(.16, 6, 5), stone); const a = i / 8 * TAU; s.position.set(Math.cos(a) * .55, .08, Math.sin(a) * .55); g.add(s); }
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(GEO.cyl(.06, .06, .8, 6), wood); l.rotation.z = Math.PI / 2; l.rotation.y = i * .8; l.position.y = .12; g.add(l); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.28, .7, 7), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .85 })); flame.position.y = .45; g.add(flame); A.flame = flame;
    A.fireLight = new THREE.PointLight(0xff9a50, 0, 14, 2); A.fireLight.position.set(p.x, p.y + 1, p.z); scene.add(A.fireLight);
  } else if (k === 'shelter') {
    const rec = vegaC.home.rec; rec.repaired = true; rec.roof.rotation.set(0, 0, 0); rec.roof.position.y = rec.roofY; rec.walls.scale.y = 1; rec.collapse = false; rec.tx = rec.tz = 0; rec.roofMat.color.set(0x7a6a5e); rec.wallMat.color.copy(rec.wallBase).lerp(new THREE.Color(0x8a7a60), .25); rec.door.rotation.y = 0;
    for (const gl of rec.glass) { gl.boarded = true; gl.boards.visible = true; gl.gl.visible = false; gl.hole.visible = true; }
  } else if (k === 'garden') {
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), stdMat(0x4e3d2a, 1)); soil.rotation.x = -Math.PI / 2; soil.position.y = .03; g.add(soil);
    const crops = new THREE.Mesh(GEO.box(3, .5, 2), stdMat(0x6f8f3a)); crops.position.y = .25; crops.name = 'crops'; crops.scale.y = .02; g.add(crops); A.cropMesh = crops;
    for (const [x, z] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) { const post = new THREE.Mesh(GEO.box(.08, .7, .08), wood); post.position.set(x, .35, z); g.add(post); }
  } else if (k === 'workbench') {
    const top = new THREE.Mesh(GEO.box(1.8, .1, .8), wood); top.position.y = .9; g.add(top);
    for (const [x, z] of [[-.8, -.3], [.8, -.3], [-.8, .3], [.8, .3]]) { const l = new THREE.Mesh(GEO.box(.08, .9, .08), wood); l.position.set(x, .45, z); g.add(l); }
    for (let i = 0; i < 3; i++) { const bk = new THREE.Mesh(GEO.box(.25, .06, .18), stdMat(pick([0x8a3b2c, 0x2b5a7a, 0x5d6f3a]))); bk.position.set(-.5 + i * .3, .98, 0); g.add(bk); }
  } else if (k === 'smokehouse') {
    const b = new THREE.Mesh(GEO.box(1.6, 1.8, 1.4), wood); b.position.y = .9; g.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(1.2, .7, 4), stone); r.position.y = 2.15; r.rotation.y = Math.PI / 4; g.add(r);
  } else if (k === 'pen') {
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, post = new THREE.Mesh(GEO.box(.08, .8, .08), wood); post.position.set(Math.cos(a) * 1.8, .4, Math.sin(a) * 1.8); g.add(post); }
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.8, .03, 4, 24), wood); rail.rotation.x = Math.PI / 2; rail.position.y = .6; g.add(rail);
  } else if (k === 'fence') {
    for (let i = 0; i < 46; i++) { const a = i / 46 * TAU, x = A.base.x + Math.cos(a) * 11, z = A.base.z + Math.sin(a) * 11; if (Math.abs(angDiff(a, Math.atan2(VILL[vegaC.homeVillage].z - A.base.z, VILL[vegaC.homeVillage].x - A.base.x))) < .25) continue; const s = new THREE.Mesh(GEO.cyl(.12, .14, 2 + rnd(0, .4), 6), wood); s.position.set(x - p.x, heightAt(x, z) - p.y + 1, z - p.z); g.add(s); }
  } else if (k === 'memorial') {
    const st = new THREE.Mesh(GEO.box(.8, 1.6, .3), stone); st.position.y = .8; g.add(st);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.copy(p); scene.add(g); STRUCTS.push({ k, g });
}
