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

// ---------- what his mind adds to the room ----------
const ghosts = new Map();
function ghostOf(c, parent, kind = 'ghost') {
  const key = c.i + ':' + kind;
  let g = ghosts.get(key);
  if (!g) { g = makeHuman({ skin: 0xc9c4bc, shirt: c.shirt, pants: 0x8a8a90, hair: 0x8a8a90, height: c.look.height, hairStyle: c.look.hairStyle, ghost: kind === 'ghost', shadow: kind === 'shadow' }); g.op = 0; g.want = 0; g.c = c; g.root.visible = false; g.pos = new THREE.Vector3(); ghosts.set(key, g); }
  if (parent && g.root.parent !== parent) parent.add(g.root);
  return g;
}
function buildMind() {
  memory = new THREE.Group(); mindGroup.add(memory);
  const mm = c => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false }); memMats.push(m); return m; };
  const s = RS / 3;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(RS * .95, 40), mm(0x9fb36a)); disc.rotation.x = -Math.PI / 2; disc.position.y = .01; memory.add(disc);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(RS * .45, 32), mm(0xd9cfb4)); plaza.rotation.x = -Math.PI / 2; plaza.position.y = .015; memory.add(plaza);
  const well = new THREE.Mesh(GEO.cyl(.35 * s, .4 * s, .35 * s, 14), mm(0x9a958a)); well.position.set(.6 * s, .17 * s, -.3 * s); memory.add(well);
  for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(GEO.box(.55 * s, .32 * s, .32 * s), mm([0xc0603a, 0xd8a64a, 0x6f8f4a][k])); st.position.set((-1.6 + k * .65) * s, .16 * s, -1.6 * s); memory.add(st); }
  for (const [x, z] of [[1.9, 1.5], [-1.9, 1.2]]) {
    const hw = new THREE.Mesh(GEO.box(.9 * s, .7 * s, .8 * s), mm(0xe6d9bf)); hw.position.set(x * s, .35 * s, z * s); memory.add(hw);
    const hr = new THREE.Mesh(new THREE.ConeGeometry(.75 * s, .5 * s, 4), mm(0x9a5532)); hr.position.set(x * s, .95 * s, z * s); hr.rotation.y = Math.PI / 4; memory.add(hr);
  }
  const tree = new THREE.Mesh(new THREE.ConeGeometry(.45 * s, 1.6 * s, 7), mm(0x4f7038)); tree.position.set(-.4 * s, .8 * s, 1.9 * s); memory.add(tree);
  const sunM = new THREE.Mesh(GEO.sph(.35 * s, 16, 10), mm(0xffe6a8)); sunM.position.set(0, RH * .85, 0); memory.add(sunM);
  floorGrass = new THREE.InstancedMesh(new THREE.ConeGeometry(.03, .22, 3), mm(0x6f8f3a), 360);
  for (let i = 0; i < 360; i++) { dummy.position.set(rnd(-RS + .2, RS - .2), .1, rnd(-RS + .2, RS - .2)); dummy.rotation.set(0, rnd(0, TAU), 0); dummy.scale.setScalar(rnd(.6, 1.4)); dummy.updateMatrix(); floorGrass.setMatrixAt(i, dummy.matrix); }
  mindGroup.add(floorGrass);
}

// ---------- his state, shared by the chamber and the life after ----------
const S = {};
const ROOM = {};
const EVENTS = [];
let feedDirty = false;
const say = (text, cls = 'say') => {
  if (!text) return;
  const bh = sim.phase === 'chamber' ? sim.chamberStart + ROOM.believedHours : sim.hours;
  // déjà vu: with his grip thin, a thought comes round again
  if (S.grip < .45 && cls === 'say' && EVENTS.length > 10 && Math.random() < .05) { const old = pick(EVENTS.slice(-40).filter(e => e.cls === 'say')); if (old) text = old.text + ' (Again? Didn\'t I already think this?)'; }
  EVENTS.push({ h: sim.hours, bh, text, cls });
  if (EVENTS.length > 90) EVENTS.shift();
  if (cls === 'say') { const t = sim.phase === 'chamber' ? '#rThought' : '#aThought'; const el = $(t); if (el) el.textContent = text; }
  feedDirty = true;
};
const NAME = () => vegaC.name;
const fr = () => ROOM.friends.length ? ROOM.friends[0].c.name : 'anyone';
const fr2 = () => ROOM.friends.length > 1 ? ROOM.friends[1].c.name : fr();
const homeName = () => VILL[vegaC.homeVillage].name;

function initMind() {
  const c = vegaC, n = c.needs;
  Object.assign(S, {
    hunger: Math.min(n.hunger, .35), thirst: Math.min(n.thirst, .3), sleep: Math.max(.2, n.sleep), energy: n.energy, health: n.health, pain: 0, hygiene: .9, warmth: 1,
    loneliness: clamp(.12 + (1 - c.w.social.l) * .25), boredom: .05, fear: .6, hope: .7, anger: .05, grip: 1, grief: 0, guilt: 0, nostalgia: .2, curiosity: c.p.curiosity * .6,
    shame: 0, dread: .3, pride: 0, awe: 0, love: 0, weight: 1, hands: 0, timeRate: 1, dirt: .1, daysGroomed: 0,
  });
}
function enterRoom() {
  buildChamber();
  initMind();
  const friends = topFriend(vegaC, 5).filter(([, a]) => a > .08).map(([o, a]) => ({ c: o, a }));
  S.love = friends.length ? clamp(friends[0].a * .8) : .1;
  Object.assign(ROOM, {
    hours: 0, believedHours: 0, sleeps: 0, nextMeal: 3, food: false, dark: false, darkManual: null, noise: cfg.chamber.sound === 'static', released: false, broke: false,
    seamFound: false, doorDamage: 0, stuckSaid: false, searched: [0, 0, 0, 0].map(() => new Array(6).fill(0)), tallies: 0, attempts: 0, shouts: 0, writings: 0, booksRead: 0,
    beh: null, friends, pos: new THREE.Vector3(0, 0, .3), yaw: 0, hist: [], nextHist: 0, ghostC: null, voices: 0, nextVoice: rnd(30, 70), nextFlicker: 0,
    tallyWall: 3, lastTallySleep: 0, bubble: null, whispers: [], lastLine: '', cata: 0, dead: false, thoughts: [],
  });
  roomGroup.add(vegaC.h.root); vegaC.h.root.visible = true; vegaC.h.root.position.set(0, 0, .3);
  ROOM.beh = { kind: 'wake', target: pt(0, .3, Math.PI), dur: .25, t: 0, arrived: true, extra: {} };
  vegaC.h.pose = Object.assign(basePose(), pose('lie', 0));
  doppel = makeHuman({ skin: 0x111111, shirt: 0x111111, pants: 0x111111, hair: 0x111111, height: vegaC.look.height, shadow: true }); doppel.root.visible = false; mindGroup.add(doppel.root);
  extendMind(); dayReset();
  ROOM.vis = new THREE.Vector3(0, 0, .3); ROOM.trans = null; ROOM.idle = null; ROOM.lastMealH = 0; ROOM.letdown = 0;
  say(pick(LINES.wake));
}
function mealDelay() {
  const d = ROOM.hours / 24, total = cfg.time.chamberDays, f = cfg.chamber.food;
  if (d > total - 2) return Infinity;
  if (f === 'regular') return rnd(7, 9);
  if (f === 'erratic') return rnd(4, 20);
  if (f === 'scarce') return rnd(14, 30);
  return d < total * .75 ? rnd(7, 9) : d < total * .95 ? rnd(10, 22) : Infinity;   // dwindling
}

