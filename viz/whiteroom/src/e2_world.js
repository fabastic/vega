// =====================================================================
// THE LIVING WORLD AFTER: weather, enemies, stores to strip, a family
// =====================================================================
// None of this runs on a timetable. Weather is rolled from the season each day. The dead rise only
// where bodies lie unburied; raiders come because his smoke and his stockpile can be seen from the
// road; dogs and bears roam where they roam. What he does about any of it is scored like everything
// else he does.

// ---------- weather ----------
const WEATHER = { kind: 'clear', until: 0, forced: false, parts: null };
const WEATHER_LABEL = { clear: 'Clear', rain: 'Rain', storm: 'Storm', snow: 'Snow', blizzard: 'Blizzard', heat: 'Heatwave', fog: 'Fog' };
function weatherStep(dtH) {
  if (sim.hours < WEATHER.until) return;
  WEATHER.forced = false;
  const s = WORLD.season, r = R();
  const table = { spring: [['clear', .5], ['rain', .32], ['storm', .1], ['fog', .08]], summer: [['clear', .6], ['heat', .18], ['storm', .12], ['rain', .1]], autumn: [['clear', .4], ['rain', .3], ['fog', .15], ['storm', .15]], winter: [['clear', .35], ['snow', .4], ['blizzard', .15], ['fog', .1]] }[s];
  let acc = 0, k = 'clear'; for (const [kk, p] of table) { acc += p; if (r < acc) { k = kk; break; } }
  setWeather(k, rnd(8, 30));
}
function setWeather(k, hours, forced) {
  const was = WEATHER.kind; WEATHER.kind = k; WEATHER.until = sim.hours + hours; WEATHER.forced = !!forced;
  if (k !== was && sim.phase === 'after' && aloneDays() > .5) say({ rain: 'Rain on the empty roofs.', storm: 'A storm coming over the hills. Shelter.', snow: 'Snow again.', blizzard: 'A blizzard. I can\'t see the houses across the street.', heat: 'The heat sits on everything.', fog: 'Fog. The village is gone past ten metres.', clear: 'The sky cleared.' }[k], k === 'blizzard' || k === 'storm' ? 'bad' : 'say');
}
const weatherTemp = () => ({ blizzard: -12, snow: -3, storm: -4, rain: -2, heat: 9, fog: -1 }[WEATHER.kind] || 0);
function weatherEffects(dtH, sheltered) {
  const k = WEATHER.kind;
  if ((k === 'rain' || k === 'storm') && !sheltered) { S.hygiene = clamp(S.hygiene + .02 * dtH); S.warmth = clamp(S.warmth - .025 * dtH * (A.coat ? .5 : 1)); }
  if (k === 'storm' && !sheltered) S.fear = clamp(S.fear + .02 * dtH);
  if (k === 'heat') S.thirst = clamp(S.thirst + .03 * dtH);
  if (k === 'blizzard' && !sheltered) S.warmth = clamp(S.warmth - .05 * dtH * (A.coat ? .5 : 1));
}
function weatherVisuals(dtR) {
  const k = WEATHER.kind, n = 1400;
  if (!WEATHER.parts) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = rnd(-30, 30); p[i * 3 + 1] = rnd(0, 25); p[i * 3 + 2] = rnd(-30, 30); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    WEATHER.parts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .12, transparent: true, opacity: .7, depthWrite: false })); scene.add(WEATHER.parts);
  }
  const P = WEATHER.parts, on = sim.phase === 'after' && ['rain', 'storm', 'snow', 'blizzard'].includes(k) && camMode !== 'map';
  P.visible = on; if (!on) return;
  const snow = k === 'snow' || k === 'blizzard', fall = (snow ? 2.2 : 16) * (k === 'blizzard' || k === 'storm' ? 1.6 : 1), wind = k === 'blizzard' ? 6 : k === 'storm' ? 3 : .5;
  P.material.size = snow ? .14 : .05; P.material.color.set(snow ? 0xffffff : 0xaec4d4); P.material.opacity = snow ? .85 : .55;
  P.position.set(camera.position.x, 0, camera.position.z);
  const a = P.geometry.attributes.position.array, base = heightAt(camera.position.x, camera.position.z);
  for (let i = 0; i < n; i++) { a[i * 3 + 1] -= fall * dtR; a[i * 3] += wind * dtR * (snow ? Math.sin(i + performance.now() * .001) : 1); if (a[i * 3 + 1] < base - 2) { a[i * 3 + 1] = base + 22; a[i * 3] = rnd(-30, 30); a[i * 3 + 2] = rnd(-30, 30); } }
  P.geometry.attributes.position.needsUpdate = true;
}

