
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

// ---------- animals ----------
function spawnAnimals() {
  const mult = { none: 0, few: .5, normal: 1, many: 2 }[cfg.after.animals];
  const add = (type, n, near) => { for (let i = 0; i < Math.round(n * mult); i++) {
    let x, z, home;
    if (near) { const v = pick(VILL); home = P(v.x + rnd(-14, 14), v.z + rnd(-14, 14)); }
    else { const t = TREES.length ? pick(TREES) : { x: rnd(-150, 150), z: rnd(-150, 150) }; home = P(t.x + rnd(-10, 10), t.z + rnd(-10, 10)); }
    x = home.x; z = home.z;
    const a = makeAnimal(type); a.pos = P(x, z); a.home = home; a.yaw = rnd(0, TAU); a.state = 'graze'; a.t = 0; a.alive = true; a.target = null; a.hpCooldown = 0;
    a.root.position.copy(a.pos); scene.add(a.root); ANIMALS.push(a);
  } };
  add('deer', 16); add('rabbit', 22); add('boar', 7); add('chicken', 3 * VILL.length, true);
  if (cfg.after.wolves) add('wolf', 5);
}
function animalStep(dtH, dtR) {
  const vegaOut = sim.phase === 'after' && !A.ended;
  const night = (sim.hours % 24) < 6 || (sim.hours % 24) > 20;
  for (const a of ANIMALS) {
    if (!a.alive) { a.respawn -= dtH; if (a.respawn <= 0) { a.alive = true; a.root.visible = true; a.pos.copy(a.home); a.state = 'graze'; } continue; }
    const s = a.s;
    const dV = vegaOut ? a.pos.distanceTo(A.pos) : 1e9;
    const fire = A.built.campfire && a.pos.distanceTo(structPos('campfire')) < 9 && night;
    if (s.predator) {
      const hungry = vegaOut && ((night && (WORLD.season === 'winter' || S.health < .5)) || a.aggro || (a.type === 'dog' && night));
      if (hungry && dV < 40 && !fire && !(A.built.fence && A.pos.distanceTo(A.base) < 10)) { a.state = 'stalk'; a.target = A.pos.clone(); }
      else if (a.state === 'stalk') a.state = 'graze';
      if (fire) { a.state = 'flee'; a.target = a.pos.clone().add(a.pos.clone().sub(A.pos).setY(0).normalize().multiplyScalar(30)); }
      if (a.state === 'stalk' && dV < 1.6) { a.hpCooldown -= dtH; if (a.hpCooldown <= 0) { a.hpCooldown = 1; wolfAttack(a); } }
    } else if (s.flee && dV < s.flee * (A.beh && A.beh.kind === 'hunt' ? 1.4 : 1) && a.state !== 'flee') {
      a.state = 'flee'; a.t = 0; a.target = onGround(a.pos.clone().add(a.pos.clone().sub(A.pos).setY(0).normalize().multiplyScalar(s.flee * 2)));
    }
    a.t += dtH;
    if (a.state === 'graze' || !a.target) { if (!a.target || a.t > rnd(.5, 3)) { a.t = 0; a.target = P(a.home.x + rnd(-25, 25) * (s.biped ? .4 : 1), a.home.z + rnd(-25, 25) * (s.biped ? .4 : 1)); a.state = R() < .5 ? 'graze' : 'wander'; } }
    if (a.state === 'flee' && a.t > .6) { a.state = 'wander'; a.t = 0; }
    const moving = a.state !== 'graze';
    const sp = s.speed * (a.state === 'flee' || a.state === 'stalk' ? 1.6 : .35);
    let gait = 0;
    if (moving && a.target) {
      const d = a.target.clone().sub(a.pos); d.y = 0; const dist = d.length();
      if (dist > .3) { const step = Math.min(dist, sp * dtH); d.normalize(); a.pos.addScaledVector(d, step); onGround(a.pos); if (a.pos.y < LAKE.level) { a.pos.sub(d.multiplyScalar(step)); a.target = null; } a.yaw += angDiff(a.yaw, Math.atan2(d.x, d.z)) * Math.min(1, (dtR || .05) * 6); gait = a.state === 'flee' || a.state === 'stalk' ? 2 : .7; }
      else if (a.state !== 'stalk') a.state = 'graze';
    }
    a.gait = gait;
  }
}
function renderAnimals(dtR) {
  for (const a of ANIMALS) {
    if (!a.alive) continue;
    const near = camera.position.distanceTo(a.pos) < 160;
    a.root.visible = near;
    if (!near) continue;
    a.root.position.copy(a.pos); a.root.rotation.y = a.yaw;
    animateAnimal(a, a.gait || 0, dtR, a.state === 'graze');
    if (sim.phase === 'after' && a.pos.distanceTo(A.pos) < 18 && camMode !== 'map') tag('an' + ANIMALS.indexOf(a), a.type, new THREE.Vector3(a.pos.x, a.pos.y + a.s.leg + a.s.h + .5, a.pos.z), 'tag animal');
  }
}
function killAnimal(a) {
  a.alive = false; a.root.visible = false; a.respawn = 24 * rnd(8, 16);
  if (a.type === 'chicken' && A.built.pen && A.research.done.husbandry) { A.pen++; say('Caught a hen alive. Into the pen.', 'ev'); return; }
  A.inv.meat += a.s.meat; A.inv.hides += a.s.hide; A.inv.specimens += 1; A.kills++;
  if (!A.coat && A.inv.hides >= 3) { A.coat = true; A.inv.hides -= 3; say('Stitched the hides into a coat. Ugly. Warm.', 'ev'); S.pride = clamp(S.pride + .2); }
}
function wolfAttack(a) {
  const armed = A.research.done.tools || A.weapon; dayNote('attacks'); A.lastHurt = sim.hours; A.hurtBy = a;
  if (a.type === 'bear') { S.health = clamp(S.health - .12 * harm()); S.pain = clamp(S.pain + .4); }
  S.health = clamp(S.health - .05 * harm()); S.pain = clamp(S.pain + .25); S.fear = clamp(S.fear + .4); S.dread = clamp(S.dread + .3);
  A.bubble = { text: 'GET BACK!', cls: 'bub shout', until: performance.now() + 2000 };
  const nm = { wolf: 'wolf', dog: 'dog', bear: 'bear' }[a.type] || 'animal';
  if (R() < (armed ? .45 : .15) * (a.type === 'bear' ? .4 : 1)) { killAnimal(a); A.revengeAt = sim.hours; say(armed ? `The ${nm} came at me. I put the spear through it.` : `I killed the ${nm} with a rock. My hands won't stop shaking.`, 'bad'); }
  else say(a.type === 'bear' ? 'A bear. It knocked me down like I was nothing.' : a.type === 'dog' ? 'Dogs. Somebody\'s dogs, gone wild. They bit and ran.' : 'Wolves. One got my arm before it ran.', 'bad');
}

// ---------- remains and graves ----------
function makeRemains(c) {
  if (c.remains || c.buried) return;
  const g = new THREE.Group(), bone = stdMat(0xd6cfbd, .8);
  const skull = new THREE.Mesh(GEO.sph(.1), bone); skull.position.set(0, .09, .55); skull.scale.set(1, .85, 1.1); g.add(skull);
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(GEO.box(.32 - i * .03, .02, .03), bone); r.position.set(0, .03, .25 - i * .08); g.add(r); }
  for (const s of [-1, 1]) { const l = new THREE.Mesh(GEO.cyl(.022, .02, .8), bone); l.rotation.x = Math.PI / 2; l.position.set(s * .1, .025, -.35); g.add(l);
    const a = new THREE.Mesh(GEO.cyl(.018, .016, .55), bone); a.rotation.x = Math.PI / 2; a.position.set(s * .26, .02, .15); a.rotation.y = s * .3; g.add(a); }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(.55, .5), new THREE.MeshStandardMaterial({ color: new THREE.Color(c.shirt).lerp(new THREE.Color(0x4a4438), .45), roughness: 1, side: THREE.DoubleSide }));
  cloth.rotation.x = -Math.PI / 2; cloth.rotation.z = rnd(-.5, .5); cloth.position.set(0, .015, .15); g.add(cloth);
  g.position.copy(c.deathPos); g.rotation.y = rnd(0, TAU);
  g.traverse(o => { o.castShadow = true; }); scene.add(g); c.remains = g;
}
function makeGrave(c) {
  const g = new THREE.Group();
  const mound = new THREE.Mesh(GEO.sph(.6), stdMat(0x5b4a35, 1)); mound.scale.set(.75, .22, 1.3); g.add(mound);
  const stone = new THREE.Mesh(GEO.box(.42, .55, .1), stdMat(0x8e8c84)); stone.position.set(0, .28, -.85); g.add(stone);
  c.gravePos = graveSlot(nearestVillage(c.deathPos));
  g.position.copy(c.gravePos); g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
  scene.add(g); c.grave = g; GRAVES.push(c);
}

