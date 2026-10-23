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
