
// =====================================================================
// PLAYING GOD: things you can put into his world, and what you can do to it
// =====================================================================
// Each act is only a change in his surroundings or his body. How he takes it is up to his model. He
// does notice a pattern, though: the more you intervene, the more he suspects a hand behind it.
function godAct(kind, text, cls = 'ev') {
  GOD.acts++; GOD.lastAct = sim.hours; dayNote('god');
  if (kind === 'torment') { GOD.torments++; dayNote('torment'); } if (kind === 'kind') GOD.kindness++;
  GOD.log.push({ h: sim.hours, text }); if (GOD.log.length > 30) GOD.log.shift();
  OUT.push({ h: sim.hours, text: `You: ${text}`, god: true });
  if (sim.phase === 'chamber' && S.depth > .4 && GOD.acts > 3 && R() < .35) say(pick(DEPTH_LINES.watcher), 'mind');
  feedDirty = true;
}
function roomItem(kind) {
  const g = new THREE.Group(); let pos;
  if (kind === 'knife') { const t = makeTool('knife'); t.rotation.set(Math.PI / 2, 0, .6); t.position.y = .01; g.add(t); pos = new THREE.Vector3(.6, 0, RS - .6); }
  if (kind === 'mirror') { const t = makeTool('mirror'); t.scale.setScalar(3.5); t.rotation.y = -Math.PI / 2; g.add(t); pos = new THREE.Vector3(RS - .02, 1.15, .3 * (RS - .5)); }
  if (kind === 'photo') { const t = makeTool('photo'); t.rotation.x = -Math.PI / 2 + .3; g.add(t); pos = new THREE.Vector3(-.5, .01, RS - .5); }
  if (kind === 'radio') { const b = new THREE.Mesh(GEO.box(.3, .18, .12), stdMat(0x5a4a3a, .6)); b.position.y = .09; g.add(b); const sp = new THREE.Mesh(GEO.cyl(.05, .05, .01, 12), stdMat(0x222222)); sp.rotation.x = Math.PI / 2; sp.position.set(-.07, .09, .065); g.add(sp); pos = new THREE.Vector3(-RS + .6, 0, RS - .6); }
  if (kind === 'journal') { const t = makeTool('journal'); t.scale.setScalar(1.6); g.add(t); pos = new THREE.Vector3(.3, .01, RS - .7); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.position.copy(pos); roomGroup.add(g);
  ITEMS.room[kind] = { mesh: g, pos };
}
const GOD_ROOM = [
  ['Give', [
    ['knife', 'A knife', () => { ITEMS.knife = true; roomItem('knife'); godAct('neutral', 'slid a knife through the hatch'); say('A knife on the floor. A real knife. Why would they give me this?', 'ev'); spike('surprise', .6); spike('fear', .1); }],
    ['mirror', 'A mirror', () => { ITEMS.mirror = true; roomItem('mirror'); godAct('neutral', 'fixed a mirror to the wall'); say('There is a mirror on the wall that wasn\'t there when I slept.', 'ev'); spike('surprise', .5); }],
    ['photo', 'A photograph', () => { const who = ROOM.crush || (ROOM.friends[0] && ROOM.friends[0].c); ITEMS.photo = who || { name: 'someone' }; roomItem('photo'); godAct('kind', `gave him a photograph of ${ITEMS.photo.name}`); say(`A photograph of ${ITEMS.photo.name}. Who took this? When?`, 'ev'); spike('surprise', .6); S.longing = clamp(S.longing + .2); }],
    ['rat', 'A live rat', () => { const a = makeAnimal('rat'); ITEMS.rat = { a, mesh: a.root, pos: new THREE.Vector3(0, 0, RS - .5), alive: true }; roomGroup.add(a.root); godAct('neutral', 'let a rat into the chamber'); say('Something moving by the hatch. A rat. Alive.', 'ev'); spike('surprise', .6); }],
    ['radio', 'A radio', () => { ITEMS.radio = true; roomItem('radio'); godAct('neutral', 'left a radio that only plays static'); say('A radio. Static on every station.', 'ev'); }],
    ['journal', 'A journal', () => { ITEMS.journalGiven = true; ITEMS.book = true; roomItem('journal'); godAct('kind', 'gave him a blank journal'); say('A notebook. Empty pages. I could write it all down.', 'ev'); S.hope = clamp(S.hope + .05); }],
  ]],
  ['Torment', [
    ['cold', 'Freeze the room', () => { ITEMS.cold = 36; godAct('torment', 'dropped the temperature'); say('It\'s getting cold. Colder. My breath is fog.', 'bad'); }],
    ['heat', 'Turn up the heat', () => { ITEMS.heat = 30; godAct('torment', 'turned the heat up'); say('Hot. The walls are hot to the touch.', 'bad'); }],
    ['flood', 'Flood the floor', () => { ITEMS.flood = 24; godAct('torment', 'flooded the floor'); say('Water. Coming up through the floor.', 'bad'); spike('fear', .3); }],
    ['strobe', 'Strobe the light', () => { ITEMS.strobe = 20; godAct('torment', 'set the light strobing'); say('The light is stuttering. On off on off on.', 'bad'); }],
    ['siren', 'Sound a siren', () => { ITEMS.siren = 8; godAct('torment', 'sounded a siren'); say('A siren. From every wall at once.', 'bad'); spike('fear', .4); spike('surprise', .7); }],
    ['shrink', 'Walls closing in', () => { ITEMS.shrink = 30; godAct('torment', 'moved the walls in'); say('The room is smaller. I measured it. It is smaller.', 'bad'); spike('fear', .3); }],
    ['red', 'Paint it red', () => { ITEMS.red = 48; godAct('torment', 'turned the walls red'); say('Red. Everything is red now.', 'bad'); }],
    ['drug', 'Drug his food', () => { ITEMS.drug = 14; godAct('torment', 'drugged his food'); }],
    ['poison', 'Poison his food', () => { ITEMS.poison = 18; godAct('torment', 'poisoned his food'); say('Something in the bread. My stomach is on fire.', 'bad'); }],
    ['starve', 'Stop the food', () => { ROOM.nextMeal = ROOM.hours + 72; godAct('torment', 'stopped the food for three days'); }],
    ['fake', 'Fake release', () => { fakeRelease(); godAct('torment', 'opened the door a crack, then shut it'); }],
    ['whisper', 'Whisper as someone he loves', () => { const who = ROOM.crush || (ROOM.friends[0] && ROOM.friends[0].c) || vegaC; bubble(`${NAME()}... it's me. ${who.name}.`, 'bub ghost', new THREE.Vector3(rnd(-RS, RS) * .7, RH * .6, -RS + .1), 3200); S.longing = clamp(S.longing + .2); S.grip = clamp(S.grip - .04); hallBoost('voices', .1); hallBoost('crush', .1); godAct('torment', `whispered in ${who.name}'s voice`); say(`That was ${who.name}. That was ${who.name}'s voice.`, 'mind'); }],
  ]],
  ['Mercy', [
    ['heal', 'Heal him', () => { S.health = 1; S.pain = 0; S.hands = 0; ITEMS.poison = 0; godAct('kind', 'healed him in his sleep'); say('I woke up and nothing hurts. How?', 'ev'); }],
    ['sedate', 'Sedate him', () => { S.sleep = .98; S.fear = clamp(S.fear - .4); godAct('kind', 'put a sedative in the air'); }],
    ['calm', 'Clear his head', () => { S.grip = clamp(S.grip + .2); ITEMS.drug = 0; godAct('kind', 'cleared the hallucinations'); }],
    ['ascend', 'Deepen his mind', () => { S.depth = clamp(S.depth + .2); godAct('kind', 'pushed his mind deeper'); }],
  ]],
];
function fakeRelease() {
  doorPivot.visible = true; outsideLight.visible = true; S.hope = clamp(S.hope + .45); spike('excite', .9); spike('surprise', .9);
  say('THE DOOR. The door is open. Light.', 'ev');
  setTimeout(() => { if (ROOM.released) return; doorPivot.rotation.y = 0; doorPivot.visible = false; outsideLight.visible = false; sfx('door'); S.hope = clamp(S.hope - .6); ROOM.letdown = 1; ROOM.litost = 1; S.betrayal = clamp(S.betrayal + .35); S.anger = clamp(S.anger + .4); S.grip = clamp(S.grip - .05); say('It slammed. Before I could reach it. They wanted me to see it.', 'bad'); }, reduceMotion ? 300 : 1800);
  let t0 = performance.now(); const swing = () => { if (!doorPivot.visible) return; doorPivot.rotation.y = Math.min(.35, (performance.now() - t0) / 2000); requestAnimationFrame(swing); }; swing();
}
const GOD_WORLD = [
  ['Release', [
    ['wolves', 'Wolf pack', p => { for (let i = 0; i < 3; i++) { const a = makeAnimal('wolf'); a.pos = onGround(p.clone().add(new THREE.Vector3(rnd(-3, 3), 0, rnd(-3, 3)))); a.home = a.pos.clone(); a.yaw = 0; a.state = 'graze'; a.t = 0; a.alive = true; a.hpCooldown = 0; a.aggro = true; scene.add(a.root); ANIMALS.push(a); } godAct('torment', 'set a wolf pack loose'); }, 1],
    ['dogs', 'Wild dogs', p => { spawnDogs(4, p); godAct('torment', 'set wild dogs loose'); }, 1],
    ['bear', 'A bear', p => { spawnBear(p).aggro = true; godAct('torment', 'woke a bear'); }, 1],
    ['raiders', 'Raiders', p => { spawnRaiders(3, p); godAct('torment', 'sent raiders up the road'); }, 1],
    ['risen', 'Raise the dead', p => { const dead = citizens.filter(c => !c.alive && !c.isVega && !c.buried && !c.risen && !c.companion && c.deathPos).sort((a, b) => a.deathPos.distanceTo(p) - b.deathPos.distanceTo(p)).slice(0, 5); if (!dead.length) { say('(Nobody unburied is left to raise.)', 'out'); return; } dead.forEach(raise); godAct('torment', `raised ${dead.length} of the dead`); }, 1],
    ['deer', 'A herd of deer', p => { for (let i = 0; i < 5; i++) { const a = makeAnimal('deer'); a.pos = onGround(p.clone().add(new THREE.Vector3(rnd(-6, 6), 0, rnd(-6, 6)))); a.home = a.pos.clone(); a.yaw = 0; a.state = 'graze'; a.t = 0; a.alive = true; a.hpCooldown = 0; scene.add(a.root); ANIMALS.push(a); } godAct('kind', 'sent a herd of deer'); }, 1],
    ['stranger_f', 'Send a woman', p => sendStranger('f', p), 1],
    ['stranger_m', 'Send a man', p => sendStranger('m', p), 1],
  ]],
  ['Drop', [
    ['crate', 'Supply crate', p => { dropCrate(p, { cans: 15, food: 5, medicine: 4, seeds: 4 }, 'Supply crate'); godAct('kind', 'dropped a supply crate'); }, 1],
    ['weapons', 'Weapons cache', p => { dropCrate(p, { tools: 2, rifle: 1, cans: 3 }, 'Weapons cache'); godAct('neutral', 'dropped a weapons cache'); }, 1],
  ]],
  ['Weather and disaster', [
    ['rain', 'Rain', () => { setWeather('rain', 24, true); godAct('neutral', 'brought rain'); }],
    ['storm', 'Storm', () => { setWeather('storm', 18, true); godAct('torment', 'sent a storm'); }],
    ['blizzard', 'Blizzard', () => { setWeather('blizzard', 30, true); godAct('torment', 'sent a blizzard'); }],
    ['heat', 'Heatwave', () => { setWeather('heat', 48, true); godAct('torment', 'sent a heatwave'); }],
    ['clear', 'Clear skies', () => { setWeather('clear', 24, true); godAct('kind', 'cleared the sky'); }],
    ['fire', 'Burn a house', p => burnHouse(p), 1],
    ['quake', 'Earthquake', () => { earthquake(); godAct('torment', 'shook the ground'); }],
    ['fever', 'The fever', () => { A.sickLeft = 72; A.sick++; say('Fever. Out of nowhere. Shaking.', 'bad'); godAct('torment', 'gave him the fever'); }],
    ['wells', 'Poison the wells', () => { WORLD.poisonWells = true; godAct('torment', 'poisoned every well'); }],
  ]],
  ['His mind and body', [
    ['haunt', 'Haunt him', () => { S.grip = clamp(S.grip - .18); ITEMS.drug = 8; hallBoost('ghosts', .2); godAct('torment', 'filled his head with the dead'); say('They are everywhere. All of them. Standing in the street.', 'mind'); }],
    ['trigger', 'Trigger a flashback', () => { if (!S.ptsd) S.ptsd = .3; startFlashback('watched'); godAct('torment', 'dragged him back to the room'); }],
    ['ascend', 'Deepen his mind', () => { S.depth = clamp(S.depth + .2); godAct('kind', 'pushed his mind deeper'); }],
    ['heal', 'Heal him', () => { S.health = 1; S.pain = 0; A.sickLeft = 0; godAct('kind', 'healed him'); say('The pain is gone. All of it. Overnight.', 'ev'); }],
    ['calm', 'Calm him', () => { S.fear = .1; S.ptsd = clamp((S.ptsd || 0) - .15); S.grip = clamp(S.grip + .15); godAct('kind', 'calmed him'); }],
    ['takeone', 'Take someone from him', () => { const z = pick(COMPANIONS.filter(z => !childOf(z))); if (!z) return; scene.remove(z.h.root); COMPANIONS.splice(COMPANIONS.indexOf(z), 1); z.c.alive = false; z.c.companion = false; z.c.deathPos = z.pos.clone(); z.c.remains = null; makeRemains(z.c); z.c.found = true; A.lostAt = sim.hours; S.grief = clamp(S.grief + .6); S.loneliness = clamp(S.loneliness + .3); dayNote('deaths'); say(`${z.c.name}. ${z.c.name} just... fell. In the middle of a sentence.`, 'bad'); godAct('torment', `took ${z.c.name}`); }],
  ]],
];
function dropCrate(p, stock, label) {
  const g = new THREE.Group(), box = new THREE.Mesh(GEO.box(1, .7, .7), stdMat(0x6b5a3a, .8)); box.position.y = .35; box.castShadow = true; g.add(box);
  const band = new THREE.Mesh(GEO.box(1.02, .08, .72), stdMat(0x3a3a3a)); band.position.y = .5; g.add(band);
  g.position.copy(onGround(p.clone())); scene.add(g);
  const st = { door: g.position.clone().add(new THREE.Vector3(.9, 0, 0)), pos: g.position.clone(), v: nearestVillage(p), stock: Object.assign({ cans: 0, food: 0, seeds: 0, medicine: 0, books: 0, tools: 0 }, stock), store: 'crate', label, trips: 0, searched: false, mesh: g };
  STORES.push(st); HOUSES.push(st);
  if (p.distanceTo(A.pos) < 60) { say('Something fell out of the sky. A crate. Nobody flies any more.', 'ev'); spike('surprise', .7); }
}
function sendStranger(sex, p) {
  const used = new Set(citizens.map(c => c.name)), name = (sex === 'f' ? ['Rosa', 'Liv', 'Mae', 'Sigrid', 'Ama', 'Juno'] : ['Abel', 'Marek', 'Tao', 'Idris', 'Cole', 'Lars']).find(n => !used.has(n)) || 'Stranger';
  const look = Object.assign({ sex, skin: pick(SKINS), shirt: 0x6a6a5a, hair: pick(HAIRS), height: sex === 'f' ? rnd(1.6, 1.78) : rnd(1.7, 1.9), hairStyle: sex === 'f' ? 4 : 0, build: 1 }, wardrobe(sex, false));
  const h = makeHuman(look); setGrooming(h, 20, .5); scene.add(h.root);
  const c = { i: 3000 + COMPANIONS.length, name, sex, orient: R() < .85 ? (sex === 'f' ? 'm' : 'f') : 'both', look, h, alive: true, survivor: true, rel: new Map(), homeVillage: nearestVillage(p), village: nearestVillage(p), shirt: look.shirt, pos: onGround(p.clone()), p: { agreeableness: rnd(.3, .9) } };
  used.add(name);
  const z = addCompanion(c, 'survivor'); z.att = .15; z.attBack = .2; z.stranger = true;
  S.loneliness = clamp(S.loneliness - .3); S.hope = clamp(S.hope + .3); spike('surprise', .8); S.trust = clamp(S.trust - .1);
  say(`A stranger on the road. ${name}. From somewhere past the hills. Alive.`, 'ev');
  godAct('kind', `sent ${name} to him`);
}
function burnHouse(p) {
  const b = BUILDS.filter(x => !x.burnt).sort((a, c) => a.center.distanceTo(p) - c.center.distanceTo(p))[0]; if (!b) return;
  b.burnt = true; b.wallMat.color.set(0x1e1a18); b.gMat.color.set(0x1e1a18); b.roof.visible = false; b.walls.scale.y = .55;
  const fire = new THREE.Group(); for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(rnd(.3, .7), rnd(1, 2.2), 6), new THREE.MeshBasicMaterial({ color: pick([0xff8a30, 0xffb040, 0xff6020]), transparent: true, opacity: .85 })); f.position.set(rnd(-b.w / 2, b.w / 2), b.F + .6, rnd(-b.d / 2, b.d / 2)); fire.add(f); }
  b.g.add(fire); b.fire = fire; const light = new THREE.PointLight(0xff8040, 2.5, 30, 2); light.position.set(0, 3, 0); b.g.add(light); b.fireLight = light; b.fireUntil = sim.hours + 10;
  const home = vegaC.home.rec === b;
  if (home) { A.built.shelter = false; vegaC.home.stock = { food: 0, seeds: 0, books: 0, medicine: 0, tools: 0 }; S.grief = clamp(S.grief + .3); S.anger = clamp(S.anger + .3); }
  if (b.center.distanceTo(A.pos) < 80) { say(home ? 'My house is burning. Everything I had in it.' : 'Smoke. A house is burning on the other side of the village.', 'bad'); spike('surprise', .8); spike('fear', .3); }
  godAct('torment', home ? 'burned his house' : 'burned a house');
}
function earthquake() {
  for (const b of BUILDS) if (!b.repaired && !b.burnt) { b.collapse = true; b.walls.scale.y = Math.min(b.walls.scale.y, .75); b.roof.position.y = b.F + b.h * .7; b.roof.rotation.x = rnd(-.4, .4); }
  S.fear = clamp(S.fear + .5); spike('surprise', 1); if (A.sleepIndoors && A.beh && A.beh.kind === 'sleep') { S.health = clamp(S.health - .15 * harm()); S.pain = clamp(S.pain + .4); }
  say('The ground moved. The whole world moved. Roofs coming down all over the village.', 'bad'); shake = .6;
}
// fire burns out
function godTick() {
  for (const b of BUILDS) if (b.fire && sim.hours > b.fireUntil) { b.g.remove(b.fire); b.g.remove(b.fireLight); b.fire = null; }
  for (const b of BUILDS) if (b.fire) for (const f of b.fire.children) f.scale.y = .7 + Math.random() * .6;
}