// ---------- companions: survivors, the revived, the restored ----------
function addCompanion(c, kind) {
  let h = c.h;
  if (kind !== 'survivor') {
    if (c.h.root.parent) c.h.root.parent.remove(c.h.root);
    h = makeHuman(Object.assign({}, c.look, kind === 'zombie' ? { zombie: true, shirt: new THREE.Color(c.shirt).lerp(new THREE.Color(0x3d3a33), .5).getHex() } : {}));
    h.root.traverse(o => { o.userData.cit = c; });
    c.h = h;
  }
  scene.add(h.root); h.root.visible = true;
  const z = { c, kind, h, pos: (kind === 'survivor' ? c.pos.clone() : labPos().add(new THREE.Vector3(1.5, 0, 1.5))), yaw: 0, act: null, attacks: 0, unstable: kind === 'zombie' && cfg.after.zombies === 'unstable', nextLine: rnd(2, 8) };
  onGround(z.pos);
  c.companion = true; c.alive = kind !== 'zombie' ? true : c.alive;
  COMPANIONS.push(z);
  return z;
}
const labPos = () => A.research.done.power ? FAC.door.clone() : (A.built.workbench ? structPos('workbench') : A.base.clone());
function meet(c) {
  c.met = true; A.met++;
  const z = addCompanion(c, 'survivor');
  const aff = vegaC.rel.get(c) || 0;
  S.loneliness = clamp(S.loneliness - .55); S.hope = clamp(S.hope + .45); S.grip = clamp(S.grip + .06); S.love = clamp(S.love + aff * .5);
  A.bubble = { text: `${c.name.toUpperCase()}!`, cls: 'bub shout', until: performance.now() + 3200 };
  say(aff > .3 ? `${c.name}. ${c.name} is alive. I can't stop holding on.` : `Someone. A person. ${c.name}, from ${VILL[c.homeVillage].name}. Alive.`, 'ev');
  setTimeout(() => say(`${c.name} told me how it went. The fever, then the hunger. They hid in ${VILL[c.village].name}.`, 'ev'), 1200);
  S.grief = clamp(S.grief + .1); S.guilt = clamp(S.guilt + .1);
}
const ZLINES = ['...Ve...ga...', 'cold...', 'the well...', 'home...', 'hungry...', '...it hurts...', 'where... is everyone...'];
const RLINES = ['I remember dying. I remember the fever.', 'How long was I gone?', 'You brought me back. Why me?', 'Everything is too bright.', 'Thank you. I think.'];
const SLINES = () => [`We should plant before the frost.`, `I keep counting the houses. Nobody in them.`, `${vegaC.name}, eat something.`, `Do you think anyone made it to the coast?`, `I'll take the night watch.`];
function companionStep(dtH) {
  const night = (sim.hours % 24) < 6 || (sim.hours % 24) > 21;
  for (const z of COMPANIONS) {
    z.nextLine -= dtH;
    const d = z.pos.distanceTo(A.pos);
    if (childOf(z)) {   // a child keeps close to its parents and plays
      const near = (partnerOf() && R() < .5 ? partnerOf().pos : A.pos).clone().add(new THREE.Vector3(Math.sin(sim.hours * .7) * 2, 0, Math.cos(sim.hours * .5) * 2));
      const dd = near.sub(z.pos).setY(0), dist = dd.length(); z.moving = dist > 1; if (z.moving) { dd.normalize(); z.pos.addScaledVector(dd, Math.min(dist, WALK * .8 * dtH)); onGround(z.pos); z.yaw = Math.atan2(dd.x, dd.z); }
      if (z.nextLine <= 0 && d < 10) { z.nextLine = rnd(3, 9); z.line = { text: pick(z.age < 20 ? ['...', 'Ba!', 'Da-da'] : ['Look!', 'Can we go to the lake?', 'Tell me about the market', 'Why is nobody else here?']), until: performance.now() + 2400 }; }
      continue;
    }
    if (z.partner && A.beh && A.beh.kind === 'intimate') { z.act = { kind: 'sleep', target: A.beh.target.clone().add(new THREE.Vector3(.55, 0, 0)), t: 0, dur: 8, arrived: false }; }
    if (z.kind === 'zombie') {
      const want = A.pos.clone().add(new THREE.Vector3(Math.sin(z.c.i) * 5, 0, Math.cos(z.c.i) * 5));
      if (!night && z.pos.distanceTo(want) > 2.5) { const dd = want.sub(z.pos).setY(0); const step = Math.min(dd.length(), WALK * .45 * dtH); dd.normalize(); z.pos.addScaledVector(dd, step); onGround(z.pos); z.moving = true; z.yaw = Math.atan2(dd.x, dd.z); } else z.moving = false;
      if (z.unstable && d < 1.8 && R() < dtH * .08) {
        z.attacks++; S.health = clamp(S.health - .05 * harm()); S.pain = clamp(S.pain + .25); S.fear = clamp(S.fear + .3); S.dread = clamp(S.dread + .2);
        A.bubble = { text: `${z.c.name.toUpperCase()}, STOP!`, cls: 'bub shout', until: performance.now() + 2200 };
        say(`${z.c.name} bit me. There was nothing in the eyes. Nothing at all.`, 'bad');
      }
      if (z.nextLine <= 0 && d < 12) { z.nextLine = rnd(3, 10); z.line = { text: pick(ZLINES), until: performance.now() + 2600 }; }
      S.loneliness = clamp(S.loneliness - (d < 12 ? .004 : 0) * dtH); S.dread = clamp(S.dread + .002 * dtH); S.guilt = clamp(S.guilt + .0015 * dtH);
      continue;
    }
    // survivors and the restored keep their own routine near home and help out
    if (!z.act || z.act.t >= z.act.dur) {
      const jobs = night ? ['sleep'] : ['forage', 'chop', 'farm', 'sit', 'talk', 'fish'];
      const k = pick(jobs);
      const tgt = k === 'sleep' ? A.base.clone().add(new THREE.Vector3(rnd(-3, 3), 0, rnd(-3, 3))) : k === 'talk' ? A.pos.clone().add(new THREE.Vector3(1.4, 0, .6)) : k === 'forage' ? nearPlace(nearestVillage(A.base), 'fields') : k === 'fish' && LAKE ? P(LAKE.x + LAKE.r + 2, LAKE.z) : A.base.clone().add(new THREE.Vector3(rnd(-8, 8), 0, rnd(-8, 8)));
      z.act = { kind: k, target: onGround(tgt), t: 0, dur: k === 'sleep' ? 8 : rnd(1, 3), arrived: false };
    }
    const a = z.act, dd = a.target.clone().sub(z.pos).setY(0), dist = dd.length();
    if (!a.arrived) { if (dist > .3) { const step = Math.min(dist, WALK * .9 * dtH); dd.normalize(); z.pos.addScaledVector(dd, step); onGround(z.pos); z.yaw = Math.atan2(dd.x, dd.z); z.moving = true; } else { a.arrived = true; z.moving = false; } }
    else {
      a.t += dtH; z.moving = false;
      if (a.kind === 'forage') A.inv.food += .05 * dtH * (WORLD.season === 'winter' ? .3 : 1);
      if (a.kind === 'fish' && A.research.done.tools) A.inv.meat += .04 * dtH;
      if (a.kind === 'chop') A.inv.wood += .15 * dtH;
      if (a.kind === 'farm' && A.garden) A.garden.growth = Math.min(1, A.garden.growth + dtH / (24 * 40));
    }
    if (d < 10) { S.loneliness = clamp(S.loneliness - .02 * dtH); S.grip = clamp(S.grip + .0005 * dtH); S.hope = clamp(S.hope + .0015 * dtH); }
    if (z.nextLine <= 0 && d < 12) { z.nextLine = rnd(4, 12); z.line = { text: pick(z.kind === 'restored' ? RLINES : SLINES()), until: performance.now() + 3000 }; }
  }
}
function renderCompanions(dtR, now) {
  for (const z of COMPANIONS) {
    const h = z.h; h.root.position.copy(z.pos); h.root.rotation.y = z.yaw;
    let k = z.kind === 'zombie' ? (z.moving ? 'shamble' : 'stare') : childOf(z) ? (z.moving ? 'run' : pick(['jump', 'stand', 'sit_hug'])) : z.moving ? 'walk' : ({ forage: 'forage', chop: 'chop', farm: 'dig', sit: 'sit_wall', talk: 'talk', sleep: 'lie', fish: 'fish' }[z.act && z.act.kind] || 'stand');
    if (childOf(z) && !z.moving) { z.idleK = z.idleK && Math.random() > .01 ? z.idleK : k; k = z.idleK; }
    if (dtR && z.pos.distanceTo(camera.position) < 25) { setFace(h, { smile: z.kind === 'zombie' ? -.4 : .3 + (z.partner ? .3 : 0), open: z.kind === 'zombie' ? .4 : 0, shut: z.act && z.act.kind === 'sleep' && z.act.arrived ? 1 : 0, blush: z.partner && z.pos.distanceTo(A.pos) < 4 ? .5 : 0 }, dtR); lookAtPoint(h, z.pos.distanceTo(A.pos) < 8 ? _lookP.set(A.pos.x, A.pos.y + 1.55, A.pos.z) : null, dtR, 1); }
    if (z.moving) h.phase += dtR * (z.kind === 'zombie' ? 3 : 6); else h.phase += dtR * 2;
    applyPose(h, pose(k, h.phase, { slump: z.kind === 'zombie' ? .5 : 0, tremor: z.kind === 'zombie' ? .03 : 0, amp: z.kind === 'zombie' ? .5 : 1 }), 1 - Math.exp(-dtR * 8));
    if (camMode !== 'map') tag('cp' + z.c.i, z.c.name + (z.partner ? ' ♥' : ''), new THREE.Vector3(z.pos.x, z.pos.y + (childOf(z) ? 1.5 : 2.15), z.pos.z), z.kind === 'zombie' ? 'tag zombie' : 'tag comp');
    if (z.line && now < z.line.until) tag('cpl' + z.c.i, z.line.text, new THREE.Vector3(z.pos.x, z.pos.y + 2.6, z.pos.z), z.kind === 'zombie' ? 'bub zombie' : 'bub');
  }
}