const LINES = {
  wake: () => [`Where... This isn't ${homeName()}.`, 'White. Everything is white.', 'I was asleep in my own bed. I was.'],
  explore: () => ROOM.hours < 12 ? ['Four walls, a light, a hatch. No handle anywhere.', 'I paced it out. I counted twice.', 'The walls are smooth. Someone made this on purpose.'] : ['I know every inch of this floor.', 'Same walls. Checked them again anyway.'],
  search: () => cfg.chamber.door === 'none' ? ['No seams. Not one. How did they get me in?', 'Every wall is the same wall.'] : ['There has to be a seam. Rooms have doors.', 'Hands along the wall, inch by inch.', 'If they put me in, there is a way out.'],
  pry: () => ROOM.doorDamage >= .35 && cfg.chamber.door === 'steel' ? ['It won\'t move. It will never move.', 'Steel behind the paint. I can feel it.'] : ['Fingernails in the seam. Pull. Rest. Pull.', 'My fingers are raw. Keep going.', ROOM.doorDamage > .6 ? 'It moved. I felt it move.' : 'It has to open.'],
  pound: () => ['If I break it they have to come.', 'I hit the wall until I stopped feeling my hands.', 'LET ME OUT.'],
  shout: () => [`I called for ${fr()}. Nothing.`, 'Even the echo sounds tired.', 'I shouted until my throat went raw.'],
  pace: () => ['Wall. Turn. Wall. Turn.', 'Moving helps. Standing still is worse.', 'I counted four thousand steps. Today, or yesterday.'],
  exercise: () => ['Push-ups until my arms shake. Something I can still control.', 'If I stay strong, I can get out when it opens.'],
  tally: () => [`Another mark. Day ${ROOM.sleeps + 1}, I think.`, 'A line every time I wake up. The only clock I have.'],
  write: () => ['I wrote it on the wall so I would remember.', 'Words on the wall. Something in here that is mine.'],
  sit_hug: () => ['Knees up. Make myself small.', 'Nobody is coming.', `I miss the plaza in ${homeName()}. The noise. ${fr()} laughing at nothing.`, 'I keep thinking about bread from the market.'],
  rock: () => ['Back and forth. Back and forth.', 'If I keep moving I am still here.'],
  sleep: () => ROOM.dark ? ['Dark at last. I can sleep.'] : ['The light never goes off. I sleep anyway, badly.', 'Eyes shut. It is still white behind them.'],
  remember: () => [`I walk through ${homeName()} in my head. The well. The stalls. ${fr()}'s door.`, 'If I close my eyes I can smell the market.', `I made ${fr()} laugh once by falling off the well. I go back there.`],
  read: () => ['Reading the same book again. I know the ending. I read it anyway.', 'Words someone else wrote. Proof there is an outside.', 'I read slowly now. There is no hurry.'],
  toilet: () => ['At least they gave me that.', 'I keep myself clean. It matters. It matters.'],
  talk_ghost: () => { const g = ROOM.ghostC ? ROOM.ghostC.name : fr(); return [`${g} is here. ${g} says it will be all right.`, `I told ${g} about the hatch. ${g} just listened.`, `${g} came. I knew ${g} would come.`, `${g} won't say how they got in.`]; },
  stare: () => ['The white goes on forever if you look long enough.', 'I can\'t remember what colour the market stalls were.', 'Who am I talking to?'],
  jump: () => ['Maybe the ceiling is softer.', 'Can\'t reach it. Can\'t reach anything.'],
  eat: () => ROOM.hours < 48 ? ['Food. So someone knows I\'m here.', 'Someone is out there. Someone made this bread.'] : ['They feed me like an animal.', 'I ate all of it. I don\'t know when the next one comes.'],
  panic: () => ['My heart won\'t slow down.', 'Something is wrong with the room. With me.', 'Breathe. Breathe.'],
  lowgrip: () => ['The walls are breathing.', 'Did the hatch just move?', `I can hear the plaza. I can't hear the plaza.`, 'There were more of me yesterday.', 'Someone wrote on the wall. It was me.'],
  meditate: () => S.depth > .5 ? ['Breathing. Only breathing.', 'I let the room be the room.'] : ['Sit still. Breathe. Like they say.', 'I tried to empty my head. It filled up with the walls.'],
  philosophize: () => [depthThought()],
  knock: () => ['Three knocks from the other side of the wall. I knocked back.', 'Someone is knocking. Knock, knock, knock.', 'I answered the knocking. It stopped.'],
  phantom: () => ['The tray. Full. Bread and water. I reached for it and', 'Food on the tray. I saw it. I saw it.'],
  false_door: () => ['A door. There is a door in that wall now. I can see the handle.', 'It was a door a moment ago.'],
  mirror: () => S.grip < .4 ? ['The man in the mirror is not me. He is thinner. He is smiling.', 'I don\'t know that face.'] : ['I look terrible. I look like my father.', 'Still me. Still me.'],
  photo: () => [`${ITEMS.photo ? ITEMS.photo.name : fr()}, smiling at something out of frame.`, `I talk to the photo of ${ITEMS.photo ? ITEMS.photo.name : fr()}. I tell them about my day.`],
  rat: () => ['The rat lets me touch it now. I named it.', 'Something alive in here. Something that isn\'t me.'],
  eat_rat: () => ['I\'m sorry. I\'m sorry. I was so hungry.'],
  radio: () => ['Static. Then, for a second, music.', 'I turned the dial all the way round. Static all the way round.'],
  watch: () => [pick(DEPTH_LINES.watcher), 'I looked straight at the camera. Whoever you are.', 'Are you writing this down? Write this down.'],
  dissolve: () => ['There are no walls. There never were walls.', 'I am standing in the white and it goes on.', 'The other one is back. He does what I do.'],
};
const SHOUTS = () => S.grip < .4 ? [`${fr()}!`, 'I CAN HEAR YOU', 'STOP WATCHING ME'] : ['HELLO?', 'IS ANYONE THERE?', 'LET ME OUT!', `${fr().toUpperCase()}!`, 'PLEASE!'];
const SCRAWLS = () => S.grip < .35
  ? ['WHO AM I', 'THEY ARE WATCHING', `${fr2().toUpperCase()} WAS HERE`, 'THE WALLS LIE', 'NOT REAL', `${NAME().toUpperCase()} ${NAME().toUpperCase()}`]
  : ['LET ME OUT', `I AM ${NAME().toUpperCase()}`, 'I AM STILL HERE', fr().toUpperCase(), 'WHERE IS EVERYONE', 'DAY ?', 'HELP', homeName().toUpperCase()];
