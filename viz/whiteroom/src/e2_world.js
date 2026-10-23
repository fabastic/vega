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