// ---------- the panels for all of this ----------
GOD.armed = null;
function buildGodPanel(el, groups) {
  el.innerHTML = groups.map(([g, tools]) => `<div class="godg"><span class="lbl dim">${g}</span><div class="god">${tools.map(([id, label, , place]) => `<button type="button" data-g="${id}"${place ? ' data-place="1"' : ''}>${label}</button>`).join('')}</div></div>`).join('') + `<p class="dim godhint" id="${el.id}Hint">${groups === GOD_WORLD ? 'Tools marked with a dot are placed: press one, then click the ground. Press it again to drop it near him.' : 'Everything you do here changes his world, not his choices.'}</p>`;
  el.onclick = e => {
    const b = e.target.closest('button[data-g]'); if (!b) return;
    const tool = groups.flatMap(([, t]) => t).find(t => t[0] === b.dataset.g); if (!tool) return;
    if (tool[3]) {
      if (GOD.armed && GOD.armed[0] === tool[0]) { const a = rnd(0, TAU), r = rnd(14, 26); tool[2](P(A.pos.x + Math.cos(a) * r, A.pos.z + Math.sin(a) * r)); GOD.armed = null; }
      else GOD.armed = tool;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', GOD.armed && x.dataset.g === GOD.armed[0]));
      $('#placeHint').hidden = !GOD.armed; if (GOD.armed) $('#placeHint').textContent = `Click the ground to place: ${GOD.armed[1].toLowerCase()}. Press Esc to cancel.`;
      return;
    }
    tool[2]();
  };
}
addEventListener('keydown', e => { if (e.key === 'Escape' && GOD.armed) { GOD.armed = null; $('#placeHint').hidden = true; document.querySelectorAll('.god button').forEach(x => x.setAttribute('aria-pressed', 'false')); } if (e.key === 'Escape') $('#atlas').hidden = true; });
function godPlace(e) {
  if (!GOD.armed || sim.phase !== 'after' || !TERRAIN.mesh) return false;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(TERRAIN.mesh)[0]; if (!hit) return false;
  GOD.armed[2](hit.point.clone()); GOD.armed = null; $('#placeHint').hidden = true; document.querySelectorAll('.god button').forEach(x => x.setAttribute('aria-pressed', 'false'));
  return true;
}