function line(src, alone) {
  let arr = typeof src === 'function' ? src() : src;
  if (!arr || !arr.length) return null;
  if (!alone && S.grip < .45 && R() < .3) arr = S.grip < .16 ? LINES.dissolve() : LINES.lowgrip();
  let l = pick(arr); if (l === ROOM.lastLine) l = pick(arr); ROOM.lastLine = l; return l;
}
function bubble(text, cls, pos, ms = 3000) { ROOM.bubble = { text, cls, pos, until: performance.now() + ms }; }

const BEH_LABEL = {
  wake: 'Waking up', explore: 'Exploring the chamber', search: 'Searching the walls for a seam', pry: 'Prying at the door seam', pound: 'Pounding the wall',
  shout: 'Shouting for help', pace: 'Pacing', exercise: 'Exercising', tally: 'Scratching a tally mark', write: 'Writing on the wall', sit_hug: 'Curled up in a corner', rock: 'Rocking',
  sleep: 'Sleeping', remember: 'Walking through his village in his head', read: 'Reading', toilet: 'Washing up', talk_ghost: 'Talking to someone who isn\'t there',
  stare: 'Staring at the wall', meditate: 'Meditating', philosophize: 'Writing his thoughts on the wall', knock: 'Answering knocks only he hears', phantom: 'Reaching for food that isn\'t there',
  false_door: 'Trying a door that isn\'t there', mirror: 'Looking in the mirror', photo: 'Holding the photograph', rat: 'With the rat', eat_rat: 'Eating the rat', radio: 'Listening to the radio', watch: 'Talking to whoever watches', flashback: 'Back in the room, in his head', jump: 'Jumping for the ceiling', eat: 'Eating from the hatch', panic: 'Panicking', escape: 'Walking out', catatonic: 'Unresponsive', dead: 'Dead',
};
function derived() {
  const p = vegaC.p, v = vegaC.v;
  const despair = clamp(.45 * (1 - S.hope) + .15 * S.loneliness + .2 * (1 - S.grip) + .2 * S.grief + .1 * S.guilt);
  const escape = clamp(.22 + .25 * v.freedom + .2 * p.independence + .3 * S.anger + .35 * S.hope - .45 * despair - .2 * (1 - S.grip) + (ROOM.seamFound && ROOM.doorDamage < .35 ? .15 : 0) - (ROOM.doorDamage >= .35 && cfg.chamber.door === 'steel' ? .25 : 0));
  const novelty = Math.exp(-(ROOM.hours || 0) / 14);
  const apathy = clamp(despair * S.boredom * 1.4);
  return { despair, escape, novelty, apathy, slump: clamp(despair * .8 + (1 - S.energy) * .3 + (1 - S.health) * .3), strength: clamp(.25 + .75 * Math.min(S.energy, S.health) * S.weight) };
}
function chooseBehaviour() {
  const p = vegaC.p, D = derived(), C = cfg.chamber;
  if (ROOM.cata > 24) return startBehaviour('catatonic');
  const U = {
    eat: ROOM.food ? Math.max(S.hunger, S.thirst) * 2.2 + .35 : 0,
    sleep: Math.pow(S.sleep, 1.5) * 2.1 + (S.energy < .2 ? 1 : 0) + (ROOM.dark ? .35 : 0),
    explore: D.novelty * (.6 + p.openness * .6),
    search: ROOM.seamFound || C.door === 'none' && ROOM.hours > 72 ? .05 : D.escape * (.4 + S.hope) * .9,
    pry: ROOM.seamFound ? D.escape * (.6 + p.persistence) * (ROOM.doorDamage >= .35 && C.door === 'steel' ? .3 : 1) : 0,
    pound: S.anger * 1.2 + D.escape * .2,
    shout: S.loneliness * S.hope * .9 + S.fear * .15,
    pace: S.boredom * .6 + S.fear * .3,
    exercise: S.energy > .5 ? S.boredom * .35 + p.conscientiousness * .25 + S.hope * .15 : 0,
    tally: ROOM.sleeps > ROOM.lastTallySleep ? (.4 + p.conscientiousness) * 1.1 : 0,
    write: (D.despair > .45 || S.grip < .6 ? .35 : 0) + S.anger * .15 + (S.grip < .4 ? .2 : 0),
    sit_hug: D.despair * .85 + S.fear * .35,
    rock: (1 - S.grip) * D.despair * 1.3,
    remember: S.nostalgia * .9 + S.loneliness * .2,
    read: FURN.books ? S.boredom * .9 + p.curiosity * .35 : 0,
    toilet: FURN.toilet ? (1 - S.hygiene) * 1.3 : 0,
    talk_ghost: S.grip < .58 && ROOM.friends.length ? S.loneliness * (1 - S.grip) * 1.6 : 0,
    stare: (1 - S.grip) * .55 + D.apathy * .5 * (ROOM.hours > 48 ? 1 : 0),
    jump: D.escape * .22 * (ROOM.hours < 40 ? 1 : .2),
    panic: S.fear > .65 ? (S.fear - .5) * 1.4 : 0,
    meditate: S.depth > .12 ? (S.depth * .9 + equanimity() * .4 + (S.fear > .5 ? .15 : 0)) * (1 - S.hunger * .5) : 0,
    philosophize: S.depth > .3 ? S.depth * .45 : 0,
    knock: HALL.stage >= 2 && viewMode ? HALL.w.voices * .35 : 0,
    phantom: HALL.stage >= 3 && S.hunger > .6 && !ROOM.food ? HALL.w.food * .9 : 0,
    false_door: HALL.stage >= 3 && HALL.fakeDoor ? HALL.w.door * D.escape * .9 : 0,
    mirror: ITEMS.mirror ? .12 + (1 - S.grip) * .3 + S.shame * .2 : 0,
    photo: ITEMS.photo ? S.loneliness * .7 + S.longing * .5 : 0,
    rat: ITEMS.rat && ITEMS.rat.alive ? .15 + S.loneliness * .5 : 0,
    eat_rat: ITEMS.rat && ITEMS.rat.alive && S.hunger > .82 && !ROOM.food ? (S.hunger - .6) * 3 : 0,
    radio: ITEMS.radio ? S.boredom * .6 + S.loneliness * .2 : 0,
    watch: watched() > .25 || (S.grip < .35 && S.fear > .4) ? watched() * .8 + (1 - S.grip) * .2 : 0,
  };
  if (ITEMS.journalGiven || ITEMS.book) U.read = Math.max(U.read, S.boredom * .9 + p.curiosity * .35);
  const F = emoFamilies(S, vegaCtx());
  let best = 'pace', bv = -1;
  for (const k in U) { if (!U[k]) continue; const u = U[k] * feelBias(F, k) * dayBias(k) + R() * .22; if (u > bv) { bv = u; best = k; } }
  startBehaviour(best);
}
function startBehaviour(kind) {
  let target = pt(ROOM.pos.x, ROOM.pos.z, ROOM.yaw), dur = 1;
  const extra = {}, randWall = () => Math.floor(R() * 4);
  switch (kind) {
    case 'eat': target = pt(0, RS - .85, 0); dur = .5; break;
    case 'sleep': target = FURN.bed ? FURN.bed : (R() < .5 ? pick(CORNERS) : pt(rnd(-1, 1), rnd(-1, 1), rnd(0, TAU))); dur = 9; break;
    case 'explore': { const w = randWall(); target = wallSpot(w, rnd(-1, 1)); dur = rnd(.4, .9); break; }
    case 'search': {
      let bw = 0, bs = 0, bv = Infinity;
      for (let w = 0; w < 4; w++) for (let s = 0; s < 6; s++) { const v = ROOM.searched[w][s] + R() * .4; if (v < bv) { bv = v; bw = w; bs = s; } }
      target = wallSpot(bw, (bs + .5) / 3 - 1, .45); dur = rnd(.8, 1.6); extra.wall = bw; extra.seg = bs; break;
    }
    case 'pry': target = pt(DOOR.x, -RS + .45, Math.PI); dur = rnd(1, 2.2); ROOM.attempts++; break;
    case 'pound': target = ROOM.seamFound && R() < .6 ? pt(DOOR.x + rnd(-.3, .3), -RS + .55, Math.PI) : wallSpot(randWall(), rnd(-.9, .9), .55); dur = rnd(.25, .6); ROOM.attempts++; break;
    case 'shout': target = pt(rnd(-1, 1) * RS * .3, rnd(-1, 1) * RS * .3, rnd(0, TAU)); dur = rnd(.2, .45); ROOM.shouts++; break;
    case 'pace': case 'exercise': { const a = RS - 1.2, ax = R() < .5; extra.a = ax ? pt(-a, rnd(-a, a) * .7, 0) : pt(rnd(-a, a) * .7, -a, 0); extra.b = ax ? pt(a, extra.a.z, 0) : pt(extra.a.x, a, 0); target = extra.a; dur = rnd(.8, 1.8); if (kind === 'exercise') { target = pt(rnd(-.5, .5), rnd(-.5, .5), rnd(0, TAU)); extra.a = null; } break; }
    case 'tally': target = wallSpot(ROOM.tallyWall, -.75, .5); dur = .25; break;
    case 'write': { const w = randWall(); target = wallSpot(w, rnd(-.85, .85), .5); dur = .35; extra.wall = w; break; }
    case 'sit_hug': case 'rock': case 'remember': target = pick(CORNERS); dur = rnd(1.2, 3.5); break;
    case 'read': target = FURN.books; dur = rnd(1.5, 3); ROOM.booksRead++; break;
    case 'toilet': target = FURN.toilet; dur = .4; break;
    case 'talk_ghost': { const f = ROOM.friends[Math.floor(Math.pow(R(), 1.6) * ROOM.friends.length)]; ROOM.ghostC = f.c; target = pt(rnd(-1, 1) * RS * .3, rnd(-1, 1) * RS * .3, 0); dur = rnd(.8, 2); break; }
    case 'stare': target = wallSpot(randWall(), rnd(-.8, .8), .38); dur = rnd(1, 3); break;
    case 'jump': target = pt(rnd(-.4, .4), rnd(-.4, .4), rnd(0, TAU)); dur = .3; ROOM.attempts++; break;
    case 'panic': dur = rnd(.25, .5); break;
    case 'catatonic': target = pick(CORNERS); dur = 48; break;
    case 'meditate': target = R() < .5 ? pt(rnd(-.4, .4), rnd(-.4, .4), rnd(0, TAU)) : pick(CORNERS); dur = rnd(1, 3); break;
    case 'philosophize': { const w = randWall(); target = wallSpot(w, rnd(-.85, .85), .5); dur = .5; extra.wall = w; break; }
    case 'knock': { const w = randWall(); target = wallSpot(w, rnd(-.8, .8), .5); dur = .3; break; }
    case 'phantom': target = pt(0, RS - .85, 0); dur = .35; break;
    case 'false_door': { const fd = HALL.fakeDoor; target = wallSpot(fd.wall, (fd.u * 2 - 1) * .95, .5); dur = .5; break; }
    case 'mirror': target = wallSpot(1, .3, .55); dur = rnd(.3, 1); break;
    case 'photo': case 'radio': target = pick(CORNERS); dur = rnd(.6, 1.6); break;
    case 'rat': case 'eat_rat': target = pt(ITEMS.rat.pos.x + .5, ITEMS.rat.pos.z, -Math.PI / 2); dur = kind === 'rat' ? rnd(.5, 1.2) : .4; break;
    case 'watch': { const cx = RS - .25, cz = RS - .25, x = cx - 1.4, z = cz - 1.4; target = pt(x, z, Math.atan2(cx - x, cz - z)); dur = rnd(.3, .8); break; }
  }
  if (kind === 'exercise') extra.ex = pick(['pushup', 'squat', 'jump', 'pushup']);
  ROOM.beh = { kind, target, dur, t: 0, arrived: false, extra };
  if (R() < .7 && LINES[kind]) say(line(LINES[kind]));
  if (kind === 'catatonic') say('He has stopped reacting to anything.', 'bad');
  if (kind === 'shout') bubble(pick(SHOUTS()), 'bub shout', null, 2600);
  if (kind === 'talk_ghost') { const g = ghostOf(ROOM.ghostC, mindGroup); g.want = 1; const a = rnd(0, TAU); g.root.position.set(clamp(target.x + Math.cos(a) * 1.3, -RS + .5, RS - .5), 0, clamp(target.z + Math.sin(a) * 1.3, -RS + .5, RS - .5)); }
}