// ---------- enemies ----------
// The risen are the town's own dead, up again where they lay unburied. Raiders are strangers who follow
// the smoke. Both are bodies in the world; he sees them, scores fight or flight, and lives with it.
const HOSTILES = [];
const enemyOn = k => (cfg.after.enemies || {})[k] !== false && (cfg.after.enemies || {})[k] !== 'off';
function raise(c) {
  if (c.risen || c.buried || c.companion) return;
  c.risen = true; if (c.remains) { scene.remove(c.remains); c.remains = null; }
  const h = makeHuman(Object.assign({}, c.look, { zombie: true }));
  setGrooming(h, 60, .9); setMass(h, .7); scene.add(h.root);
  const z = { type: 'risen', c, h, pos: c.deathPos.clone(), yaw: rnd(0, TAU), hp: 1, alive: true, speed: WALK * .35, dmg: .06, state: 'wander', t: 0, name: c.name };
  HOSTILES.push(z);
  const aff = vegaC.rel.get(c) || 0;
  if (z.pos.distanceTo(A.pos) < 60) { say(aff > .25 ? `${c.name} is walking. ${c.name} is dead and walking.` : `Something got up where ${c.name} lay.`, 'bad'); spike('surprise', .6); spike('fear', .3); }
  return z;
}
function spawnRaiders(n, at) {
  const ang = rnd(0, TAU), from = at || P(A.base.x + Math.cos(ang) * 80, A.base.z + Math.sin(ang) * 80);
  for (let i = 0; i < n; i++) {
    const sex = R() < .8 ? 'm' : 'f', look = Object.assign({ sex, skin: pick(SKINS), shirt: pick([0x3a3a32, 0x4a3a2a, 0x2a2e33]), hair: pick(HAIRS), height: rnd(1.65, 1.9), hairStyle: sex === 'f' ? 3 : pick([0, 2]), build: rnd(1, 1.15), jacket: pick([0x2e2a24, 0x3a4a34, 0x4a3a2a]) }, wardrobe(sex, false));
    look.shoes = 'boot';
    const h = makeHuman(look); setGrooming(h, 30, .6); scene.add(h.root);
    holdTool(h, pick(['rifle', 'axe', 'spear', 'crowbar']));
    HOSTILES.push({ type: 'raider', h, pos: onGround(from.clone().add(new THREE.Vector3(rnd(-3, 3), 0, rnd(-3, 3)))), yaw: 0, hp: 1.4, alive: true, speed: WALK * .9, dmg: .08, state: 'approach', t: 0, name: pick(['a raider', 'a stranger with a rifle', 'a scavenger']), loot: 0 });
  }
  say(pick(['Smoke on the road. People. They\'re armed.', 'Strangers coming up the road, carrying weapons.', 'Voices that aren\'t ghosts. Real voices. Coming here.']), 'bad'); spike('fear', .35); spike('surprise', .5);
}
function spawnDogs(n, at) {
  const c = at || P(A.pos.x + rnd(-40, 40), A.pos.z + rnd(-40, 40));
  for (let i = 0; i < n; i++) { const a = makeAnimal('dog'); a.pos = onGround(c.clone().add(new THREE.Vector3(rnd(-3, 3), 0, rnd(-3, 3)))); a.home = a.pos.clone(); a.yaw = 0; a.state = 'graze'; a.t = 0; a.alive = true; a.hpCooldown = 0; a.aggro = true; a.root.position.copy(a.pos); scene.add(a.root); ANIMALS.push(a); }
}
function spawnBear(at) {
  const a = makeAnimal('bear'); a.pos = onGround((at || P(A.pos.x + rnd(-50, 50), A.pos.z + rnd(-50, 50))).clone()); a.home = a.pos.clone(); a.yaw = 0; a.state = 'graze'; a.t = 0; a.alive = true; a.hpCooldown = 0; a.aggro = R() < .5; a.root.position.copy(a.pos); scene.add(a.root); ANIMALS.push(a);
  return a;
}
// the world decides, a little each hour, whether anything comes for him
function threatSpawns(dtH) {
  const night = (sim.hours % 24) < 5 || (sim.hours % 24) > 21;
  if (enemyOn('risen') && night) for (const c of citizens) if (!c.alive && !c.isVega && !c.buried && !c.risen && !c.companion && c.deathPos && R() < dtH * .0025 * (cfg.after.enemies.risen === 'hordes' ? 4 : 1)) raise(c);
  const visible = (A.built.campfire ? .4 : 0) + clamp(A.inv.food / 40) * .6 + (FAC.lit ? .3 : 0);
  if (enemyOn('raiders') && aloneDays() > 15 && !HOSTILES.some(z => z.alive && z.type === 'raider') && R() < dtH * .0009 * visible) spawnRaiders(1 + Math.floor(R() * 3));
  if (enemyOn('dogs') && R() < dtH * .0006 * (night ? 2 : 1)) spawnDogs(2 + Math.floor(R() * 3));
  if (enemyOn('bears') && WORLD.season !== 'winter' && R() < dtH * .0003 && ANIMALS.filter(a => a.type === 'bear' && a.alive).length < 2) spawnBear();
}
function hostileStep(dtH) {
  const barricaded = A.barricade > 0 && A.sleepIndoors && A.beh && A.beh.kind === 'sleep' && A.beh.arrived;
  for (const z of HOSTILES) {
    if (!z.alive) continue;
    const d = z.pos.distanceTo(A.pos), sense = z.type === 'risen' ? (WEATHER.kind === 'fog' ? 14 : 28) : 70;
    let target = null;
    if (d < sense && !A.ended) target = A.pos;
    else if (z.type === 'raider') target = A.base;
    else if (!z.to || z.t > 2) { z.t = 0; z.to = P(z.pos.x + rnd(-15, 15), z.pos.z + rnd(-15, 15)); }
    z.t += dtH; target = target || z.to;
    const dd = target.clone().sub(z.pos); dd.y = 0; const dist = dd.length();
    z.moving = dist > 1.2;
    if (z.moving) { const step = Math.min(dist - 1.1, z.speed * dtH); dd.normalize(); z.pos.addScaledVector(dd, step); onGround(z.pos); z.yaw = Math.atan2(dd.x, dd.z); }
    // reaching him
    if (d < 1.6 && !A.ended) {
      z.cool = (z.cool || 0) - dtH;
      if (z.cool <= 0 && !barricaded) {
        z.cool = .4;
        if (R() < .55) { S.health = clamp(S.health - z.dmg * harm()); S.pain = clamp(S.pain + .2); spike('fear', .2); spike('anger', .15); dayNote('attacks'); A.lastHurt = sim.hours; A.hurtBy = z;
          A.bubble = { text: pick(['GET OFF!', 'NO!', 'BACK!']), cls: 'bub shout', until: performance.now() + 1600 }; }
      }
    }
    // raiders who reach his camp unopposed take what they can carry
    if (z.type === 'raider' && z.pos.distanceTo(A.base) < 4 && A.pos.distanceTo(A.base) > 20) {
      const take = Math.min(A.inv.food, 2 * dtH) + Math.min(A.inv.cans || 0, 2 * dtH);
      A.inv.food -= Math.min(A.inv.food, 2 * dtH); A.inv.cans = Math.max(0, (A.inv.cans || 0) - 2 * dtH); z.loot += take;
      if (z.loot > 8 && !z.left) { z.left = true; z.to = P(A.base.x + 120, A.base.z + 120); z.alive = false; scene.remove(z.h.root); say('They took the food. Most of it. I saw them go from the hill.', 'bad'); S.anger = clamp(S.anger + .4); S.betrayal = clamp(S.betrayal + .2); dayNote('torment'); }
    }
  }
}
function renderHostiles(dtR) {
  for (const z of HOSTILES) {
    const h = z.h; if (!z.alive) { if (z.dead && h.root.visible) { applyPose(h, pose('collapsed', 0, {}), 1 - Math.exp(-dtR * 6)); } continue; }
    h.root.position.copy(z.pos); h.root.rotation.y = z.yaw;
    const k = z.moving ? (z.type === 'risen' ? 'shamble' : 'walk') : (z.pos.distanceTo(A.pos) < 1.8 ? (z.type === 'risen' ? 'punch' : 'swing') : 'stand');
    h.phase += dtR * (z.moving ? (z.type === 'risen' ? 3 : 6) : 3);
    applyPose(h, pose(k, h.phase, { slump: z.type === 'risen' ? .5 : 0, tremor: z.type === 'risen' ? .04 : 0, amp: z.type === 'risen' ? .55 : 1 }), 1 - Math.exp(-dtR * 8));
    if (camMode !== 'map' && z.pos.distanceTo(A.pos) < 40) tag('hz' + HOSTILES.indexOf(z), z.type === 'risen' ? `${z.c.name} (risen)` : 'Raider', new THREE.Vector3(z.pos.x, z.pos.y + 2.15, z.pos.z), 'tag hostile');
  }
}
const nearestThreat = (r = 30) => {
  let best = null, bd = r;
  for (const z of HOSTILES) if (z.alive) { const d = z.pos.distanceTo(A.pos); if (d < bd) { bd = d; best = z; } }
  for (const a of ANIMALS) if (a.alive && (a.state === 'stalk' || (a.aggro && a.pos.distanceTo(A.pos) < 20))) { const d = a.pos.distanceTo(A.pos); if (d < bd) { bd = d; best = a; } }
  return best;
};
const armed = () => A.research.done.tools || A.weapon;
function strikeThreat(t, dtH) {
  const st = derived().strength, w = A.weapon === 'rifle' ? 2.2 : armed() ? 1.5 : .6;
  if (R() < dtH * 3 * st * w) {
    if (t.h) { t.hp -= rnd(.3, .6) * w; if (t.hp <= 0) { t.alive = false; t.dead = true; sfx('thud'); dayNote('wins'); S.pride = clamp(S.pride + .1);
      if (t.type === 'risen') { t.c.deathPos = t.pos.clone(); t.c.remains = null; t.c.risen = 'down'; makeRemains(t.c); t.c.found = true; t.h.root.visible = false; say((vegaC.rel.get(t.c) || 0) > .25 ? `I put ${t.c.name} down. I said sorry the whole time.` : 'It stopped moving. Finally.', 'bad'); S.guilt = clamp(S.guilt + (vegaC.rel.get(t.c) || 0) * .4); }
      else { say('The raider fell. I didn\'t want this.', 'bad'); S.guilt = clamp(S.guilt + .2); A.inv.food += t.loot || 0; } } }
    else { killAnimal(t); if (A.hurtBy === t) A.revengeAt = sim.hours; }
  }
}