// status icons, in the manner of Project Zomboid's moodles: they appear only when something is wrong
// (or right), and darken with severity
const MOODLE_SVG = {
  hunger: '<path d="M8 4v8M6 4v4a2 2 0 0 0 4 0V4M16 4c-2 2-2 6 0 8v8M8 12v8"/>', thirst: '<path d="M12 3c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z"/>', tired: '<path d="M15 4a8 8 0 1 0 5 13A7 7 0 0 1 15 4z"/>',
  cold: '<path d="M12 3v18M4 7.5l16 9M4 16.5l16-9"/>', pain: '<path d="M13 3L6 13h5l-1 8 8-11h-5z"/>', sick: '<path d="M10 4h4v10a4 4 0 1 1-4 0z"/>', panic: '<path d="M12 4v10M12 18v1"/>',
  sad: '<circle cx="12" cy="12" r="8"/><path d="M8.5 16.5c2-2 5-2 7 0M9 10h.01M15 10h.01"/>', bored: '<circle cx="12" cy="12" r="8"/><path d="M8.5 15.5h7M9 10h.01M15 10h.01"/>', lonely: '<circle cx="12" cy="8" r="3"/><path d="M6 20c0-4 3-6 6-6s6 2 6 6"/>',
  love: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"/>', stress: '<path d="M3 12l3-5 3 10 3-10 3 10 3-10 3 5"/>', unreal: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  wet: '<path d="M7 4l-2 5M12 4l-2 5M17 4l-2 5M9 13l-2 5M14 13l-2 5"/>', scar: '<rect x="5" y="5" width="14" height="14"/><path d="M9 9h6v6H9z"/>', peace: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 12l-5.5 5.5M12 12l5.5 5.5"/>',
};
function moodles() {
  const L = (v, a, b, c, d) => v > d ? 4 : v > c ? 3 : v > b ? 2 : v > a ? 1 : 0;
  const after = sim.phase === 'after', out = [];
  const add = (k, label, lvl, good) => { if (lvl > 0) out.push({ k, label, lvl, good }); };
  add('hunger', 'Hungry', L(S.hunger, .45, .6, .75, .88)); add('thirst', 'Thirsty', L(S.thirst, .45, .6, .75, .88)); add('tired', 'Tired', L(S.sleep, .5, .65, .8, .9));
  add('cold', 'Cold', L(1 - (S.warmth ?? 1), .35, .5, .7, .85)); add('pain', 'Pain', L(S.pain, .15, .35, .55, .75)); add('sick', 'Sick', after && A.sickLeft > 0 ? 3 : ITEMS.poison > 0 ? 3 : 0);
  add('panic', 'Panic', L(S.fear, .5, .65, .8, .9)); add('stress', 'Stressed', L((S.dread || 0) * .6 + S.anger * .4, .35, .5, .65, .8)); add('sad', 'Unhappy', L(derived().despair, .35, .5, .65, .8));
  add('bored', 'Bored', L(S.boredom, .45, .6, .75, .9)); add('lonely', 'Lonely', L(S.loneliness, .45, .6, .75, .9)); add('unreal', 'Hallucinating', L(1 - S.grip, .25, .45, .65, .82));
  add('scar', 'The room', after ? L(S.ptsd || 0, .15, .3, .5, .7) : 0); add('wet', 'Wet', after && ['rain', 'storm'].includes(WEATHER.kind) ? 2 : 0);
  add('love', 'In love', L(Math.max(S.love * (S.attraction || 0) * 1.6, S.tenderness || 0), .3, .45, .6, .8), true); add('peace', 'At peace', L(equanimity(), .2, .4, .6, .8), true);
  return out;
}
function renderMoodles() {
  const el = $('#moodles'), list = sim.phase === 'chamber' || sim.phase === 'after' ? moodles() : [];
  const html = list.map(m => `<span class="moodle ${m.good ? 'good' : ''} l${m.lvl}" title="${m.label} (${m.lvl}/4)"><svg viewBox="0 0 24 24" aria-hidden="true">${MOODLE_SVG[m.k]}</svg><i>${'▲'.repeat(Math.ceil(m.lvl / 2))}</i></span>`).join('');
  if (el._h !== html) { el._h = html; el.innerHTML = html; }
}
// feelings panel and the atlas of all of them
function feelChips(words, n = 14) {
  return topFeelings(words, n).map(e => `<span title="${escapeHtml(EMO_DEF[e.w] || e.fam)}" style="border-color:${famCol(e.fam)};background:color-mix(in srgb, ${famCol(e.fam)} ${Math.round(e.v * 30)}%, transparent);font-weight:${e.v > .6 ? 650 : 500}">${escapeHtml(e.w)} ${Math.round(e.v * 100)}</span>`).join('') || '<span class="dim" style="border:0">Quiet inside.</span>';
}
let atlasWords = null;
function openAtlas(words, who) {
  atlasWords = { words, who }; $('#atlas').hidden = false; $('#atlasWho').textContent = who; renderAtlas();
}
function renderAtlas() {
  if (!atlasWords) return;
  const q = ($('#atlasQ').value || '').toLowerCase(), only = $('#atlasNow').checked;
  const list = atlasWords.words.filter(e => (!q || e.w.toLowerCase().includes(q) || e.fam.includes(q)) && (!only || e.v > .1));
  const byL = {}; for (const e of list) (byL[e.w[0].toUpperCase()] = byL[e.w[0].toUpperCase()] || []).push(e);
  $('#atlasCount').textContent = `${list.length} of ${atlasWords.words.length} feelings`;
  $('#atlasList').innerHTML = Object.keys(byL).sort().map(L => `<section><h4>${L}</h4><ul>${byL[L].map(e => `<li title="${escapeHtml(EMO_DEF[e.w] || e.fam)}"><span class="w">${escapeHtml(e.w)}</span><span class="b"><i style="width:${(e.v * 100).toFixed(0)}%;background:${famCol(e.fam)}"></i></span>${EMO_DEF[e.w] ? `<small>${escapeHtml(EMO_DEF[e.w])}</small>` : ''}</li>`).join('')}</ul></section>`).join('');
}
function mindHTML() {
  const hs = HALL.stage, motifs = Object.entries(HALL.w).filter(([k]) => k !== 'light' || equanimity() > .3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => ({ geometry: 'geometry', faces: 'faces in the walls', voices: 'voices', ghosts: 'the people he misses', food: 'food that isn\'t there', door: 'doors that aren\'t there', eyes: 'eyes', village: 'his village', crush: ROOM.crush ? ROOM.crush.name : 'someone he wants', rats: 'rats', blood: 'blood', observer: 'the watcher', light: 'light' }[k]));
  return `<div class="meters"><span class="k">Depth · ${depthStage()}</span><span class="bar"><i class="mind" style="width:${(S.depth * 100).toFixed(0)}%"></i></span><span class="v">${Math.round(S.depth * 100)}</span>`
    + `<span class="k">Equanimity</span><span class="bar"><i class="good" style="width:${(equanimity() * 100).toFixed(0)}%"></i></span><span class="v">${Math.round(equanimity() * 100)}</span>`
    + `<span class="k">Senses he suspects are watched</span><span class="bar"><i class="bad" style="width:${(watched() * 100).toFixed(0)}%"></i></span><span class="v">${Math.round(watched() * 100)}</span></div>`
    + `<p class="q">“${escapeHtml(currentQuestion())}”</p>`
    + `<p class="dim">Hallucinations: <b>${HALL_STAGES[hs]}</b>${hs >= 1 ? ` · drawn mostly from ${motifs.join(', ')}` : ''}${HALL.insight > .4 ? ' · he knows they are not real' : ''}</p>`;
}
function dayHTML() {
  const p = DAY.prev; if (!p) return '<span class="dim">His first day here. Nothing to carry over yet.</span>';
  const leans = Object.entries(p.bias).filter(([, m]) => m > 1.05).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => (ALABEL[k] || BEH_LABEL[k] || k).toLowerCase());
  const avoids = Object.entries(p.bias).filter(([, m]) => m < .95).slice(0, 3).map(([k]) => (ALABEL[k] || BEH_LABEL[k] || k).toLowerCase());
  return `<p>Day ${p.day - 1} was <b style="color:${p.valence > .15 ? 'var(--calm)' : p.valence < -.15 ? 'var(--alarm)' : 'var(--ink2)'}">${p.valence > .4 ? 'a good day' : p.valence > .15 ? 'a decent day' : p.valence > -.15 ? 'an ordinary day' : p.valence > -.4 ? 'a hard day' : 'a terrible day'}</b>.</p>`
    + (p.notes.length ? `<ul class="perceive">${p.notes.slice(0, 3).map(n => `<li><span>${escapeHtml(n.t)}</span></li>`).join('')}</ul>` : '')
    + (leans.length ? `<p class="dim">Today he leans toward ${leans.join(', ')}${avoids.length ? `, and away from ${avoids.join(', ')}` : ''}.</p>` : '');
}
function heartHTML(c) {
  if (!c || !c.att) return '';
  const crush = c.crush, partner = c.partner, admirers = citizens.filter(o => o.crush === c && o !== partner).map(o => o.name);
  const orient = { f: 'women', m: 'men', both: 'women and men' }[c.orient];
  return `<p>${partner ? `With <b>${escapeHtml(partner.name)}</b>${c.emo.love > .6 ? ', deeply in love' : ''}.` : crush ? `A crush on <b>${escapeHtml(crush.name)}</b> (${Math.round((c.att.get(crush) || 0) * 100)}).${crush.crush === c ? ' It is mutual.' : crush.partner ? ` ${escapeHtml(crush.name)} is with ${escapeHtml(crush.partner.name)}.` : ''}` : 'Nobody has caught their eye yet.'}</p>`
    + `<p class="dim">Drawn to ${orient}.${admirers.length ? ` ${admirers.join(', ')} ${admirers.length > 1 ? 'have' : 'has'} a crush on ${c.isVega ? 'him' : 'them'}.` : ''}</p>`
    + `<div class="meters">${[['Love', c.emo.love, 'civ'], ['Desire', c.emo.lust, 'civ'], ['Jealousy', c.emo.jealousy, 'bad'], ['Heartbreak', c.emo.heartbreak, 'bad']].filter(r => r[1] > .02).map(([k, v, cl]) => `<span class="k">${k}</span><span class="bar"><i class="${cl}" style="width:${(v * 100).toFixed(0)}%"></i></span><span class="v">${Math.round(v * 100)}</span>`).join('')}</div>`;
}
function ptsdHTML() {
  if (!S.ptsd) return '<span class="dim">No sign of it.</span>';
  return `<div class="meters"><span class="k">What the room left</span><span class="bar"><i class="bad" style="width:${(S.ptsd * 100).toFixed(0)}%"></i></span><span class="v">${Math.round(S.ptsd * 100)}</span></div>`
    + (PTSD.flash ? `<p style="color:var(--alarm)">Flashback now: ${escapeHtml(CUE_LINE[PTSD.flash.cue] || '')}</p>` : PTSD.lastCue ? `<p class="dim">Near a trigger: ${PTSD.lastCue.replace('_', ' ')}.</p>` : '')
    + (PTSD.symptoms.length ? `<ul class="perceive">${PTSD.symptoms.map(s => `<li><span>${s}</span></li>`).join('')}</ul>` : '');
}
function familyHTML() {
  const p = partnerOf(), kids = FAMILY.children;
  const cands = COMPANIONS.filter(z => z.kind !== 'zombie' && !childOf(z) && attractedTo(vegaC, z.c));
  let h = p ? `<p>With <b>${escapeHtml(p.c.name)}</b> ♥</p>` : cands.length ? `<p class="dim">${cands.map(z => `${escapeHtml(z.c.name)}: he ${Math.round((z.att || 0) * 100)}, back ${Math.round((z.attBack || 0) * 100)}`).join(' · ')}</p>` : '<p class="dim">Nobody he could love is with him.</p>';
  if (FAMILY.pregnant) h += `<p>${escapeHtml(FAMILY.pregnant.mother.c.name)} is expecting. ${Math.max(0, Math.ceil((FAMILY.pregnant.due - sim.hours) / 24))} days to go.</p>`;
  if (kids.length) h += `<p>${kids.map(z => `<b>${escapeHtml(z.c.name)}</b> <span class="dim">${Math.floor(z.age)} days old</span>`).join(' · ')}</p>`;
  return h;
}
function threatHTML() {
  const list = [...HOSTILES.filter(z => z.alive).map(z => [z.type === 'risen' ? `${z.c.name}, risen` : 'Raider', z.pos.distanceTo(A.pos)]), ...ANIMALS.filter(a => a.alive && (a.aggro || a.state === 'stalk')).map(a => [a.type, a.pos.distanceTo(A.pos)])].sort((a, b) => a[1] - b[1]).slice(0, 6);
  return `<p class="dim">Weather: ${WEATHER_LABEL[WEATHER.kind]}${A.barricade ? ' · his windows are boarded' : ''}${A.weapon ? ` · armed with ${A.weapon === 'rifle' ? 'a rifle' : 'an axe'}` : A.research.done.tools ? ' · armed with a spear' : ' · unarmed'}</p>`
    + (list.length ? `<ul class="perceive">${list.map(([n, d]) => `<li class="${d < 25 ? 'unreal' : ''}"><span>${escapeHtml(n)} · ${Math.round(d)} m</span></li>`).join('')}</ul>` : '<span class="dim">Nothing hunting him that he knows of.</span>');
}