function wallMark(i, x, z, y, fn) { const [px, py] = wallPx(wallUV(i, x, z), y); WALLS[i].g.save(); fn(WALLS[i].g, px, py); WALLS[i].g.restore(); WALLS[i].tex.needsUpdate = true; }
function addTally() {
  const n = ROOM.tallies++, grp = Math.floor(n / 5), k = n % 5;
  const sp = wallSpot(ROOM.tallyWall, -.95, 0), u0 = wallUV(ROOM.tallyWall, sp.x, sp.z) * 1024 - 60, g = WALLS[ROOM.tallyWall].g;
  const col = Math.floor(grp / 8), row = grp % 8, x = u0 + col * 52 + k * 7, y = 100 + row * 36;
  g.strokeStyle = 'rgba(40,40,38,.75)'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
  if (k < 4) { g.moveTo(x + rnd(-1, 1), y); g.lineTo(x + rnd(-2, 2), y + 26); } else { g.moveTo(x - 30, y + 22); g.lineTo(x + 4, y + 4); }
  g.stroke(); WALLS[ROOM.tallyWall].tex.needsUpdate = true;
}
function addScrawl(i, given) {
  const text = given || pick(SCRAWLS());
  // writing goes where there is still room on the wall, nearest to where he stands
  ROOM.slots = ROOM.slots || [0, 1, 2, 3].map(w => w === ROOM.tallyWall ? [0, 4, 8] : []);
  const used = ROOM.slots[i], cols = 4, rows = 3, u0 = wallUV(i, ROOM.pos.x, ROOM.pos.z);
  let best = null, bd = 1e9;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (used.includes(r * cols + c)) continue; const d = Math.abs((c + .5) / cols - u0) + r * .05; if (d < bd) { bd = d; best = [r, c]; } }
  if (!best) { best = [Math.floor(R() * rows), Math.floor(R() * cols)]; } else used.push(best[0] * cols + best[1]);
  const px0 = (best[1] + .5) / cols * 1024, py0 = (1 - (1.95 - best[0] * .32) / RH) * 512;
  { const g = WALLS[i].g; g.save();
    g.translate(px0 + rnd(-20, 20), py0 + rnd(-6, 6)); g.rotate(rnd(-.08, .08));
    g.font = `${Math.round((given ? 26 : rnd(38, 56)) * 3 / RS)}px "Reenie Beanie", cursive`; g.textAlign = 'center';
    g.fillStyle = S.hands > .3 ? 'rgba(120,40,30,.7)' : 'rgba(40,40,38,.78)'; g.fillText(text, 0, 0);
    g.restore(); WALLS[i].tex.needsUpdate = true; }
  ROOM.writings++;
}
function addSmear(i) {
  const p = ROOM.pos;
  wallMark(i, p.x + rnd(-.15, .15), p.z + rnd(-.15, .15), rnd(1.2, 1.55), (g, px, py) => {
    const r = rnd(8, 16), gr = g.createRadialGradient(px, py, 1, px, py, r);
    gr.addColorStop(0, `rgba(130,38,28,${.25 + S.hands * .3})`); gr.addColorStop(1, 'rgba(130,38,28,0)');
    g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2);
  });
}