// ---------- his choices ----------
const DIRECTIVES = {
  free: { label: 'Free will' },
  survive: { label: 'Survive', m: { drink: 1.3, eat: 1.3, cook: 1.5, forage: 1.5, berries: 1.5, hunt: 1.4, fish: 1.4, farm: 1.4, plant: 1.4, harvest: 1.4, build: 1.2, warm: 1.4, research: .3, explore: .5, revive: .2, collect: .2 } },
  explore: { label: 'Explore', m: { explore: 3.2, scavenge: 1.8, search: 2 } },
  hunt: { label: 'Hunt & fish', m: { hunt: 3, fish: 2.4, cook: 1.6 } },
  farm: { label: 'Farm', m: { plant: 3, harvest: 3, tend: 3, build: 1.4, berries: 1.4 } },
  build: { label: 'Build', m: { build: 3.2, chop: 2.2, quarry: 2.2 } },
  research: { label: 'Research', m: { research: 3.4, scavenge: 1.4, hunt: 1.3, study: 1.6 } },
  mourn: { label: 'Mourn', m: { bury: 3, grave: 2.6, journal: 1.6 } },
  revive: { label: 'Bring them back', m: { revive: 4, collect: 4, regenerate: 4, research: 2.8, study: 2.2, hunt: 1.3 } },
};
const ALINES = {
  arrive: () => ['Where is everyone?', `The grass is up to my knees in the ${homeName()} plaza.`, 'No smoke from any chimney.', 'Hello? HELLO?'],
  drink: ['The well still works. At least the well.', 'Cold water. The only thing that hasn\'t changed.'],
  eat: ['Eating alone on the market steps.', 'I eat slowly. There is nobody to save it for, but I do.'],
  cook: ['Meat over the fire. The smell is the first good thing in months.', 'I cook enough for two out of habit.'],
  forage: () => WORLD.season === 'winter' ? ['Frozen ground. Nothing.', 'Roots and bark.'] : ['The fields went wild. Some of it is still food.', 'Picking through the rot for anything green.'],
  berries: ['Berries along the forest edge. My hands go red.', 'Sour. Edible. Enough.'],
  scavenge: ['Someone\'s kitchen. I know whose.', 'Tins in the back of a cupboard. I say sorry out loud.', 'Their cups are still on the table.'],
  hunt: () => A.research.done.tools ? ['Spear in hand. Downwind. Slow.', 'Tracks by the stream. Fresh.'] : ['Trying to catch something with my bare hands. Ridiculous.', 'If I am quick enough.'],
  fish: ['Line in the lake. Waiting is something I am good at now.', 'The lake doesn\'t know anything happened.'],
  chop: ['The axe finds its rhythm.', 'Wood for the winter. There is always a winter.'],
  quarry: ['Stones from the hillside, one at a time.'],
  build: () => [`Building the ${STRUCT[A.beh.extra.k].label.toLowerCase()}. Something that will still be here tomorrow.`, 'My hands remember the workshop.'],
  plant: ['Seeds from the market sacks. Maybe something will grow.', 'A garden. Something to keep alive.'],
  harvest: ['It grew. Something I did, worked.', 'Food from my own ground.'],
  tend: ['Weeding. Watering. Talking to the plants.'],
  research: () => A.research.active ? [`Working on ${A.research.active.name.toLowerCase()}. The books are full of other people's handwriting.`, 'Notes on notes. The answer is in here somewhere.'] : ['Reading.'],
  study: () => [`I studied what the fever did to ${A.beh.extra.c ? A.beh.extra.c.name : 'them'}. I said their name the whole time.`, 'Samples, labelled. I have to know.'],
  collect: () => [`I dug up ${A.beh.extra.c.name}. I told them I'm sorry. I told them it's for them.`],
  revive: () => [`The procedure for ${A.beh.extra.c.name}. Twelve hours. I don't breathe for most of it.`],
  regenerate: () => [`Rebuilding ${A.beh.extra.z.c.name} cell by cell. They'll be themselves this time.`],
  bury: () => ['Digging is slow. I don\'t want it to be fast.', 'Someone should say something. I say their name.'],
  grave: () => { const g = pick(GRAVES); return g ? [`Sat with ${g.name} for a while.`, `Told ${g.name} about the chamber.`] : ['Nothing to visit.']; },
  explore: () => ['The road to the next village. Maybe there, maybe someone.', 'I walk until the houses change.'],
  search: () => A.searches < 4 ? ['I walk to the edge and call. I keep calling.'] : ['There is no one. I know there is no one. I go anyway.'],
  sleep: () => S.grip < .5 ? ['I sleep with the door open now. Always open.'] : ['My own bed. It smells of dust.', 'I lie awake listening for anyone.'],
  warm: ['Hands to the fire. Toes to the fire.', 'The fire talks. I let it.'],
  wash: ['Washed in the lake. I look like a stranger in the water.', 'Clean. It matters.'],
  talk: () => COMPANIONS.length ? [`Talking with ${pick(COMPANIONS).c.name} until it got dark.`] : [],
  ghost: () => A.ghostC ? [`${A.ghostC.name} is at the well again.`, `${A.ghostC.name} asked where I've been.`, `I told ${A.ghostC.name} I'm sorry I wasn't here.`] : [],
  sit: () => ['The plaza is so quiet I can hear the weeds.', `${cfg.time.chamberDays} days. And this is what was waiting.`, 'Sometimes I wish they had left me in there.'],
  wander: ['Walking the streets. Saying the names of who lived where.', 'The workshop door is hanging off. I close it.'],
  journal: ['Writing it all down. If anyone ever comes, they should know.', 'A page a day. It keeps the days apart.'],
  medicine: ['Fever tea from the herbal. It tastes like the library smells.'],
  put_down: () => [`I had to stop ${A.beh.extra.z.c.name}. I had to. I made them twice and ended them twice.`],
};
const ALABEL = { arrive: 'Walking back into town', drink: 'Drinking', eat: 'Eating', cook: 'Cooking over the fire', forage: 'Foraging in the wild fields', berries: 'Picking berries', scavenge: 'Searching a dead neighbour\'s house', hunt: 'Hunting', fish: 'Fishing', chop: 'Chopping wood', quarry: 'Gathering stone', build: 'Building', plant: 'Planting a garden', harvest: 'Harvesting', tend: 'Tending the garden', research: 'Researching', study: 'Studying the dead', collect: 'Exhuming a friend', revive: 'Trying to bring someone back', regenerate: 'Rebuilding someone', bury: 'Burying someone', grave: 'Sitting by a grave', explore: 'Exploring', search: 'Calling for survivors', sleep: 'Sleeping', warm: 'Warming by the fire', wash: 'Washing', talk: 'Talking with company', ghost: 'Talking to someone who isn\'t there', sit: 'Sitting in the empty plaza', wander: 'Walking the empty streets', journal: 'Writing in his journal', medicine: 'Taking medicine', put_down: 'Putting down what he raised', dead: 'Dead' };
const APOSE = { arrive: 'walk', drink: 'eat_stand', eat: 'eat_sit', cook: 'warm', forage: 'forage', berries: 'forage', scavenge: 'reach_wall', hunt: 'spear', fish: 'fish', chop: 'chop', quarry: 'dig', build: 'build', plant: 'dig', harvest: 'forage', tend: 'dig', research: 'read', study: 'kneel', collect: 'dig', revive: 'hammer', regenerate: 'hammer', bury: 'dig', grave: 'kneel', explore: 'look', search: 'shout', sleep: 'lie', warm: 'warm', wash: 'wash', talk: 'talk', ghost: 'talk', sit: 'sit_hug', wander: 'look', journal: 'read', medicine: 'eat_stand', put_down: 'spear', dead: 'collapsed' };

const nearestWater = p => { let best = null, bd = 1e9; for (const v of (A.wellBad ? [] : VILL)) { const d = v.places.well.pos.distanceTo(p); if (d < bd) { bd = d; best = v.places.well.pos; } } const lk = P(LAKE.x + (p.x - LAKE.x) / Math.max(1, Math.hypot(p.x - LAKE.x, p.z - LAKE.z)) * (LAKE.r + 1.5), LAKE.z + (p.z - LAKE.z) / Math.max(1, Math.hypot(p.x - LAKE.x, p.z - LAKE.z)) * (LAKE.r + 1.5)); if (!best || lk.distanceTo(p) < bd) best = lk; return best.clone(); };
const nearest = (list, p, f = () => true) => { let best = null, bd = 1e9; for (const o of list) { if (!f(o)) continue; const q = o.pos || o.door || o; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = o; } } return best; };