// ---------- stores ----------
// Grocery shops, a supermarket, a pharmacy and a hardware store. In life people spend their wages
// there; when the fever comes the starving clear the fresh food; afterwards the tins are still on the
// shelves for whoever comes with a bag.
const STORE_KIND = {
  grocery: { label: 'Grocery', col: 0xd8cfb4, roof: 0x3e5a3a, sign: '#2e5a2e', stock: () => ({ cans: Math.floor(rnd(18, 34)), food: Math.floor(rnd(6, 12)), seeds: Math.floor(rnd(3, 7)), medicine: 1, books: 0, tools: 0 }) },
  supermarket: { label: 'Supermarket', col: 0xe4e2dc, roof: 0x55514a, sign: '#b5302a', stock: () => ({ cans: Math.floor(rnd(60, 90)), food: Math.floor(rnd(20, 30)), seeds: 10, medicine: 5, books: 3, tools: 2 }) },
  pharmacy: { label: 'Pharmacy', col: 0xdfe6e4, roof: 0x3a4a5a, sign: '#2a6a5a', stock: () => ({ cans: 2, food: 1, seeds: 0, medicine: Math.floor(rnd(10, 16)), books: 1, tools: 0 }) },
  hardware: { label: 'Hardware', col: 0xc8b89a, roof: 0x4a3a2e, sign: '#a8692a', stock: () => ({ cans: 0, food: 0, seeds: 8, medicine: 0, books: 1, tools: 4, wood: 12 }) },
};
const STORES = [];
function signBoard(text, col) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#f2efe6'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 56);
  g.fillStyle = '#f2efe6'; g.font = 'bold 34px "Syne", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text.toUpperCase(), 128, 34);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