function lightsOn() {
  if (ROOM.released) return false;
  if (ROOM.darkManual != null) return !ROOM.darkManual;
  const L = cfg.chamber.light, hour = sim.hours % 24;
  if (L === 'dark') return false;
  if (L === 'cycle') return hour >= 7 && hour < 21;
  if (L === 'flicker') return ROOM.flickOn !== false;
  return true;
}
function observerVoice() {
  const V = cfg.chamber.voice;
  const kind = V === 'both' ? (R() < .5 ? 'kind' : 'cruel') : V;
  const f = fr();
  const text = kind === 'kind'
    ? pick([`${NAME()}, you're doing well. It won't be long.`, 'We know this is hard. Keep eating.', `${NAME()}. Hold on. Someone is coming.`])
    : pick(['Nobody is looking for you.', `${f} asked us to keep you here.`, `They held a funeral for you in ${homeName()}.`, 'You volunteered for this. Don\'t you remember?']);
  bubble(text, 'bub voice', new THREE.Vector3(0, RH - .5, 0), 3600); sfx('voice');
  ROOM.voices++;
  dayNote(kind === 'kind' ? 'voiceKind' : 'voiceCruel'); spike('surprise', .5);
  if (kind === 'cruel' && /asked us|volunteered/.test(text)) S.betrayal = clamp(S.betrayal + .25);
  if (kind === 'kind') { S.hope = clamp(S.hope + .15 * Math.pow(.85, ROOM.voices)); S.loneliness = clamp(S.loneliness - .15); S.grip = clamp(S.grip + .03); say('A voice. A real voice, from somewhere.', 'ev'); }
  else { S.hope = clamp(S.hope - .1); S.anger = clamp(S.anger + .2); S.grip = clamp(S.grip - .03); S.guilt = clamp(S.guilt + .05); say(`The voice said: "${text}"`, 'bad'); }
}