function afterChoose() {
  const p = vegaC.p, D = derived(), hour = sim.hours % 24, night = hour < 6 || hour >= 21, winter = WORLD.season === 'winter', temp = tempAt(sim.hours);
  const unburied = citizens.filter(c => c.found && !c.buried && c.remains && !c.companion);
  const houses = HOUSES.filter(h => !h.searched);
  const bushes = BUSHES.filter(b => b.stock > 0);
  const need = nextBuild(), lack = need ? lacks(need) : null;
  const res = nextResearch(), canRes = res && (A.research.active === res || (A.inv.books >= res.books && A.inv.specimens >= res.spec));
  const unvisited = VILL.filter(v => !v.visited);
  const revivable = cfg.after.revival !== 'off' && A.research.done.reanimation ? citizens.filter(c => !c.isVega && !c.alive && !c.revived && (c.remains || c.grave) && (vegaC.rel.get(c) || 0) > .05) : [];
  const zombies = COMPANIONS.filter(z => z.kind === 'zombie');
  const dangerZ = zombies.find(z => z.attacks >= 2);
  const fire = A.built.campfire;
  const U = {
    drink: Math.pow(S.thirst, 1.4) * 2.4 + (S.thirst > .7 ? 3 : 0),
    eat: A.inv.food >= 1 || A.inv.cans >= 1 || (A.inv.meat >= 1 && (!fire || S.hunger > .75)) ? (Math.pow(S.hunger, 1.4) * 2.6 + (S.hunger > .5 ? 1.5 : 0)) * (S.ptsd > .3 && PTSD.starvedInside && S.hunger < .6 ? .4 : 1) : 0,
    cook: A.inv.meat >= 1 && fire ? .6 + S.hunger * 1.4 + (A.inv.food < 2 ? .7 : 0) : 0,
    forage: Math.pow(S.hunger, 1.2) * 1.4 * (winter ? .15 : .7) + (A.inv.food < 1 && !A.inv.meat ? .3 : 0),
    berries: bushes.length && (WORLD.season === 'summer' || WORLD.season === 'autumn') ? S.hunger * 1.4 + .1 : 0,
    scavenge: houses.length ? S.hunger * .9 + (A.inv.food < 3 ? .5 : 0) + (researchOn() && A.inv.books < 3 ? .5 : 0) + (res && A.inv.books < res.books && houses.some(h => h.stock.books > 0) ? .9 : 0) + (A.inv.seeds < 1 ? .2 : 0) + .1 : 0,
    hunt: ANIMALS.some(a => a.alive && a.s.hunt && !a.s.predator && a.pos.distanceTo(A.pos) < 60) ? ((S.hunger * .8 + (A.inv.food < 3 ? .4 : 0)) * (A.research.done.tools ? 1.3 : .55) * (vegaC.occupation === 'hunter' ? 1.4 : 1) + (res && A.inv.specimens < res.spec ? .4 : 0)) * (A.inv.meat > 6 ? .25 : 1) : 0,
    fish: A.research.done.tools ? S.hunger * .9 + .15 : 0,
    chop: lack && lack.wood > 0 ? .7 + lack.wood * .04 + (need === 'campfire' || need === 'shelter' ? .7 : 0) : (winter && A.inv.wood < 6 ? .5 : 0),
    quarry: lack && lack.stone > 0 ? .65 + lack.stone * .04 + (need === 'campfire' || need === 'shelter' ? .7 : 0) : 0,
    build: need && !lack.wood && !lack.stone && !lack.seeds ? 1.1 + p.conscientiousness * .4 + (need === 'campfire' || need === 'shelter' ? .8 : 0) : 0,
    plant: A.built.garden && !A.garden && A.inv.seeds >= 1 && !winter ? 1.2 : 0,
    harvest: A.garden && A.garden.growth >= 1 ? 1.8 : 0,
    tend: A.garden && A.garden.growth < 1 ? .25 : 0,
    research: canRes ? (.4 + S.curiosity * .5 + p.curiosity * .3 + S.grief * .2) * (A.built.campfire && A.built.shelter ? 1 : .45) : 0,
    study: A.research.done.medicine && unburied.length && res && A.inv.specimens < res.spec ? .3 + S.curiosity * .4 : 0,
    collect: revivable.length && !A.carrying ? .4 + S.grief * .8 + S.love * .6 : 0,
    revive: A.carrying && S.health > .45 ? 1.6 : 0,
    regenerate: cfg.after.revival === 'full' && A.research.done.regeneration && zombies.length && A.inv.specimens >= 3 ? 1 + S.love * .5 : 0,
    put_down: dangerZ ? 3 + S.fear : 0,
    bury: unburied.length ? .45 + S.grief * .5 + p.agreeableness * .3 : 0,
    grave: GRAVES.length ? S.loneliness * .4 + S.grief * .45 : 0,
    explore: unvisited.length ? (.35 + p.curiosity * .4 + p.independence * .3 + (citizens.some(c => c.survivor && c.alive && !c.met) ? .3 : 0)) * (night ? .1 : 1) : 0,
    search: S.hope * .5 * (A.searches < 6 ? 1 : .3) * (night ? .2 : 1),
    sleep: Math.pow(S.sleep, 1.5) * 2 + (night ? .9 : 0) + (S.energy < .15 ? 1 : 0) + (A.sickLeft > 0 ? 1.5 : 0),
    warm: temp < 8 && fire ? (1 - S.warmth) * 2.6 + (S.warmth < .5 ? .6 : 0) : 0,
    wash: (1 - S.hygiene) * .9,
    talk: COMPANIONS.some(z => z.kind !== 'zombie') ? S.loneliness * 1.1 + .1 : 0,
    ghost: S.grip < .5 && ROOM.friends.length && viewMode ? S.loneliness * (1 - S.grip) * 1.4 : 0,
    sit: D.despair * .7,
    wander: S.boredom * .5 + p.curiosity * .15,
    journal: p.conscientiousness * .3 + S.loneliness * .15,
    medicine: A.sickLeft > 0 && (A.inv.medicine > 0 || A.research.done.medicine) ? 2.5 : 0,
  };
  extendAfterU(U, { night, winter, fire, temp });
  if (S.health < .4) for (const k of ['hunt', 'explore', 'search', 'revive', 'collect', 'regenerate', 'study', 'quarry']) U[k] *= .25;   // too weak for long trips or long procedures
  if (WORLD.season === 'autumn' && A.inv.food < 20) for (const k of ['forage', 'berries', 'hunt', 'fish', 'harvest', 'cook']) if (U[k]) U[k] += .5;   // laying in food before the snow
  const F = emoFamilies(S, vegaCtx());
  for (const k in U) if (U[k]) U[k] *= feelBias(F, k) * dayBias(k);
  if (S.ptsd > .4 && A.research.done.power && equanimity() < .5) U.research *= 1 - S.ptsd * .8;   // he will not go back into that building
  if ((partnerOf() || FAMILY.children.length) && cfg.after.renew === 'family') for (const k of ['collect', 'revive', 'regenerate']) U[k] *= .2;
  const M = (DIRECTIVES[A.directive] || {}).m || {};
  // whatever he has been told to lean toward, a starving or freezing body comes first
  const crit = {};
  if (S.hunger > .55) for (const k of ['eat', 'cook', 'forage', 'berries', 'scavenge', 'hunt', 'fish', 'harvest']) crit[k] = 7 * (S.hunger - .4);
  if (S.thirst > .55) crit.drink = 5 * (S.thirst - .4);
  if (S.warmth < .4) { crit.warm = 2 * (.6 - S.warmth); crit.sleep = 1.5 * (.6 - S.warmth); }
  if (S.health < .3) crit.sleep = (crit.sleep || 0) + 1.2;
  if (dangerZ) crit.put_down = 2.5;
  const thr = nearestThreat(14);
  if (thr) { if (U.fight) crit.fight = 2.5; if (U.flee) crit.flee = 2.5; }
  let best = 'wander', bv = -1;
  for (const k in U) { if (!U[k] && !crit[k]) continue; const m = 1 + ((M[k] || 1) - 1) * .6; const u = U[k] * m + (U[k] > 0 ? crit[k] || 0 : 0) + R() * .18; if (u > bv) { bv = u; best = k; } }
  let target = A.pos.clone(), dur = 1; const extra = {};
  switch (best) {
    case 'drink': target = nearestWater(A.pos); dur = .4; break;
    case 'eat': case 'journal': case 'medicine': dur = .5; break;
    case 'cook': case 'warm': target = structPos('campfire').add(new THREE.Vector3(1.2, 0, 0)); dur = best === 'cook' ? 1 : rnd(1, 2.5); break;
    case 'forage': target = nearPlace(nearestVillage(A.pos), 'fields'); dur = rnd(1.5, 3); break;
    case 'berries': { const b = nearest(bushes, A.pos); target = new THREE.Vector3(b.x + 1, b.y, b.z); extra.b = b; dur = 1; break; }
    case 'scavenge': { const wantBooks = res && A.inv.books < res.books && S.hunger < .6, pool = wantBooks && houses.some(h => h.stock.books > 0) ? houses.filter(h => h.stock.books > 0) : houses; const h = pool.sort((a, b) => a.door.distanceTo(A.pos) - b.door.distanceTo(A.pos))[0]; target = h.door.clone(); extra.house = h; dur = 1.5; break; }
    case 'hunt': { const prey = nearest(ANIMALS, A.pos, a => a.alive && a.s.hunt && !a.s.predator && (A.research.done.tools || a.s.small) && a.pos.distanceTo(A.pos) < 60); if (!prey) { best = 'forage'; target = nearPlace(nearestVillage(A.pos), 'fields'); dur = 2; break; } extra.a = prey; target = prey.pos.clone(); dur = rnd(2, 4); break; }
    case 'fish': { const a = Math.atan2(A.pos.z - LAKE.z, A.pos.x - LAKE.x); target = P(LAKE.x + Math.cos(a) * (LAKE.r + 1.2), LAKE.z + Math.sin(a) * (LAKE.r + 1.2)); dur = rnd(2, 4); break; }
    case 'chop': { const t = nearest(TREES, A.pos, t => t.wood > 0); if (!t) { best = 'wander'; break; } target = P(t.x + 1, t.z); extra.t = t; dur = 2; break; }
    case 'quarry': { const r = nearest(ROCKS, A.pos, r => r.stone > 0); if (!r) { best = 'wander'; break; } target = P(r.x + 1.2, r.z); extra.r = r; dur = 2; break; }
    case 'build': extra.k = need; extra.pk = 'b:' + need; target = structPos(need).add(new THREE.Vector3(1, 0, 1)); dur = Math.max(.5, STRUCT[need].hours - (A.prog[extra.pk] || 0)); break;
    case 'plant': case 'harvest': case 'tend': target = structPos('garden').add(new THREE.Vector3(0, 0, 1.6)); dur = best === 'tend' ? 1.5 : 3; break;
    case 'research': target = labPos(); dur = rnd(3, 6); break;
    case 'study': { const cc = unburied.sort((a, b) => a.deathPos.distanceTo(A.pos) - b.deathPos.distanceTo(A.pos))[0]; extra.c = cc; target = cc.deathPos.clone().add(new THREE.Vector3(.9, 0, 0)); dur = 3; break; }
    case 'collect': { const c = revivable.sort((a, b) => (vegaC.rel.get(b) || 0) - (vegaC.rel.get(a) || 0))[0]; extra.c = c; target = (c.grave ? c.gravePos : c.deathPos).clone().add(new THREE.Vector3(.9, 0, 0)); dur = 3; break; }
    case 'revive': extra.c = A.carrying; extra.pk = 'r:' + A.carrying.i; target = labPos(); dur = Math.max(.5, 14 - (A.prog[extra.pk] || 0)); break;
    case 'regenerate': { const z = zombies[0]; extra.z = z; extra.pk = 'g:' + z.c.i; target = labPos(); dur = Math.max(.5, 48 - (A.prog[extra.pk] || 0)); break; }
    case 'put_down': extra.z = dangerZ; target = dangerZ.pos.clone(); dur = .5; break;
    case 'bury': { const c = unburied.sort((a, b) => (vegaC.rel.get(b) || 0) - (vegaC.rel.get(a) || 0))[0]; target = c.deathPos.clone().add(new THREE.Vector3(.9, 0, 0)); extra.c = c; dur = 3; break; }
    case 'grave': { const c = GRAVES.slice().sort((a, b) => (vegaC.rel.get(b) || 0) - (vegaC.rel.get(a) || 0))[Math.floor(Math.pow(R(), 2) * GRAVES.length)]; target = (c.gravePos || c.deathPos).clone().add(new THREE.Vector3(0, 0, 1.4)); extra.c = c; dur = rnd(1, 2.5); break; }
    case 'explore': { const v = unvisited.sort((a, b) => Math.hypot(a.x - A.pos.x, a.z - A.pos.z) - Math.hypot(b.x - A.pos.x, b.z - A.pos.z))[0]; target = v.places.plaza.pos.clone(); extra.v = v; dur = 1.5; break; }
    case 'search': { const a = rnd(0, TAU), v = VILL[nearestVillage(A.pos)]; target = P(v.x + Math.cos(a) * 45, v.z + Math.sin(a) * 45); dur = .6; A.searches++; break; }
    case 'sleep': {
      // with the scar, a closed door is unbearable: he sleeps on the porch or by the fire
      const out = S.ptsd > .35 && !(WEATHER.kind === 'blizzard' || tempAt(sim.hours) + weatherTemp() < -2);
      A.sleepIndoors = !out;
      target = out && A.built.campfire ? structPos('campfire').add(new THREE.Vector3(-1.4, 0, .6)) : A.research.done.power && A.pos.distanceTo(FAC.door) < 40 && S.ptsd < .3 ? FAC.door.clone() : vegaC.home.rec && !out ? vegaC.home.rec.bedWorld() : vegaC.home.door.clone(); dur = 8; break; }
    case 'wash': { target = nearestWater(A.pos); dur = .6; break; }
    case 'talk': { const z = pick(COMPANIONS.filter(z => z.kind !== 'zombie')); target = z.pos.clone().add(new THREE.Vector3(1.2, 0, .5)); extra.z = z; dur = rnd(1, 2.5); break; }
    case 'ghost': { const f = ROOM.friends[Math.floor(Math.pow(R(), 1.6) * ROOM.friends.length)]; A.ghostC = f.c; const v = VILL[nearestVillage(A.pos)]; target = v.places.well.pos.clone().add(new THREE.Vector3(2, 0, 2)); dur = rnd(1, 2); break; }
    case 'sit': target = nearPlace(nearestVillage(A.pos), 'plaza', 3); dur = rnd(1.5, 4); break;
    case 'wander': { const h = pick(HOUSES.filter(h => h.v === nearestVillage(A.pos))); target = h.door.clone(); dur = rnd(.5, 1.2); break; }
    default: { const r = startAfterExtra(best, extra); if (r) { target = r.target; dur = r.dur; } break; }
  }
  onGround(target);
  A.beh = { kind: best, target, dur, t: 0, arrived: false, extra, h0: S.hunger, th0: S.thirst };
  if (R() < .55 && ALINES[best]) say(line(ALINES[best], true));
  if (best === 'ghost') { const g = ghostOf(A.ghostC, scene); g.want = 1; g.place = 'the well'; g.root.position.copy(target).add(new THREE.Vector3(1.4, 0, .6)); }
}