function buildStore(v, kind, dx, dz, rotY, w, d) {
  const K = STORE_KIND[kind], rec = house(v.x + dx, v.z + dz, rotY, K.col, K.roof, w, d, 3.1, { kind: 'store', porch: false, doorX: 0 });
  rec.kind = kind;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * .7, 4), .9), new THREE.MeshStandardMaterial({ map: signBoard(K.label, K.sign), roughness: .7 }));
  sign.position.set(0, rec.F + 2.75, d / 2 + .1); rec.g.add(sign); rec.sign = sign;
  // shelves of tins inside
  const W2 = w / 2 - .5, D2 = d / 2 - .6;
  for (let r = 0; r < Math.floor(d / 1.6); r++) { const sh = new THREE.Mesh(GEO.box(w - 1.6, 1.5, .4), stdMat(0x8a8a86, .6)); sh.position.set(0, rec.F + .75, -D2 + .4 + r * 1.6); rec.inside.add(sh);
    for (let k = 0; k < 10; k++) { const can = new THREE.Mesh(GEO.cyl(.06, .06, .14, 8), stdMat(pick([0xb5302a, 0x2e5a2e, 0xd8a64a, 0x2b4a7a, 0xe0d8c4]), .5)); can.position.set(-W2 + .5 + k * (w - 2) / 10, rec.F + 1.1, -D2 + .4 + r * 1.6); rec.inside.add(can); } }
  if (kind === 'supermarket') { const lot = new THREE.Mesh(new THREE.PlaneGeometry(w + 6, 9), stdMat(0x4a4a4c, .95)); lot.rotation.x = -Math.PI / 2; rec.g.add(lot); lot.position.set(0, .04, d / 2 + 4.5); for (let k = -2; k <= 2; k++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(.08, 3), stdMat(0xe8e6dc)); ln.rotation.x = -Math.PI / 2; ln.position.set(k * 2.6, .05, d / 2 + 4.5); rec.g.add(ln); } }
  rec.g.updateMatrixWorld(true);
  const door = onGround(rec.g.localToWorld(new THREE.Vector3(0, 0, d / 2 + 1.2)));
  const st = { door, pos: P(v.x + dx, v.z + dz), v: v.i, stock: K.stock(), searched: false, store: kind, rec, label: K.label, trips: 0 };
  STORES.push(st); v.houses.push(st); HOUSES.push(st);
  return st;
}
function furnishStores(v) {
  buildStore(v, 'grocery', 0, -16.5, 0, 6, 4.4);
  if (v.i % 2 === 0) buildStore(v, 'pharmacy', 1.5, 15.5, Math.PI, 4.8, 4);
  if (v.i === 0 || v.i === 2) buildStore(v, 'hardware', 18, 2, -Math.PI / 2, 5.6, 4.4);
  if (v.i === 0) { const a = Math.atan2(FAC.z - v.z, FAC.x - v.x), r = 38, px = Math.cos(a) * r + Math.cos(a + Math.PI / 2) * 9, pz = Math.sin(a) * r + Math.sin(a + Math.PI / 2) * 9; buildStore(v, 'supermarket', px, pz, Math.atan2(-px, -pz), 12, 8); }
  v.places.store = { pos: STORES.find(s => s.v === v.i && s.store === 'grocery').door, r: 1.5 };
}
// during the collapse, the hungry strip the fresh food first; tins last
function storesDuringCollapse(dtH) {
  if (!WORLD.blight) return;
  for (const s of STORES) { s.stock.food = Math.max(0, s.stock.food - dtH * .02); if (WORLD.food < .5) s.stock.cans = Math.max(Math.floor(s.stock.cans * .5), s.stock.cans - dtH * .015); }
}
const lootValue = s => (s.stock.cans || 0) * 1 + (s.stock.food || 0) * .8 + (s.stock.medicine || 0) * 2 + (s.stock.tools || 0) * 3 + (s.stock.seeds || 0) * .5 + (s.stock.books || 0) * 1.5;