function roomStep(dtH) {
  const p = vegaC.p, v = vegaC.v, r = vegaC.rates, C = cfg.chamber;
  ROOM.hours += dtH;
  if (!ROOM.released && ROOM.hours >= cfg.time.chamberDays * 24) release(false);
  if (ROOM.released || ROOM.dead) return;
  if (C.light === 'flicker' && ROOM.hours >= ROOM.nextFlicker) { ROOM.flickOn = !(ROOM.flickOn !== false); ROOM.nextFlicker = ROOM.hours + rnd(1, 10); }
  ROOM.dark = !lightsOn();
  if (C.voice !== 'none' && ROOM.hours >= ROOM.nextVoice) { observerVoice(); ROOM.nextVoice = ROOM.hours + rnd(36, 110); }
  if (C.sound === 'voices' && R() < dtH * .04) { const f = pick(ROOM.friends.length ? ROOM.friends : [{ c: vegaC }]).c; bubble(`${NAME()}...?`, 'bub ghost', new THREE.Vector3(rnd(-RS, RS) * .8, RH * .6, -RS + .1), 2200); S.loneliness = clamp(S.loneliness + .03); S.grip = clamp(S.grip - .006); if (R() < .4) say(`That was ${f.name}'s voice. It came from the wall.`, 'mind'); }
  const b = ROOM.beh, sleeping = b && b.kind === 'sleep' && b.arrived;
  moodStep(dtH, {}); depthStep(dtH, b && b.arrived ? b.kind : ''); hallStep(dtH); dayTrack(dtH, {});
  chamberHazards(dtH, sleeping);
  ROOM.letdown = Math.max(0, (ROOM.letdown || 0) - dtH * .3); ROOM.litost = Math.max(0, (ROOM.litost || 0) - dtH * .2);
  S.timeRate = clamp(S.timeRate + (R() - .5) * .3 * dtH, .45, 1.8);
  ROOM.believedHours += dtH * (sleeping ? 2.2 : (C.light === 'cycle' ? 1 : S.timeRate));
  if (!ROOM.food && ROOM.hours >= ROOM.nextMeal) deliverFood();
  S.hunger = clamp(S.hunger + r.hunger * dtH * (sleeping ? .5 : 1));
  S.thirst = clamp(S.thirst + r.thirst * dtH * (sleeping ? .4 : 1));
  if (!sleeping) { S.sleep = clamp(S.sleep + r.sleep * dtH * (S.fear > .6 ? 1.3 : 1)); S.energy = clamp(S.energy - .035 * dtH); }
  S.hygiene = clamp(S.hygiene - .006 * dtH); S.dirt = 1 - S.hygiene;
  S.pain = clamp(S.pain * Math.exp(-.05 * dtH)); S.hands = clamp(S.hands - .01 * dtH);
  const floor = C.canDie ? 0 : .25;
  S.health = clamp(Math.max(floor, S.health - ((S.hunger > .85 ? .022 : 0) + (S.thirst > .9 ? .045 : 0) + S.pain * .008 + (S.hygiene < .1 ? .002 : 0)) * dtH + (S.hunger < .6 && S.thirst < .6 ? .004 * dtH : 0)));
  if (S.health <= 0) { ROOM.dead = true; ROOM.beh = { kind: 'dead', target: pt(ROOM.pos.x, ROOM.pos.z, ROOM.yaw), dur: 1e9, t: 0, arrived: true, extra: {} }; say('...', 'bad'); showEnding('chamber'); return; }
  if (S.hunger > .6) S.weight = clamp(S.weight - .006 * dtH, .5, 1); else S.weight = clamp(S.weight + .002 * dtH, .5, 1);
  const D = derived(), stab = 1.4 - p.emotional_stability, sleepDebt = Math.max(0, S.sleep - .6);
  const books = FURN.books ? .7 : 1, hum = C.sound === 'hum' ? 1.15 : 1, silence = C.sound === 'silence' ? 1.1 : 1;
  S.loneliness = clamp(S.loneliness + .0008 * (.4 + p.extraversion) * (.6 + v.community) * dtH);
  S.boredom = clamp(S.boredom + .0016 * (.4 + p.openness) * (1 - D.novelty) * dtH * books * silence - (ROOM.noise ? .006 * dtH : 0));
  const fearT = clamp(.12 + (1 - p.emotional_stability) * .3 + D.novelty * .3 + (S.hunger > .7 ? .2 : 0) + (ROOM.dark ? .25 * (1.2 - S.grip) : 0) + (ROOM.noise ? .15 : 0) + (1 - S.grip) * .25);
  S.fear = clamp(S.fear + (fearT - S.fear) * .12 * dtH);
  S.dread = clamp(S.dread + ((S.fear * .6 + (1 - S.hope) * .4) - S.dread) * .02 * dtH);
  S.hope = clamp(S.hope - .0005 * (1.3 - p.persistence) * dtH);
  S.anger = clamp(S.anger - .03 * S.anger * dtH);
  S.nostalgia = clamp(S.nostalgia + (.0012 * S.loneliness - .0004) * dtH);
  S.shame = clamp(S.shame + ((1 - S.hygiene) * .5 - S.shame) * .02 * dtH);
  S.pride = clamp(S.pride - .01 * S.pride * dtH);
  S.curiosity = clamp(S.curiosity + ((vegaC.p.curiosity * .6 * (1 - D.apathy)) - S.curiosity) * .01 * dtH);
  S.grip = clamp(S.grip - (.00008 + .0002 * S.loneliness + .00026 * sleepDebt + .00012 * S.boredom + (ROOM.noise ? .002 : 0) + (ROOM.dark ? .0002 : 0) + (S.hunger > .8 ? .0005 : 0) + (S.hygiene < .15 ? .00012 : 0)) * stab * dtH * hum * books * (1 - .45 * equanimity()) * (ITEMS.drug > 0 ? 2.5 : 1) * (1 + (ITEMS.strobe > 0 ? .8 : 0) + (ITEMS.siren > 0 ? .5 : 0)));
  if (S.grip < .03 && D.despair > .85) ROOM.cata += dtH; else if (ROOM.cata < 24) ROOM.cata = 0;
  S.daysGroomed = ROOM.hours / 24;

  if (!b || b.t >= b.dur || (b.kind !== 'eat' && b.kind !== 'catatonic' && ROOM.food && Math.max(S.hunger, S.thirst) > .55 && b.kind !== 'sleep') || (b.kind === 'sleep' && b.arrived && S.sleep < .06)) {
    if (b && b.kind === 'sleep' && b.arrived) wokeUp();
    if (b && b.kind === 'talk_ghost') { const g = ghosts.get(ROOM.ghostC.i + ':ghost'); if (g) g.want = 0; }
    chooseBehaviour();
    return;
  }
  if (!b.arrived) {
    if (speed >= 60 || sim.skipTo != null) { ROOM.pos.set(b.target.x, 0, b.target.z); ROOM.yaw = b.target.yaw; b.arrived = true; }
    else return;
  }
  b.t += dtH;
  if (b.kind === 'eat' && ROOM.food && b.t > b.dur * .5) { ROOM.food = false; tray.visible = false; S.hunger = clamp(S.hunger - .55); S.thirst = clamp(S.thirst - .8); if (R() < .5) say(line(LINES.eat)); }
  if (b.kind === 'tally' && !b.done) { b.done = true; addTally(); ROOM.lastTallySleep = ROOM.sleeps; }
  if (b.kind === 'write' && !b.done) { b.done = true; addScrawl(b.extra.wall); }
  const st = D.strength;
  switch (b.kind) {
    case 'explore': S.boredom = clamp(S.boredom - .12 * dtH); break;
    case 'search': {
      ROOM.searched[b.extra.wall][b.extra.seg] += dtH;
      S.boredom = clamp(S.boredom - .03 * dtH);
      const doorSeg = C.door !== 'none' && b.extra.wall === 0 && Math.abs(((b.extra.seg + .5) / 3 - 1) * (RS - .5) - DOOR.x) < .9;
      if (doorSeg && !ROOM.seamFound && R() < dtH * .45 * (.5 + p.conscientiousness)) foundSeam();
      else S.hope = clamp(S.hope - .0025 * dtH);
      break;
    }
    case 'pry': {
      const cap = C.door === 'breakable' ? 1 : .35;
      ROOM.doorDamage = Math.min(cap, ROOM.doorDamage + dtH * (C.door === 'breakable' ? .012 : .03) * st * (.6 + p.persistence));
      S.pain = clamp(S.pain + .03 * dtH); S.hands = clamp(S.hands + .04 * dtH); S.anger = clamp(S.anger + .02 * dtH);
      if (C.door === 'breakable' && ROOM.doorDamage >= 1) return release(true);
      if (ROOM.doorDamage >= .35 && C.door === 'steel') { S.hope = clamp(S.hope - .012 * dtH); if (!ROOM.stuckSaid) { ROOM.stuckSaid = true; say('The paint is gone. Under it is steel. It will never move.', 'bad'); } }
      if (C.door === 'breakable' && ROOM.doorDamage > .5) S.hope = clamp(S.hope + .01 * dtH);
      if (R() < dtH * .8) wallMark(0, DOOR.x - DOOR.w / 2 + rnd(-.02, .02), 0, rnd(.9, 1.5), (g, px, py) => { g.strokeStyle = 'rgba(110,40,30,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, py); g.lineTo(px + rnd(-3, 3), py + rnd(8, 20)); g.stroke(); });
      break;
    }
    case 'pound': S.hope = clamp(S.hope - .006 * dtH); S.anger = clamp(S.anger - .15 * dtH); break;
    case 'shout': S.loneliness = clamp(S.loneliness + .004 * dtH); S.hope = clamp(S.hope - .008 * dtH); S.anger = clamp(S.anger + .03 * dtH); break;
    case 'pace': S.boredom = clamp(S.boredom - .1 * dtH); S.fear = clamp(S.fear - .05 * dtH); break;
    case 'exercise': S.boredom = clamp(S.boredom - .08 * dtH); S.energy = clamp(S.energy - .05 * dtH); S.pride = clamp(S.pride + .02 * dtH); S.grip = clamp(S.grip + .0004 * dtH); break;
    case 'sit_hug': S.fear = clamp(S.fear - .07 * dtH); break;
    case 'rock': S.fear = clamp(S.fear - .09 * dtH); S.grip = clamp(S.grip - .0003 * dtH); break;
    case 'remember': S.loneliness = clamp(S.loneliness - .02 * dtH); S.nostalgia = clamp(S.nostalgia - .04 * dtH); S.grip = clamp(S.grip - .0004 * dtH); S.hope = clamp(S.hope + .002 * dtH); break;
    case 'read': S.boredom = clamp(S.boredom - .15 * dtH); S.grip = clamp(S.grip + .0012 * dtH); S.curiosity = clamp(S.curiosity + .01 * dtH); break;
    case 'toilet': S.hygiene = clamp(S.hygiene + .8 * dtH); break;
    case 'sleep':
      S.sleep = clamp(S.sleep - .15 * (ROOM.dark ? 1 : .5) * (FURN.bed ? 1.3 : 1) * dtH); S.energy = clamp(S.energy + .1 * dtH);
      S.grip = clamp(S.grip + .0008 * (ROOM.dark ? 1 : .3) * dtH);
      if (S.grip < .5 && R() < dtH * .08) { S.fear = clamp(S.fear + .25); b.t = b.dur; say(pick(['Woke up screaming. I don\'t know what about.', `Dreamt ${fr()} was knocking on the wall.`, 'A nightmare. The room was in it too.']), 'bad'); }
      break;
    case 'talk_ghost': S.loneliness = clamp(S.loneliness - .08 * dtH); S.grip = clamp(S.grip - .001 * dtH); S.hope = clamp(S.hope + .01 * dtH);
      if (R() < dtH * 1.2) bubble(pick([`${ROOM.ghostC.name}, they took me.`, 'You came.', 'Don\'t go.', 'Is the market still open?', 'Tell them I\'m here.']), 'bub', null, 2600);
      break;
    case 'stare': S.grip = clamp(S.grip - .0006 * dtH); S.boredom = clamp(S.boredom - .02 * dtH); break;
    case 'panic': S.fear = clamp(S.fear - .5 * dtH); break;
    case 'catatonic': S.fear = clamp(S.fear - .02 * dtH); break;
    case 'meditate': S.fear = clamp(S.fear - .12 * dtH * (.4 + S.depth)); S.boredom = clamp(S.boredom - .05 * dtH); S.grip = clamp(S.grip + .0015 * S.depth * dtH); S.anger = clamp(S.anger - .1 * dtH); break;
    case 'philosophize': if (!b.done) { b.done = true; addScrawl(b.extra.wall, depthThought().toUpperCase().slice(0, 34)); } S.boredom = clamp(S.boredom - .1 * dtH); break;
    case 'knock': if (!b.done) { b.done = true; sfx('thud'); S.loneliness = clamp(S.loneliness - .03); S.grip = clamp(S.grip - .004); hallBoost('voices', .05); } break;
    case 'phantom': if (!b.done) { b.done = true; ROOM.letdown = .8; S.hope = clamp(S.hope - .04); S.grip = clamp(S.grip - .01); ROOM.litost = .6; say('Nothing there. There was never anything there.', 'bad'); hallBoost('food', .06); } break;
    case 'false_door': if (!b.done) { b.done = true; ROOM.letdown = .9; S.hope = clamp(S.hope - .05); S.anger = clamp(S.anger + .1); S.grip = clamp(S.grip - .012); say('Wall. Just wall. My hands on flat white wall.', 'bad'); hallBoost('door', .05); HALL.fakeDoor = null; } break;
    case 'mirror': S.shame = clamp(S.shame + .02 * dtH); if (S.grip < .4) { S.grip = clamp(S.grip - .002 * dtH); S.fear = clamp(S.fear + .03 * dtH); } else S.grip = clamp(S.grip + .001 * dtH); break;
    case 'photo': S.loneliness = clamp(S.loneliness - .05 * dtH); S.longing = clamp(S.longing + .02 * dtH); S.nostalgia = clamp(S.nostalgia + .02 * dtH); S.hope = clamp(S.hope + .004 * dtH); break;
    case 'rat': S.loneliness = clamp(S.loneliness - .06 * dtH); S.tenderness = clamp(S.tenderness + .05 * dtH); S.joy = clamp(S.joy + .02 * dtH); S.grip = clamp(S.grip + .0008 * dtH); break;
    case 'eat_rat': if (!b.done && ITEMS.rat && ITEMS.rat.alive) { b.done = true; ITEMS.rat.alive = false; if (ITEMS.rat.mesh) ITEMS.rat.mesh.visible = false; S.hunger = clamp(S.hunger - .25); S.guilt = clamp(S.guilt + .35); S.grief = clamp(S.grief + .15); S.disgust = clamp(S.disgust + .5); HALL.ratMemory = true; dayNote('torment'); } break;
    case 'radio': S.boredom = clamp(S.boredom - .12 * dtH); if (R() < dtH * .3) { const f = fr(); S.surprise = clamp(S.surprise + .4); S.hope = clamp(S.hope + .03); say(`A voice on the radio. It sounded like ${f}. Then static.`, 'mind'); } break;
    case 'watch': S.anger = clamp(S.anger + (S.depth > .5 ? -.05 : .04) * dtH); if (!b.done) { b.done = true; bubble(pick(['I SEE YOU.', 'WHY ARE YOU DOING THIS?', S.depth > .5 ? 'I forgive you.' : 'LET ME OUT.', 'Are you enjoying this?']), S.depth > .5 ? 'bub' : 'bub shout', null, 2800); } break;
  }
}
function wokeUp() { dayRoll(); ROOM.sleeps++; if (ROOM.sleeps > 1 && R() < .4) say(`Woke up. Day ${ROOM.sleeps + 1}? It feels like ${S.timeRate > 1.1 ? 'it has been longer' : 'no time passed at all'}.`); }
function deliverFood(byYou) {
  ROOM.food = true; tray.visible = true; ROOM.lastMealH = ROOM.hours; dayNote('meals'); S.relief = clamp(S.relief + .3); if (ROOM.hours > 48 && S.hunger > .6) S.gratitude = clamp(S.gratitude + .2); ROOM.nextMeal = ROOM.hours + mealDelay(); sfx('hatch');
  if (ROOM.hours < 36) S.hope = clamp(S.hope + .06);
  if (byYou || R() < .3 || ROOM.hours < 12) say(ROOM.hours < 12 ? 'The hatch opened. A tray. It closed before I saw a hand.' : 'The hatch again.', 'ev');
  if (ROOM.nextMeal === Infinity && !byYou) say('The hatch is not opening any more.', 'bad');
}
function foundSeam() {
  ROOM.seamFound = true; dayNote('seam'); spike('surprise', .7); spike('excite', .6); drawDoorSeam(.55);
  S.hope = clamp(S.hope + .3); S.anger = clamp(S.anger + .05);
  say('A line in the wall. Thin as a hair. It goes up, across, down. It\'s a door.', 'ev');
  bubble('A DOOR', 'bub shout', null, 2400);
}
function release(brokeOut) {
  ROOM.released = true; ROOM.broke = brokeOut; ROOM.dark = !brokeOut; ROOM.food = false; tray.visible = false;
  for (const [, g] of ghosts) g.want = 0;
  doorPivot.visible = true; outsideLight.visible = true;
  sfx('door'); updateAudio();
  if (brokeOut) say(`Day ${Math.floor(ROOM.hours / 24) + 1}. The door tore loose from the frame. He did it himself.`, 'ev');
  else say(`Day ${cfg.time.chamberDays}. The hum stopped. The light died. Something in the door clicked.`, 'ev');
  const wasCata = ROOM.beh && ROOM.beh.kind === 'catatonic';
  if (wasCata) { S.grip = Math.max(S.grip, .12); say('He doesn\'t move for a long time. Then he stands up.', 'ev'); }
  S.hope = clamp(S.hope + .35); S.fear = clamp(S.fear + .2); S.pride = clamp(S.pride + (brokeOut ? .6 : 0));
  ROOM.beh = { kind: 'escape', target: pt(DOOR.x, -RS + .5, Math.PI), dur: 99, t: 0, arrived: false, extra: {}, delay: performance.now() + (wasCata ? 3500 : 1500) };
}