function afterStep(dtH) {
  if (A.ended) return;
  const p = vegaC.p, v = vegaC.v, r = vegaC.rates, b = A.beh;
  const sleeping = b && b.kind === 'sleep' && b.arrived;
  const season = seasonAt(sim.hours), winter = season === 'winter', temp = tempAt(sim.hours) + weatherTemp();
  weatherStep(dtH); threatSpawns(dtH); hostileStep(dtH); familyStep(dtH);
  const ctx = vegaCtx(); moodStep(dtH, ctx); depthStep(dtH, b && b.arrived ? b.kind : ''); ptsdStep(dtH); dayTrack(dtH, ctx); hallStep(dtH);
  A.seasonTurn = season !== A.lastSeason;
  if (season !== A.lastSeason) { A.lastSeason = season; if (aloneDays() > 1) say({ winter: 'Snow. A winter with almost nobody.', spring: 'Green again. The world doesn\'t care who is left.', summer: 'Long days. Too long, with nothing to fill them.', autumn: 'Leaves in the empty houses.' }[season], 'ev'); for (const bb of BUSHES) if (season === 'summer') bb.stock = 4; }
  // body
  // he is thinner now and has learned to ration; appetite and thirst run a little lower than in town
  S.hunger = clamp(S.hunger + r.hunger * .85 * (cfg.after.difficulty === 'forgiving' ? .85 : 1) * dtH * (sleeping ? .5 : 1) * (winter ? 1.2 : 1));
  S.thirst = clamp(S.thirst + r.thirst * .8 * dtH * (sleeping ? .4 : 1) * (temp > 24 ? 1.3 : 1));
  if (!sleeping) { S.sleep = clamp(S.sleep + r.sleep * dtH); S.energy = clamp(S.energy - .035 * dtH * (winter ? 1.3 : 1)); }
  S.hygiene = clamp(S.hygiene - .008 * dtH); S.dirt = 1 - S.hygiene;
  const nearFire = A.built.campfire && A.pos.distanceTo(structPos('campfire')) < 5;
  const inShelter = sleeping && A.built.shelter && b.target.distanceTo(vegaC.home.door) < 2 || sleeping && A.research.done.power && b.target.distanceTo(FAC.door) < 2;
  weatherEffects(dtH, nearFire || inShelter);
  if (sleeping && S.ptsd > .2 && R() < dtH * .05 * S.ptsd) { b.t = b.dur; say(pick(['Woke up with my hands on a wall that wasn\'t there.', 'The white again. In the dream I was still counting.', 'Nightmare. I woke up shouting for the hatch to open.']), 'bad'); S.fear = clamp(S.fear + .3); S.sleep = clamp(S.sleep + .1); }
  if (temp < 10 && !nearFire && !inShelter) S.warmth = clamp(S.warmth - (10 - temp) / 160 * dtH * (A.coat ? .45 : 1));
  else S.warmth = clamp(S.warmth + (nearFire || inShelter ? .3 : .08) * dtH);
  if (A.sickLeft > 0) { A.sickLeft -= dtH; S.health = clamp(S.health - .006 * harm() * dtH); S.energy = clamp(S.energy - .02 * dtH); if (A.sickLeft <= 0) say('The fever broke. I\'m still here.', 'ev'); }
  else if (aloneDays() > 10 && R() < dtH * .0008 * (S.hygiene < .3 ? 2 : 1) * (S.warmth < .3 ? 2 : 1)) { A.sickLeft = rnd(48, 120); A.sick++; say('Fever. The same one, maybe. The one that took them.', 'bad'); }
  S.pain = clamp(S.pain * Math.exp(-.04 * dtH));
  S.health = clamp(S.health - ((S.hunger > .85 ? .004 : 0) + (S.thirst > .9 ? .015 : 0) + (S.warmth < .25 ? .012 : 0)) * harm() * dtH + (S.hunger < .75 && S.thirst < .75 && !A.sickLeft && S.warmth > .4 ? .007 * dtH : 0));
  if (S.hunger > .6) S.weight = clamp(S.weight - .005 * dtH, .5, 1); else S.weight = clamp(S.weight + .003 * dtH, .5, 1);
  // mind
  const D = derived(), sleepDebt = Math.max(0, S.sleep - .6), company = COMPANIONS.some(z => z.kind !== 'zombie');
  S.loneliness = clamp(S.loneliness + .004 * (.4 + p.extraversion) * (.6 + v.community) * dtH * (company ? .2 : 1));
  S.grief = clamp(S.grief - .004 * dtH); S.guilt = clamp(S.guilt - .002 * dtH);
  S.boredom = clamp(S.boredom + .005 * (.4 + p.openness) * dtH - (b && b.arrived && !['sit', 'sleep', 'wander'].includes(b.kind) ? .03 * dtH : 0));
  S.hope = clamp(S.hope - .0015 * (1.3 - p.persistence) * dtH * (company ? .3 : 1));
  S.anger = clamp(S.anger - .03 * S.anger * dtH);
  S.pride = clamp(S.pride - .006 * S.pride * dtH); S.awe = clamp(S.awe - .02 * S.awe * dtH);
  S.nostalgia = clamp(S.nostalgia + (.002 * S.loneliness - .001) * dtH);
  S.shame = clamp(S.shame + (((1 - S.hygiene) * (company ? .8 : .3)) - S.shame) * .03 * dtH);
  const hour = sim.hours % 24, night = hour < 6 || hour >= 21;
  S.fear = clamp(S.fear + ((.08 + (night ? .25 * (1.1 - S.grip) : 0) + (A.sickLeft > 0 ? .2 : 0) + (ANIMALS.some(a => a.alive && a.state === 'stalk') ? .3 : 0)) - S.fear) * .1 * dtH);
  S.dread = clamp(S.dread + ((S.fear * .5 + S.guilt * .3 + (COMPANIONS.some(z => z.unstable) ? .3 : 0)) - S.dread) * .03 * dtH);
  S.curiosity = clamp(S.curiosity + ((p.curiosity * .7 * (1 - D.apathy) + (A.research.active ? .2 : 0)) - S.curiosity) * .02 * dtH);
  S.grip = clamp(S.grip + (.0016 - .0008 * S.loneliness - .002 * sleepDebt - .0005 * S.grief - .0006 * S.dread) * dtH);
  if (S.health <= 0) return endAfter();
  if (A.inv.food > 0 && A.built.smokehouse) A.inv.food += 0;
  if (A.pen > 0) A.inv.food += A.pen * .5 / 24 * dtH;
  if (A.inv.meat > 0 && !winter) A.inv.meat = Math.max(0, A.inv.meat - A.inv.meat * (A.built.smokehouse ? .002 : .012) * dtH);   // raw meat spoils
  if (A.garden && !winter) A.garden.growth = Math.min(1, A.garden.growth + dtH / (24 * (WORLD.season === 'summer' ? 18 : 24)));
  // seeing people
  for (const c of citizens) {
    if (c.isVega) continue;
    if (!c.alive && !c.found && c.remains && c.deathPos.distanceTo(A.pos) < 6) foundBody(c);
    if (c.alive && c.survivor && !c.met) {
      if (c.pos.distanceTo(A.pos) < 14) meet(c);
      else if (aloneDays() > cfg.outside.findDays && !c.seeking) { c.seeking = true; OUT.push({ h: sim.hours, text: `${c.name} sets out toward ${homeName()}, looking for anyone.` }); }
      if (c.seeking) { c.act = { kind: 'visit', target: A.pos.clone(), dur: 99, t: 0, arrived: false, visitV: nearestVillage(A.pos) }; }
    }
  }
  for (const vv of VILL) if (!vv.visited && Math.hypot(vv.x - A.pos.x, vv.z - A.pos.z) < 18) { vv.visited = true; if (vv.i !== vegaC.homeVillage) { S.awe = clamp(S.awe + .3); say(`${vv.name}. Same silence. Same grass in the doorways.`, 'ev'); } }
  // behaviour
  // a need that turned critical after he picked what he is doing makes him reconsider, once
  const starving = b && S.hunger > .8 && (b.h0 ?? 0) <= .8 && (A.inv.food >= 1 || A.inv.meat >= 1) && b.kind !== 'eat' && b.kind !== 'cook';
  const parched = b && S.thirst > .85 && (b.th0 ?? 0) <= .85 && b.kind !== 'drink';
  const famished = b && S.hunger > .9 && (b.h0 ?? 0) <= .9 && !['eat', 'cook', 'forage', 'hunt', 'fish', 'berries', 'scavenge', 'harvest'].includes(b.kind);
  const threatened = b && !['fight', 'flee', 'flashback', 'barricade'].includes(b.kind) && nearestThreat(10) && (!b.th || sim.hours - b.th > .5);
  if (threatened) b.th = sim.hours;
  if (!b || b.t >= b.dur || starving || parched || famished || threatened || (b.kind === 'sleep' && b.arrived && S.sleep < .05 && !night)) {
    if (b && b.kind === 'sleep' && b.arrived) dayRoll();
    if (b && b.kind === 'ghost') { const g = ghosts.get(A.ghostC.i + ':ghost'); if (g) g.want = 0; }
    if (b && b.arrived && !b.finished && b.t >= b.dur) finishBeh(b);
    afterChoose(); return;
  }
  if (!b.arrived) {
    if (b.kind === 'hunt' && b.extra.a && b.extra.a.alive) b.target.copy(b.extra.a.pos);
    if (b.kind === 'put_down' && b.extra.z) b.target.copy(b.extra.z.pos);
    const dx = b.target.x - A.pos.x, dz = b.target.z - A.pos.z, dist = Math.hypot(dx, dz);
    if (b.kind === 'fight' && b.extra.t && (b.extra.t.alive)) b.target.copy(b.extra.t.pos);
    const reach = b.kind === 'hunt' ? (A.research.done.tools ? 6 : 1.6) : b.kind === 'fight' ? (A.weapon === 'rifle' ? 12 : 1.4) : .3;
    const step = Math.min(dist, WALK * dtH * (.4 + .6 * Math.min(S.energy + .2, S.health, 1)) * (b.kind === 'hunt' || b.kind === 'flee' || b.kind === 'fight' ? 1.4 : 1));
    if (dist > reach) { A.pos.x += dx / dist * step; A.pos.z += dz / dist * step; onGround(A.pos); A.yawT = Math.atan2(dx, dz); vegaC.h.phase += step * 4.4; b.walk = (b.walk || 0) + dtH; if (b.walk > (b.kind === 'hunt' || b.kind === 'put_down' || b.kind === 'fight' ? 2.5 : 30)) { b.t = b.dur; b.arrived = true; b.finished = true; } }
    else { b.arrived = true; arrive(b); }
    return;
  }
  b.t += dtH;
  if (b.extra.pk) A.prog[b.extra.pk] = (A.prog[b.extra.pk] || 0) + dtH;   // long jobs keep their progress between sessions
  tickBeh(b, dtH, winter);
}
function foundBody(c) {
  c.found = true; A.found++; dayNote('found'); spike('surprise', .4); spike('disgust', .2);
  const aff = vegaC.rel.get(c) || 0;
  S.grief = clamp(S.grief + .08 + aff * .6); S.hope = clamp(S.hope - .03 - aff * .2); S.guilt = clamp(S.guilt + aff * .2);
  say(aff > .3 ? `That's ${c.name}'s coat. That's ${c.name}.` : aff > .1 ? `${c.name}. I knew ${c.name} a little.` : pick([`Someone. I think it was ${c.name}.`, `${c.name}'s shoes. Just the shoes, and what's left.`]), aff > .3 ? 'bad' : 'say');
  if (!ROOM.friends.find(f => f.c === c) && aff > .2) ROOM.friends.push({ c, a: aff });
}
function arrive(b) {
  const k = b.kind;
  if (k === 'search') { A.bubble = { text: pick(['HELLO?', 'IS ANYONE THERE?', `${fr().toUpperCase()}?`, 'ANYONE?']), cls: 'bub shout', until: performance.now() + 2600 }; S.hope = clamp(S.hope - .04); S.loneliness = clamp(S.loneliness + .02); }
  if (k === 'scavenge' && b.extra.house.store) return lootStore(b.extra.house);
  if (k === 'scavenge') { const h = b.extra.house, s = h.stock; if (h === vegaC.home) say('My own house. My cup, my coat, the things I bought. Like I stepped out an hour ago.', 'ev'); A.inv.cans += s.cans || 0; if (s.tools) { A.weapon = A.weapon || 'axe'; } A.inv.food += s.food; A.inv.seeds += s.seeds; A.inv.books += s.books; A.inv.medicine += s.medicine; if (s.food + s.books > 0) S.hope = clamp(S.hope + .02); if (s.books > 2) say(`${s.books} books from the ${h.library ? 'library' : 'shelves'}. Paper is worth more than gold now.`, 'ev'); h.searched = true; h.stock = { food: 0, seeds: 0, books: 0, medicine: 0 }; }
  if (k === 'eat') { if (A.inv.food >= 1) { A.inv.food -= 1; S.hunger = clamp(S.hunger - .6); } else if (A.inv.cans >= 1) { A.inv.cans -= 1; S.hunger = clamp(S.hunger - .5); } else if (A.inv.meat >= 1) { A.inv.meat -= 1; S.hunger = clamp(S.hunger - .35); if (R() < .1 && !A.sickLeft) { A.sickLeft = rnd(24, 60); A.sick++; say('Raw meat. My stomach is turning itself inside out.', 'bad'); } } }
  if (k === 'medicine') { if (A.inv.medicine > 0) A.inv.medicine--; else say('Brewed willow bark and feverfew the way the herbal says.', 'ev'); A.sickLeft = Math.min(A.sickLeft, 6); S.health = clamp(S.health + .1); }
  if (k === 'explore') { b.extra.v.visited = true; }
  if (k === 'plant') { A.inv.seeds--; A.garden = { growth: 0 }; S.hope = clamp(S.hope + .06); }
  if (k === 'harvest') { const y = A.research.done.agri ? 12 : 6; A.inv.food += y; A.inv.seeds += 2; A.garden = null; S.hope = clamp(S.hope + .08); S.pride = clamp(S.pride + .2); say(`${y} meals from the garden.`, 'ev'); }
  if (k === 'put_down') { const z = b.extra.z; z.h.root.visible = false; scene.remove(z.h.root); COMPANIONS.splice(COMPANIONS.indexOf(z), 1); z.c.companion = false; z.c.alive = false; z.c.revived = 'ended'; z.c.deathPos = z.pos.clone(); z.c.remains = null; z.c.buried = false; z.c.found = true; makeRemains(z.c); A.putDown++; S.guilt = clamp(S.guilt + .35); S.grief = clamp(S.grief + .3); S.grip = clamp(S.grip - .08); say(line(ALINES.put_down, true), 'bad'); }
}
function tickBeh(b, dtH, winter) {
  const k = b.kind;
  switch (k) {
    case 'drink': S.thirst = clamp(S.thirst - 1.8 * dtH);
      if (WORLD.poisonWells && !A.wellBad && VILL.some(v => v.places.well.pos.distanceTo(A.pos) < 3)) { A.wellBad = true; A.sickLeft = Math.max(A.sickLeft, rnd(30, 60)); A.sick++; say('The well water tastes of metal. I\'m sick. The wells are bad now.', 'bad'); }
      break;
    case 'wash': S.hygiene = clamp(S.hygiene + 1.4 * dtH); if (WORLD.season === 'winter') S.warmth = clamp(S.warmth - .2 * dtH); break;
    case 'forage': S.hunger = clamp(S.hunger - (winter ? .05 : .2) * dtH); if (!winter) { A.inv.food += .16 * dtH; if (WORLD.season !== 'spring') A.inv.seeds += .06 * dtH; } break;
    case 'berries': if (b.extra.b.stock > 0) { b.extra.b.stock -= dtH * 2; S.hunger = clamp(S.hunger - .3 * dtH); A.inv.food += .2 * dtH; if (b.extra.b.stock <= 0) { b.extra.b.stock = 0; b.extra.b.berries.visible = false; } } break;
    case 'cook': if (A.inv.meat >= 1) { const n = Math.min(A.inv.meat, 2 * dtH); A.inv.meat -= n; A.inv.food += n * (A.built.smokehouse ? 1.6 : 1.3); } S.warmth = clamp(S.warmth + .3 * dtH); break;
    case 'warm': S.warmth = clamp(S.warmth + .5 * dtH); S.loneliness = clamp(S.loneliness - .005 * dtH); break;
    case 'hunt': {
      const a = b.extra.a; if (!a || !a.alive) { b.t = b.dur; break; }
      const pr = { deer: .5, boar: .45, rabbit: .7, chicken: .8 }[a.type] * (A.research.done.tools ? 1.6 : .7) * (vegaC.occupation === 'hunter' ? 1.4 : 1) * derived().strength;
      if (a.pos.distanceTo(A.pos) > (A.research.done.tools ? 7 : 2.2)) { b.arrived = false; break; }
      if (R() < pr * dtH * 2) { killAnimal(a); b.t = b.dur; say(a.type === 'chicken' && A.built.pen ? '' : `A ${a.type}. I said thank you. I don't know who to.`, 'ev'); if (a.s.fights && R() < .15) { S.health = clamp(S.health - .06 * harm()); S.pain = clamp(S.pain + .3); say(`The ${a.type} gored my leg before it went down.`, 'bad'); } }
      break;
    }
    case 'fish': if (R() < dtH * .6) { A.inv.meat += 1; A.fish++; if (R() < .15) A.inv.specimens++; } break;
    case 'chop': A.inv.wood += 1.6 * dtH; if (b.extra.t) b.extra.t.wood -= .4 * dtH; S.warmth = clamp(S.warmth + .1 * dtH); break;
    case 'quarry': A.inv.stone += 1.4 * dtH; if (b.extra.r) b.extra.r.stone -= 1.4 * dtH; break;
    case 'tend': if (A.garden) A.garden.growth = Math.min(1, A.garden.growth + dtH / (24 * 30)); break;
    case 'research': {
      const n = nextResearch(); if (!n) { b.t = b.dur; break; }
      if (A.research.active !== n) { if (A.inv.books < n.books || A.inv.specimens < n.spec) { b.t = b.dur; break; } A.inv.books -= n.books; A.inv.specimens -= n.spec; A.research.active = n; A.research.progress = 0; say(`Starting on ${n.name.toLowerCase()}.`, 'ev'); }
      A.research.progress += dtH * researchRate(); S.boredom = clamp(S.boredom - .1 * dtH);
      if (A.research.progress >= n.hours) researchDone(n);
      break;
    }
    case 'journal': S.grip = clamp(S.grip + .01 * dtH); S.loneliness = clamp(S.loneliness - .01 * dtH); A.journal += dtH; break;
    case 'grave': S.loneliness = clamp(S.loneliness - .05 * dtH); S.grief = clamp(S.grief - .03 * dtH); break;
    case 'ghost': S.loneliness = clamp(S.loneliness - .1 * dtH); S.grip = clamp(S.grip - .006 * dtH); break;
    case 'talk': S.loneliness = clamp(S.loneliness - .15 * dtH); S.grip = clamp(S.grip + .003 * dtH); S.hope = clamp(S.hope + .01 * dtH); if (R() < dtH * .8 && b.extra.z) A.bubble = { text: pick([`Do you remember the market on feast day?`, `I talked to you every day in there. You didn't know.`, `We'll get the garden going.`, `Thank you for staying.`]), cls: 'bub', until: performance.now() + 2600 }; break;
    case 'sit': S.boredom = clamp(S.boredom - .03 * dtH); break;
    case 'wander': case 'explore': S.boredom = clamp(S.boredom - .12 * dtH); break;
    case 'sleep': S.sleep = clamp(S.sleep - .17 * dtH); S.energy = clamp(S.energy + .13 * dtH); S.grip = clamp(S.grip + .004 * dtH); break;
    default: tickExtra(b, dtH); break;
  }
}
function finishBeh(b) {
  b.finished = true;
  const k = b.kind;
  if (k === 'build' || k === 'harvest') dayNote('wins');
  if (k === 'build') { const s = STRUCT[b.extra.k]; A.inv.wood -= s.wood || 0; A.inv.stone -= s.stone || 0; A.inv.seeds -= s.seeds || 0; A.built[b.extra.k] = true; placeStructure(b.extra.k); S.pride = clamp(S.pride + .25); S.hope = clamp(S.hope + .06); say(`Built a ${s.label.toLowerCase()}.`, 'ev'); if (b.extra.k === 'memorial') { S.grief = clamp(S.grief - .2); say('Every name I could remember, cut into the stone.', 'ev'); } }
  if (k === 'bury') { const c = b.extra.c; if (c.remains) { scene.remove(c.remains); c.remains = null; } c.buried = true; makeGrave(c); A.buried++; S.hope = clamp(S.hope + .04); S.grief = clamp(S.grief - .05); S.guilt = clamp(S.guilt - .03); say(`Buried ${c.name}. ${A.buried} graves now.`, 'ev'); }
  if (k === 'study') { A.inv.specimens += 2; S.guilt = clamp(S.guilt + .08); S.curiosity = clamp(S.curiosity + .1); }
  if (k === 'collect') { const c = b.extra.c; if (c.remains) { scene.remove(c.remains); c.remains = null; } if (c.grave) { scene.remove(c.grave); c.grave = null; GRAVES.splice(GRAVES.indexOf(c), 1); c.buried = false; } A.carrying = c; S.guilt = clamp(S.guilt + .15); }
  if (k === 'revive') { const c = A.carrying; A.carrying = null; c.revived = 'zombie'; A.revived++; const z = addCompanion(c, 'zombie'); S.grief = clamp(S.grief - .2); S.dread = clamp(S.dread + .3); S.guilt = clamp(S.guilt + .2); S.love = clamp(S.love + .1); say(`${c.name}'s eyes opened. ${c.name} looked at me and didn't know me. But ${c.name} is standing.`, 'bad'); }
  if (k === 'regenerate') {
    const z = b.extra.z; if (A.inv.specimens < 3) return; A.inv.specimens -= 3;
    scene.remove(z.h.root); COMPANIONS.splice(COMPANIONS.indexOf(z), 1);
    const c = z.c; c.revived = 'restored'; c.alive = true; A.restored++;
    const nz = addCompanion(c, 'restored'); nz.pos.copy(z.pos);
    S.grief = clamp(S.grief - .3); S.hope = clamp(S.hope + .4); S.loneliness = clamp(S.loneliness - .4); S.grip = clamp(S.grip + .1); S.pride = clamp(S.pride + .4);
    say(`${c.name} said my name. Not the moan. My name, the way they used to say it.`, 'ev');
  }
  if (k === 'eat') S.hunger = clamp(S.hunger);
  finishExtra(b);
}
function researchDone(n) {
  A.research.done[n.id] = true; A.research.active = null; A.research.progress = 0;
  S.pride = clamp(S.pride + .3); S.hope = clamp(S.hope + .08); S.curiosity = clamp(S.curiosity + .1);
  say(`Finished: ${n.name}. ${n.desc}`, 'ev');
  if (n.id === 'tools') A.tools = true;
  if (n.id === 'power') { FAC.lit = true; say('The generator coughed and caught. The facility lights came on. The same lights.', 'ev'); S.dread = clamp(S.dread + .15); }
}
function endAfter() {
  A.ended = true; A.beh = { kind: 'dead', target: A.pos.clone(), dur: 1e9, t: 0, arrived: true, extra: {} };
  say('...', 'bad');
  showEnding('after');
}