// ---------- family ----------
// A companion he trusts can become someone he loves, and someone who loves him back. Between a man and a
// woman that can mean a child. A child changes what he wants: the dead matter less than the living.
const FAMILY = { children: [], pregnant: null };
const childOf = z => z.kind === 'child';
function partnerOf() { return COMPANIONS.find(z => z.partner); }
function familyStep(dtH) {
  const P2 = partnerOf();
  // attraction to the people he lives beside grows the same way it did in the village
  for (const z of COMPANIONS) {
    if (z.kind === 'zombie' || childOf(z) || !attractedTo(vegaC, z.c)) continue;
    const near = z.pos.distanceTo(A.pos) < 6;
    z.att = clamp((z.att ?? (vegaC.att && vegaC.att.get(z.c)) ?? .1) + (near ? .004 : 0) * dtH * (1 + (A.beh && A.beh.kind === 'talk' && A.beh.extra.z === z ? 3 : 0)));
    z.attBack = clamp((z.attBack ?? (z.c.att && z.c.att.get(vegaC)) ?? .1) + (near ? .003 : 0) * dtH * (.5 + vegaC.p.agreeableness) * (S.hygiene > .4 ? 1 : .4) * (attractedTo(z.c, vegaC) ? 1 : 0));
    if (!P2 && z.att > .55 && z.attBack > .5 && !z.partner && R() < dtH * .05) {
      z.partner = true; z.since = sim.hours; S.attraction = Math.max(S.attraction, z.att); S.love = clamp(S.love + .3); S.joy = clamp(S.joy + .4); S.excite = .8; dayNote('love');
      ROOM.crush = z.c; say(`${z.c.name} took my hand tonight and didn't let go. After everything. ${z.c.name}.`, 'ev');
    }
  }
  // a pregnancy runs its course; a child is born and named
  if (FAMILY.pregnant && sim.hours >= FAMILY.pregnant.due) {
    const mom = FAMILY.pregnant.mother; FAMILY.pregnant = null;
    if (COMPANIONS.includes(mom)) birth(mom);
  }
  for (const z of COMPANIONS) if (childOf(z)) {
    z.age = (z.age || 0) + dtH / 24;
    const grow = clamp(z.age / (cfg.after.growDays || 60));
    z.h.root.scale.setScalar((.45 + .55 * grow) * z.c.look.height / 1.75);
    A.inv.food = Math.max(0, A.inv.food - .3 / 24 * dtH);
    if (A.inv.food < .5 && A.inv.cans < .5) { S.guilt = clamp(S.guilt + .01 * dtH); S.fear = clamp(S.fear + .01 * dtH); }
  }
}
function tryConceive(z) {
  if (cfg.after.family === 'off' || FAMILY.pregnant || !z.partner) return;
  const mother = vegaC.sex === 'f' ? null : (z.c.sex === 'f' ? z : null);
  if (!mother) return;
  if (R() < .22 * (S.health > .5 ? 1 : .3) * (S.hunger < .7 ? 1 : .3)) { FAMILY.pregnant = { mother, due: sim.hours + 24 * (cfg.after.gestDays || 40) }; say(`${z.c.name} told me this morning. A child. In this world. I laughed and then I couldn't stop crying.`, 'ev'); S.hope = clamp(S.hope + .4); S.joy = clamp(S.joy + .3); S.fear = clamp(S.fear + .1); dayNote('love'); }
}
function birth(mom) {
  const dead = citizens.filter(c => !c.isVega && !c.alive && (vegaC.rel.get(c) || 0) > .1).sort((a, b) => (vegaC.rel.get(b) || 0) - (vegaC.rel.get(a) || 0));
  const sex = R() < .5 ? 'f' : 'm', name = dead.length && R() < .7 ? dead[0].name : pick(sex === 'f' ? ['Hope', 'June', 'Ada', 'Iris', 'Nell'] : ['Ash', 'Rowan', 'Eli', 'Tam', 'Finn']);
  const look = Object.assign({ sex, skin: R() < .5 ? vegaC.look.skin : mom.c.look.skin, shirt: 0xe8e0c8, hair: R() < .5 ? vegaC.look.hair : mom.c.look.hair, height: 1.2, hairStyle: sex === 'f' ? 3 : 0, build: .8, child: true }, wardrobe(sex, false));
  const c = { i: 1000 + FAMILY.children.length, name, isVega: false, sex, look, alive: true, companion: true, homeVillage: vegaC.homeVillage, village: vegaC.homeVillage, rel: new Map(), p: vegaC.p, child: true };
  const h = makeHuman(look); c.h = h; scene.add(h.root);
  const z = { c, kind: 'child', h, pos: mom.pos.clone(), yaw: 0, act: null, attacks: 0, nextLine: 4, age: 0 };
  COMPANIONS.push(z); FAMILY.children.push(z); dayNote('births');
  S.hope = clamp(S.hope + .5); S.joy = clamp(S.joy + .6); S.tenderness = clamp(S.tenderness + .7); S.grief = clamp(S.grief - .25); S.loneliness = clamp(S.loneliness - .3); S.grip = clamp(S.grip + .1);
  say(dead.length && name === dead[0].name ? `A ${sex === 'f' ? 'girl' : 'boy'}. We named ${sex === 'f' ? 'her' : 'him'} ${name}, after ${name}.` : `A ${sex === 'f' ? 'girl' : 'boy'}. ${name}. Small and loud and alive.`, 'ev');
}