function afterRender(dtR, now) {
  const h = vegaC.h, b = A.beh, D = derived();
  const k = 1 - Math.exp(-dtR * 8);
  if (A.yawT != null && !b.arrived) A.yaw += angDiff(A.yaw, A.yawT) * Math.min(1, dtR * 8);
  const faceTo = q => { A.yaw += angDiff(A.yaw, Math.atan2(q.x - A.pos.x, q.z - A.pos.z)) * Math.min(1, dtR * 4); };
  if (b.arrived) {
    if ((b.kind === 'bury' || b.kind === 'collect' || b.kind === 'study') && b.extra.c) faceTo(b.extra.c.deathPos);
    if (b.kind === 'grave' && b.extra.c) faceTo(b.extra.c.gravePos || b.extra.c.deathPos);
    if ((b.kind === 'cook' || b.kind === 'warm') && A.built.campfire) faceTo(structPos('campfire'));
    if (b.kind === 'hunt' && b.extra.a) faceTo(b.extra.a.pos);
    if (b.kind === 'talk' && b.extra.z) faceTo(b.extra.z.pos);
    if (b.kind === 'chop' && b.extra.t) faceTo(new THREE.Vector3(b.extra.t.x, 0, b.extra.t.z));
    if (b.kind === 'fish') faceTo(new THREE.Vector3(LAKE.x, 0, LAKE.z));
  }
  let kind = b.arrived ? APOSE[b.kind] : (b.kind === 'hunt' || b.kind === 'flee' || b.kind === 'fight' ? 'run' : (S.health < .3 ? 'stagger' : 'walk'));
  if (b.kind === 'sleep' && b.arrived && S.grip < .5) kind = 'curl';
  if (b.kind === 'fight' && b.arrived && !armed()) kind = 'punch';
  if (PTSD.flash) kind = 'cower';
  if (b.arrived) h.phase += dtR * (/bury|chop|collect|build/.test(b.kind) ? 4 : 2.4) * Math.min(Math.max(speed, 1), 3);
  applyPose(h, pose(kind, h.phase, { slump: D.slump, tremor: (A.sickLeft > 0 ? .05 : 0) + S.fear * .03, amp: .65 + .35 * S.energy }), k);
  h.root.position.copy(A.pos); h.root.rotation.y = A.yaw;
  // what is in his hands, on his face, and where he looks
  const night = (sim.hours % 24) < 6 || (sim.hours % 24) > 20;
  holdTool(h, b.kind === 'fight' ? (A.weapon === 'rifle' ? 'rifle' : armed() ? 'spear' : null) : b.arrived ? AFTER_TOOL[b.kind] || null : (night && !b.arrived && A.inv.wood > 0 ? 'torch' : null));
  setFace(h, faceFrom(S, b.kind === 'sleep' && b.arrived || b.kind === 'intimate' && b.arrived || b.kind === 'meditate', vegaCtx()), dtR);
  const lt = b.kind === 'fight' && b.extra.t ? b.extra.t.pos : (b.kind === 'talk' || b.kind === 'court' || b.kind === 'cradle') && b.extra.z ? b.extra.z.pos : (nearestThreat(20) || {}).pos;
  lookAtPoint(h, lt ? _lookP.set(lt.x, lt.y + 1.5, lt.z) : (HALL.mouse && camMode !== 'pov' ? HALL.mouse : null), dtR, lt || HALL.mouse ? 1 : 0);
  h.pack.visible = A.backpack;
  cutaways(A.pos, camMode !== 'map' && camMode !== 'pov');
  povCamera(dtR, h);
  renderHostiles(dtR); weatherVisuals(dtR);
  setMass(h, S.weight); setGrooming(h, S.daysGroomed + (A.washedBeard ? 0 : aloneDays()), S.dirt);
  h.handL.color.copy(h.skin).lerp(new THREE.Color(0x7d2f27), S.hands * .5); h.handR.color.copy(h.handL.color);
  if (A.flame) { A.flame.scale.y = .8 + Math.sin(now * .02) * .2 + Math.random() * .1; const night = (sim.hours % 24) < 6 || (sim.hours % 24) > 19; A.fireLight.intensity = night ? 1.6 : .3; }
  if (A.cropMesh && A.garden) { A.cropMesh.scale.y = .02 + A.garden.growth; A.cropMesh.position.y = .25 * (.02 + A.garden.growth); } else if (A.cropMesh) A.cropMesh.scale.y = .02;
  // what his mind adds out here: ghosts at the wells, and the town full again
  const mind = viewMode === 'mind';
  A.ghostTown = mind ? clamp((.35 - S.grip) / .2) : 0;
  if (A.ghostTown > 0 && R() < dtR * .4 * A.ghostTown) {
    const dead = citizens.filter(c => !c.isVega && !c.alive && c.village === nearestVillage(A.pos));
    if (dead.length) { const c = pick(dead), g = ghostOf(c, scene); if (!g.want) { g.want = .8; g.flickUntil = now + rnd(4000, 9000); const v = VILL[c.village]; g.root.position.copy(nearPlace(v.i, 'plaza', 8)); g.walkTo = nearPlace(v.i, pick(['well', 'market', 'plaza'])); g.place = pick(['the plaza', 'the market', 'the well']); } }
  }
  renderGhosts(dtR, now, k, A.pos, [A.pos.clone().add(new THREE.Vector3(4, 0, 4))], mind, scene);
  renderCompanions(dtR, now);
  for (const c of citizens) {
    if (c.remains && c.found && camMode !== 'map' && c.deathPos.distanceTo(A.pos) < 30) tag('rm' + c.i, (vegaC.rel.get(c) || 0) > .1 ? c.name : '?', c.deathPos.clone().setY(c.deathPos.y + .6), 'tag bones');
    if (c.grave && c.gravePos.distanceTo(A.pos) < 20 && camMode !== 'map') tag('gv' + c.i, c.name, c.gravePos.clone().setY(c.gravePos.y + .85), 'tag grave');
  }
  tag('va', NAME(), new THREE.Vector3(A.pos.x, A.pos.y + (/lie|curl|collapsed/.test(kind) ? .7 : (/sit|eat_sit|kneel|warm|fish/.test(kind) ? 1.3 : 2.15)), A.pos.z), 'tag vega');
  if (A.bubble && now < A.bubble.until) tag('abub', A.bubble.text, new THREE.Vector3(A.pos.x, A.pos.y + 2.6, A.pos.z), A.bubble.cls);
  const unreal = mind ? Math.pow(1 - S.grip, 1.6) : 0;
  $('#vig').style.opacity = (.1 + unreal * .45 + (S.health < .4 ? (.4 - S.health) : 0) + (S.warmth < .3 ? .2 : 0)).toFixed(3);
  grainLevel = unreal * .08;
  renderer.domElement.style.filter = mind ? `saturate(${.8 - unreal * .3}) ${S.warmth < .3 ? 'hue-rotate(-8deg) brightness(1.05)' : ''}` : 'saturate(.85)';
}
