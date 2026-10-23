
// =====================================================================
// HIS MIND: hallucinations that grow with him, depth of thought, the scar the room leaves, and days
// that carry over into the next
// =====================================================================
const spike = (k, v) => { S[k] = clamp((S[k] || 0) + v); };
// the new feelings, carried over from his life in the village
function extendMind() {
  const c = vegaC, e = c.emo || {};
  const crushV = c.crush && c.att ? c.att.get(c.crush) || 0 : 0;
  Object.assign(S, {
    joy: clamp((e.joy || .4) * .5), affection: clamp((e.affection || .2) + (topFriend(c) ? .2 : 0)), attraction: c.partner ? Math.max(crushV, .6) : crushV, lust: e.lust || .15,
    jealousy: 0, heartbreak: e.heartbreak || 0, longing: 0, gratitude: 0, disgust: 0, surprise: .6, relief: 0, trust: .55 + c.p.agreeableness * .2, excite: 0,
    depth: clamp((cfg.vega.philosophy ?? .5) * .15 + c.p.openness * .05), ptsd: 0, tenderness: 0, envy: 0, betrayal: 0,
  });
  ROOM.crush = c.partner || c.crush || null;
  if (c.partner) S.love = Math.max(S.love, e.love || .5);
  else if (c.crush) S.love = Math.max(S.love, crushV * .7);
}
// the slower feelings, in both the chamber and after
function moodStep(dtH, x) {
  const company = !!x.company, D = derived();
  S.surprise = clamp(S.surprise - S.surprise * .8 * dtH); S.relief = clamp(S.relief - S.relief * .3 * dtH); S.excite = clamp(S.excite - S.excite * .25 * dtH);
  S.disgust = clamp(S.disgust - S.disgust * .15 * dtH); S.gratitude = clamp(S.gratitude - S.gratitude * .06 * dtH); S.jealousy = clamp(S.jealousy - S.jealousy * .05 * dtH);
  S.heartbreak = clamp(S.heartbreak - .002 * dtH); S.betrayal = clamp(S.betrayal - .0015 * dtH); S.envy = clamp(S.envy - .01 * dtH);
  const joyT = clamp(.12 + S.hope * .25 + (company ? .25 : 0) + S.pride * .15 + (x.partnerNear ? .2 : 0) + (x.child ? .2 : 0) - D.despair * .35 - S.grief * .3 - (S.ptsd || 0) * .15);
  S.joy = clamp(S.joy + (joyT - S.joy) * .05 * dtH);
  const away = ROOM.crush && !x.partnerNear ? 1 : 0;
  S.longing = clamp(S.longing + ((S.loneliness * S.love * .8 + away * S.attraction * .5) - S.longing) * .02 * dtH);
  S.attraction = clamp(S.attraction - (x.partnerNear ? -.004 : .0004) * dtH);
  // desire returns when the body is rested and fed, and goes quiet under fear, hunger and grief
  const lustT = clamp(.15 + S.attraction * .35 + (x.partnerNear ? .25 : 0) - S.hunger * .35 - S.fear * .3 - S.grief * .3 - (1 - S.health) * .4);
  S.lust = clamp(S.lust + (lustT - S.lust) * .02 * dtH);
  S.affection = clamp(S.affection + (((company ? .45 : .15) + S.love * .3 + (x.child ? .3 : 0)) - S.affection) * .02 * dtH);
  S.tenderness = clamp(S.tenderness + (((x.child ? .7 : 0) + (x.pet ? .3 : 0)) - S.tenderness) * .05 * dtH);
  S.trust = clamp(S.trust + (((company ? .65 : .45) - S.betrayal * .4) - S.trust) * .01 * dtH);
}

// ---------- things put into the experiment ----------
// God mode adds these; the chamber and the world both read them.
const ITEMS = { room: {}, rat: null, radio: false, mirror: false, photo: null, knife: false, journalGiven: false, clock: null, cold: 0, heat: 0, flood: 0, strobe: 0, siren: 0, shrink: 0, drug: 0, red: 0, prisoner: null };
const GOD = { acts: 0, lastAct: -1e9, torments: 0, kindness: 0, log: [] };
const watched = () => clamp(GOD.acts * .04 + (sim.hours - GOD.lastAct < 24 ? .25 : 0) + (S.depth > .55 ? GOD.acts * .03 : 0));

// ---------- yesterday ----------
// Every day leaves a residue. He wakes and the day before is still in him: it shifts his mood and what he
// reaches for first.
const DAY = { cur: null, prev: null, bias: {}, history: [], startH: 0 };
const dayReset = () => { DAY.cur = { meals: 0, hungerMax: 0, thirstMax: 0, painMax: 0, attacks: 0, found: 0, buried: 0, voiceKind: 0, voiceCruel: 0, flashbacks: 0, hall: 0, wins: 0, company: 0, alone: 0, god: 0, torment: 0, fear: 0, joy: 0, cold: 0, food: 0, seam: 0, escape: 0, deaths: 0, love: 0, births: 0, lost: 0, insight: 0 }; DAY.startH = sim.hours; };
const dayNote = (k, v = 1) => { if (!DAY.cur) dayReset(); DAY.cur[k] = (DAY.cur[k] || 0) + v; };
function dayTrack(dtH, x) {
  if (!DAY.cur) dayReset();
  const c = DAY.cur;
  c.hungerMax = Math.max(c.hungerMax, S.hunger); c.thirstMax = Math.max(c.thirstMax, S.thirst); c.painMax = Math.max(c.painMax, S.pain);
  c.fear += S.fear * dtH; c.joy += (S.joy || 0) * dtH; c.cold += (1 - (S.warmth ?? 1)) * dtH; if (x.company) c.company += dtH; else c.alone += dtH;
  if (sim.hours - DAY.startH > 30) dayRoll();
}
const DAY_TEXT = {
  hungerMax: [v => v > .8, () => sim.phase === 'chamber' ? 'Yesterday the hatch stayed shut. I counted the hours on my fingers.' : 'Yesterday I went hungry. Today, food before anything.'],
  thirstMax: [v => v > .8, () => 'Yesterday my mouth turned to sand. I won\'t let that happen again.'],
  attacks: [v => v > 0, () => 'Yesterday something came at me. I kept waking up listening.'],
  found: [v => v > 0, () => `Yesterday I found ${DAY.cur && DAY.cur.found > 1 ? 'more of them' : 'one of them'}. I can still see it.`],
  buried: [v => v > 0, () => 'Yesterday I dug graves. My hands remember the shovel.'],
  voiceCruel: [v => v > 0, () => 'Yesterday the voice said things. I keep turning them over.'],
  voiceKind: [v => v > 0, () => 'Yesterday a voice was kind to me. I hold on to that.'],
  flashbacks: [v => v > 0, () => 'Yesterday the room came back. In daylight. Standing in the street.'],
  wins: [v => v > 0, () => 'Yesterday I made something. It is still there this morning.'],
  company: [v => v > 3, () => 'Yesterday I wasn\'t alone. I slept better.'],
  torment: [v => v > 0, () => 'Yesterday it got worse for no reason. Someone is doing this.'],
  god: [v => v > 1, () => 'Yesterday things appeared that weren\'t there before. Placed. Chosen.'],
  seam: [v => v > 0, () => 'Yesterday I found the edge of a door. I dreamt about it all night.'],
  love: [v => v > 0, () => 'Yesterday was warm. I want more days like that one.'],
  births: [v => v > 0, () => 'Yesterday there was a new voice in the world. A small one.'],
  deaths: [v => v > 0, () => 'Yesterday I lost someone again.'],
  insight: [v => v > 0, () => 'Yesterday I understood something. I am trying to keep hold of it.'],
};
function dayRoll() {
  const c = DAY.cur; if (!c) return dayReset();
  const hrs = Math.max(1, sim.hours - DAY.startH);
  const valence = clamp(((c.joy / hrs) - (c.fear / hrs) * .8 - (c.hungerMax > .8 ? .3 : 0) - c.attacks * .25 - c.found * .15 - c.flashbacks * .2 - c.voiceCruel * .2 - c.torment * .25 - c.deaths * .3 + c.wins * .15 + c.voiceKind * .15 + (c.company > 3 ? .2 : 0) + c.love * .2 + c.births * .4), -1, 1);
  const notes = Object.entries(DAY_TEXT).filter(([k, [test]]) => test(c[k] || 0)).map(([k, [, t]]) => ({ k, t: t() }));
  // what yesterday leaves him leaning toward today
  const bias = {};
  const add = (k, m) => { bias[k] = (bias[k] || 1) * m; };
  if (c.hungerMax > .8) { for (const k of ['forage', 'hunt', 'fish', 'scavenge', 'harvest', 'eat', 'cook']) add(k, 1.4); add('explore', .8); }
  if (c.thirstMax > .8) add('drink', 1.5);
  if (c.attacks) { add('build', 1.4); add('chop', 1.2); add('hunt', .7); add('explore', .6); add('barricade', 1.8); }
  if (c.found || c.deaths) { add('bury', 1.6); add('grave', 1.5); add('work', .8); add('journal', 1.3); }
  if (c.flashbacks) { add('research', .6); add('meditate', 1.4); add('talk', 1.3); }
  if (c.wins) { add('build', 1.15); add('research', 1.15); }
  if (c.company > 3) add('talk', 1.2); else { add('search', 1.25); add('explore', 1.15); }
  if (c.voiceCruel) { add('shout', 1.5); add('pound', 1.3); }
  if (c.voiceKind) { add('exercise', 1.2); add('tally', 1.2); }
  if (c.seam) add('pry', 1.5);
  if (c.torment || c.god > 1) { add('meditate', 1.2); add('watch', 1.5); }
  // the mood carries
  S.hope = clamp(S.hope + valence * .07); S.fear = clamp(S.fear - valence * .05 + (c.attacks ? .1 : 0));
  if (valence < -.3) S.dread = clamp(S.dread + .05); if (valence > .3) { S.joy = clamp(S.joy + .08); S.energy = clamp(S.energy + .05); }
  DAY.prev = { valence, notes, bias, day: Math.floor(sim.hours / 24) + 1, c };
  DAY.bias = bias; DAY.history.push({ h: sim.hours, valence }); if (DAY.history.length > 400) DAY.history.shift();
  if (notes.length) say(pick(notes).t, valence < -.2 ? 'bad' : valence > .2 ? 'ev' : 'say');
  dayReset();
}
const dayBias = k => DAY.bias[k] || 1;

// ---------- depth of thought ----------
// Long silence can hollow a mind out, or deepen it. Reading, writing and stillness push him toward
// reflection; past a point the questions turn philosophical and suffering loosens its grip.
const DEPTH_STAGES = [[0, 'Surviving'], [.15, 'Reflecting'], [.3, 'Questioning'], [.5, 'Contemplative'], [.7, 'Awakened'], [.85, 'Transcendent']];
const depthStage = () => DEPTH_STAGES.filter(([t]) => S.depth >= t).pop()[1];
const equanimity = () => smooth(.35, .85, S.depth || 0);
const QUESTIONS = [
  ['How long have I been here?', 'Why me?'],
  ['Am I the same person who walked in?', 'What is a day, without a sun to count it?'],
  ['If nobody sees me, do I still exist?', 'Is the room inside me, or am I inside the room?', 'What do I owe the people I miss?'],
  ['Suffering is a fact. What I make of it is mine.', 'Maybe meaning is not found. Maybe it is made, like a tally mark.', 'Every self is a story someone keeps telling. Who is telling mine?'],
  ['The walls, the hunger, the voice: weather passing over something that does not move.', 'There is a stillness under the fear. I can sit in it.'],
  ['There is no one here to be afraid.', 'White in every direction, and I am not separate from it.'],
];
const DEPTH_LINES = {
  chamber: [
    ['I counted my breaths until I lost count. Then I started again.', 'Thinking is the only room bigger than this one.'],
    ['A stone does not mind being a stone. Could I learn that?', 'I used to think freedom was a door. Maybe it was always something else.'],
    ['The one who suffers and the one who watches the suffering: they are not the same.', 'Sisyphus had a hill and a rock. I have four walls and a light. One must imagine me happy.'],
    ['Breathing in, I know I am breathing in. Even here.', 'Fear came and I watched it come. It sat with me. It left.'],
    ['I am not in the room. The room is in me, and so is everything else.'],
  ],
  after: [
    ['The world kept turning without anyone to watch it. That is not nothing.', 'Every empty house was somebody\'s whole universe.'],
    ['I keep asking what I survived for. The question might be the answer.', 'Grief is love with nowhere to go. I can give it somewhere to go.'],
    ['A garden doesn\'t ask why. It grows anyway.', 'Every name on the memorial was a world. I carry them now.'],
    ['I sat by the fire and for an hour I wanted nothing at all.', 'The dead are not gone. They changed into the people who remember them.'],
    ['Snow on the graves. Light on the snow. Nothing missing.'],
  ],
  watcher: ['Someone decides what happens to me. I can feel the hand on the scale.', 'Things appear that nobody brought. Something is choosing.', 'Whoever is watching: I know you are there.',
    'If I am an experiment, then you are part of it too.', 'I forgive you. Whoever you are. I think I have to, to be free of you.'],
};
function depthStep(dtH, kind) {
  const rate = (.4 + (cfg.vega.philosophy ?? .5) * 1.2) * .22, p = vegaC.p;   // depth is slow: weeks of practice, not days
  let d = .00015 * p.openness;
  if (kind === 'read' || kind === 'research') d += .0035 * (.5 + p.curiosity);
  if (kind === 'journal' || kind === 'philosophize') d += .005;
  if (kind === 'meditate' || kind === 'contemplate') d += .008 * clamp(1.2 - S.fear) * (.4 + S.grip * .6);   // hard to sit still in terror or confusion
  if (kind === 'stare' && S.grip > .3) d += .0012;
  if (S.fear > .75) d -= .001;
  const before = S.depth;
  S.depth = clamp(S.depth + d * rate * dtH);
  // a step deeper is a small realisation
  const st = t => DEPTH_STAGES.filter(([x]) => t >= x).length;
  if (st(S.depth) > st(before)) { say(`${depthStage()}. ${pick(QUESTIONS[Math.min(QUESTIONS.length - 1, st(S.depth) - 1)])}`, 'mind'); dayNote('insight'); spike('awe', .2); }
  // equanimity takes the edge off fear and despair without numbing him
  const eq = equanimity();
  if (eq > 0) { S.fear = clamp(S.fear - S.fear * .06 * eq * dtH); S.dread = clamp(S.dread - S.dread * .03 * eq * dtH); S.anger = clamp(S.anger - S.anger * .05 * eq * dtH); }
}
function depthThought() {
  const i = Math.min(4, Math.floor((S.depth || 0) / .18));
  if (watched() > .3 && S.depth > .35 && R() < .4) return pick(DEPTH_LINES.watcher);
  return pick(DEPTH_LINES[sim.phase === 'chamber' ? 'chamber' : 'after'][i]);
}
const currentQuestion = () => { const i = DEPTH_STAGES.filter(([t]) => S.depth >= t).length - 1; const qs = QUESTIONS[Math.min(QUESTIONS.length - 1, i)]; return qs[Math.floor(sim.hours / 30) % qs.length]; };

// ---------- the hallucinations ----------
// Deprived senses fill themselves in, and the order they do it in is well documented: first lights and
// geometry (the "prisoner's cinema", Klüver's lattices and tunnels), then faces in textures, sounds
// that are not there, then whole people and places. What he sees is drawn from what he feels and what
// has happened to him lately, and it learns: whatever he dwells on comes back stronger.
const HALL = { stage: 0, w: { geometry: .5, faces: .3, voices: .3, ghosts: .4, food: .2, door: .3, eyes: .2, village: .3, crush: .2, rats: 0, blood: 0, observer: 0, light: 0 },
  form: 'lattice', t: 0, layers: [], beat: 0, freeze: 0, lastDraw: 0, phantom: null, rats: [], insight: 0, heard: '', lastStage: 0 };
const HALL_STAGES = ['Hungry senses', 'Geometry', 'Faces and voices', 'People and places', 'Immersion', 'Dissolution'];
function hallStageOf(g) { return g > .85 ? 0 : g > .7 ? 1 : g > .5 ? 2 : g > .3 ? 3 : g > .15 ? 4 : 5; }
const hallBoost = (k, v) => { HALL.w[k] = clamp((HALL.w[k] || 0) + v); };
function hallStep(dtH) {
  const g = S.grip, st = hallStageOf(g + (ITEMS.drug > 0 ? -.25 : 0) + (sim.phase === 'after' ? .15 : 0));
  if (st !== HALL.lastStage) {
    if (st > HALL.lastStage && sim.phase === 'chamber') say({ 1: 'The white is moving. Patterns, crawling under the paint.', 2: 'There are faces in the wall. There aren\'t. There are.', 3: `${fr()} was standing in the corner. I saw ${fr()}.`, 4: 'The room changes when I blink.', 5: S.depth > .55 ? 'The walls are going. I am not afraid.' : 'The walls are going. Where am I. WHERE AM I.' }[st], 'mind');
    HALL.lastStage = st; dayNote('hall');
  }
  HALL.stage = st;
  // what he feels decides what he sees; the weights drift toward it
  const D = derived(), W = HALL.w;
  const target = { geometry: .5 + (ROOM.dark ? .3 : 0), faces: S.fear * .6 + S.loneliness * .3, voices: S.loneliness * .8, ghosts: S.loneliness * S.love + S.grief * .5, food: S.hunger > .5 ? S.hunger : .05,
    door: D.escape * .8, eyes: clamp(S.fear * (1 - g) + watched()), village: S.nostalgia, crush: (S.longing || 0) * (S.attraction || 0) * 1.5, rats: ITEMS.rat || HALL.ratMemory ? .6 : 0,
    blood: S.hands * .8, observer: watched() + (ROOM.voices ? .2 : 0), light: equanimity() };
  for (const k in target) W[k] = clamp(W[k] + (target[k] - W[k]) * .02 * dtH);
  // insight: when he knows it is not real (depth, reading), the visions loosen their hold
  HALL.insight = clamp(equanimity() * .7 + (S.grip > .6 ? .2 : 0));
  if (ITEMS.drug > 0) ITEMS.drug = Math.max(0, ITEMS.drug - dtH);
}
function pickMotif(stage) {
  const W = HALL.w, avail = ['geometry'];
  if (stage >= 2) avail.push('faces', 'eyes', 'observer');
  if (stage >= 3) avail.push('door', 'food', 'village', 'crush', 'rats', 'blood');
  if (stage >= 5 && W.light > .3) avail.push('light');
  let tot = 0; for (const k of avail) tot += W[k] + .02;
  let r = Math.random() * tot; for (const k of avail) { r -= W[k] + .02; if (r <= 0) return k; }
  return 'geometry';
}
// the layer over each wall that his visual cortex paints on
function buildHallLayers() {
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(RS * 2, RH), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 1 }));
    m.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][i]; m.position.set([0, RS - .012, 0, -RS + .012][i], RH / 2, [-RS + .012, 0, RS - .012, 0][i]);
    mindGroup.add(m); HALL.layers.push({ c, g, tex, m, motif: 'geometry', born: 0 });
  }
}
function drawHall(now) {
  if (!HALL.layers.length) return;
  const mind = viewMode === 'mind', st = HALL.stage, g0 = S.grip;
  const intensity = mind ? clamp((1 - g0) * 1.25 + (ROOM.dark ? .25 : 0) + (ITEMS.drug > 0 ? .3 : 0)) * (1 - HALL.insight * .5) : 0;
  for (const L of HALL.layers) L.m.visible = mind && intensity > .02;
  if (!mind || intensity <= .02 || now - HALL.lastDraw < 110) return;
  HALL.lastDraw = now; HALL.t += .11;
  const t = HALL.t;
  HALL.layers.forEach((L, i) => {
    if (now - L.born > 6000 + i * 900) { L.motif = pickMotif(st); L.born = now; L.seed = Math.random() * 1000; }
    const g = L.g, W = 512, H = 256, a = intensity;
    g.clearRect(0, 0, W, H);
    // phosphenes: specks of colour that drift, the first thing a starved eye makes up
    for (let k = 0; k < 6 + a * 20; k++) { const x = (Math.sin(k * 12.9 + t * .3 + i) * .5 + .5) * W, y = (Math.cos(k * 7.1 + t * .23 + i * 3) * .5 + .5) * H; g.fillStyle = `hsla(${(k * 47 + t * 20) % 360},70%,60%,${.05 + a * .12})`; g.beginPath(); g.arc(x, y, 1.5 + (k % 3), 0, TAU); g.fill(); }
    if (st < 1 && !ROOM.dark) return void (L.tex.needsUpdate = true);
    const m = L.motif;
    g.save();
    if (m === 'geometry' || st >= 1) {
      // form constants: lattice, tunnel, spiral, cobweb
      const form = ['lattice', 'tunnel', 'spiral', 'cobweb'][Math.floor((L.seed || 0) + i) % 4], cx = W / 2 + Math.sin(t * .2) * 40, cy = H / 2;
      g.strokeStyle = `rgba(106,79,156,${(m === 'geometry' ? .12 : .05) + a * .14})`; g.lineWidth = 1.2;
      if (form === 'lattice') { const s = 22 + Math.sin(t * .4) * 4; for (let x = -s + (t * 6) % s; x < W; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + Math.sin(t + x * .02) * 8, H); g.stroke(); } for (let y = 0; y < H; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + Math.cos(t + y * .03) * 8); g.stroke(); } }
      if (form === 'tunnel') for (let r = (t * 20) % 24; r < 300; r += 24) { g.beginPath(); g.ellipse(cx, cy, r * 1.5, r, 0, 0, TAU); g.stroke(); }
      if (form === 'spiral') { g.beginPath(); for (let k = 0; k < 600; k++) { const ang = k * .08 + t * .5, r = k * .45; g.lineTo(cx + Math.cos(ang) * r * 1.4, cy + Math.sin(ang) * r); } g.stroke(); }
      if (form === 'cobweb') for (let k = 0; k < 14; k++) { const ang = k / 14 * TAU + t * .05; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang) * 400, cy + Math.sin(ang) * 300); g.stroke(); for (let r = 20; r < 300; r += 26) { g.beginPath(); g.arc(cx, cy, r, ang, ang + TAU / 14); g.stroke(); } }
    }
    const pulse = .5 + .5 * Math.sin(t * 1.3 + i);
    if (m === 'faces') for (let k = 0; k < 3; k++) {   // pareidolia: the plaster arranges itself into faces
      const x = ((L.seed * 37 + k * 173) % 420) + 46, y = ((L.seed * 13 + k * 91) % 120) + 70, s = 18 + k * 6;
      g.fillStyle = `rgba(30,24,22,${(.08 + a * .25) * pulse})`; g.beginPath(); g.ellipse(x - s * .5, y, s * .22, s * .14, 0, 0, TAU); g.ellipse(x + s * .5, y, s * .22, s * .14, 0, 0, TAU); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.beginPath(); g.arc(x, y + s * .9, s * .5, Math.PI * 1.15, Math.PI * 1.85, S.fear < .5); g.stroke();
    }
    if (m === 'eyes') for (let k = 0; k < 9; k++) { const x = (Math.sin(L.seed + k * 2.3) * .45 + .5) * W, y = (Math.cos(L.seed * .7 + k * 1.7) * .4 + .5) * H; g.fillStyle = `rgba(240,240,236,${(.2 + a * .4) * pulse})`; g.beginPath(); g.ellipse(x, y, 11, 5, 0, 0, TAU); g.fill(); g.fillStyle = `rgba(20,16,14,${(.3 + a * .5) * pulse})`; g.beginPath(); g.arc(x + Math.sin(t) * 2, y, 3, 0, TAU); g.fill(); }
    if (m === 'observer') { g.strokeStyle = `rgba(20,20,22,${.15 + a * .3})`; g.lineWidth = 3; for (let r = 8; r < 46; r += 9) { g.beginPath(); g.arc(W * .5, H * .4, r, 0, TAU); g.stroke(); } g.fillStyle = `rgba(196,50,31,${.3 + .4 * pulse})`; g.beginPath(); g.arc(W * .5 + 30, H * .4 - 30, 5, 0, TAU); g.fill(); }
    if (m === 'door') { const x = 180 + (L.seed % 120); g.strokeStyle = `rgba(60,60,58,${.2 + a * .45})`; g.lineWidth = 2; g.strokeRect(x, H * .3, 70, H * .7); g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x + 60, H * .66, 3, 0, TAU); g.fill(); HALL.fakeDoor = { wall: i, u: (x + 35) / W }; }
    if (m === 'food') { for (let k = 0; k < 4; k++) { const x = 80 + k * 100, y = H * .7; g.fillStyle = `rgba(200,155,94,${.2 + a * .4})`; g.beginPath(); g.ellipse(x, y, 28, 14, 0, 0, TAU); g.fill(); } }
    if (m === 'village') { g.fillStyle = `rgba(90,110,70,${.12 + a * .25})`; g.fillRect(0, H * .82, W, H * .18); for (let k = 0; k < 6; k++) { const x = 40 + k * 80, w = 50, h = 40 + (k * 13) % 30; g.fillStyle = `rgba(200,180,150,${.15 + a * .3})`; g.fillRect(x, H * .82 - h, w, h); g.fillStyle = `rgba(140,80,50,${.15 + a * .3})`; g.beginPath(); g.moveTo(x - 6, H * .82 - h); g.lineTo(x + w / 2, H * .82 - h - 24); g.lineTo(x + w + 6, H * .82 - h); g.fill(); } }
    if (m === 'crush' && ROOM.crush) { g.font = '44px "Reenie Beanie", cursive'; g.fillStyle = `rgba(194,65,107,${.2 + a * .45})`; g.textAlign = 'center'; g.fillText(ROOM.crush.name, W / 2, H * .5); const hx = W / 2, hy = H * .5 + 30; g.beginPath(); g.moveTo(hx, hy + 18); g.bezierCurveTo(hx - 30, hy - 4, hx - 12, hy - 22, hx, hy - 8); g.bezierCurveTo(hx + 12, hy - 22, hx + 30, hy - 4, hx, hy + 18); g.fill(); }
    if (m === 'rats') for (let k = 0; k < 5; k++) { const x = ((t * 60 + k * 110 + L.seed) % (W + 60)) - 30, y = H - 8; g.fillStyle = `rgba(40,34,30,${.3 + a * .4})`; g.beginPath(); g.ellipse(x, y, 10, 4, 0, 0, TAU); g.fill(); g.fillRect(x - 18, y, 9, 1); }
    if (m === 'blood') for (let k = 0; k < 7; k++) { const x = 40 + k * 66 + (L.seed % 20), len = ((t * 8 + k * 30) % 140); g.strokeStyle = `rgba(130,38,28,${.25 + a * .35})`; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, len); g.stroke(); }
    if (m === 'light') { const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 300); gr.addColorStop(0, `rgba(255,250,235,${.4 * a})`); gr.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.strokeStyle = `rgba(200,170,100,${.15 * a})`; for (let k = 0; k < 12; k++) { g.beginPath(); g.ellipse(W / 2, H / 2, 40 + k * 18, 20 + k * 9, t * .05 + k * .26, 0, TAU); g.stroke(); } }
    g.restore();
    L.tex.needsUpdate = true;
  });
}
// the brain's own signal: heartbeat in the vision, blinks, and gaps where time goes missing
function sensorium(now, dtR, inPOV) {
  const mind = viewMode === 'mind';
  const bpm = 58 + S.fear * 70 + (S.anger > .5 ? 15 : 0) + (S.excite || 0) * 20 - equanimity() * 12;
  HALL.beat += dtR * bpm / 60;
  const thump = Math.pow(Math.max(0, Math.sin(HALL.beat * TAU)), 12);
  if (mind && S.fear > .45) { const v = $('#vig'); v.style.opacity = (parseFloat(v.style.opacity || 0) + thump * (S.fear - .4) * .5).toFixed(3); if (thump > .9 && HALL.lastThump !== Math.floor(HALL.beat)) { HALL.lastThump = Math.floor(HALL.beat); if (S.fear > .65) sfx('beat'); } }
  // eyelids in his own view
  const h = vegaC.h, lid = inPOV ? clamp(h.face.shut + (h.blink < 0 ? 1 : 0)) : 0;
  $('#lidT').style.height = $('#lidB').style.height = (lid * 50).toFixed(1) + '%';
  // lost time: a jump cut when his grip is thin
  if (mind && S.grip < .3 && Math.random() < dtR * .15 * (1 - S.grip)) { HALL.freeze = now + 300 + Math.random() * 600; if (Math.random() < .3) say(pick(['Where did the last hour go?', 'I blinked and I was across the room.', 'Time skipped. Like a scratched record.']), 'mind'); }
  // tinnitus in the silence
  if (AC && soundOn && HALL.tin) HALL.tin.gain.value = mind && sim.phase === 'chamber' && HALL.stage >= 1 && cfg.chamber.sound === 'silence' ? .004 + (1 - S.grip) * .006 : 0;
}

// ---------- the scar: PTSD ----------
// What the room did stays. White surfaces, being shut in, silence, a hum like the light, bread like the
// hatch's: any of them can drop him back inside. It eases with company, routine and stillness, and comes
// back worse if it is fed.
const PTSD = { symptoms: [], lastCue: '', flash: null, cutUntil: 0, nextCut: 0, starvedInside: false };
function ptsdInit() {
  const days = ROOM.hours / 24, minGrip = ROOM.hist.length ? Math.min(...ROOM.hist.map(h => h.grip)) : S.grip;
  const fearAvg = ROOM.hist.length ? ROOM.hist.reduce((s, h) => s + h.fear, 0) / ROOM.hist.length : S.fear;
  const k = { none: 0, mild: .6, normal: 1, severe: 1.5 }[cfg.after.ptsd || 'normal'];
  S.ptsd = clamp((.12 + days / 365 * .45 + (1 - minGrip) * .3 + fearAvg * .2 + GOD.torments * .02 + ROOM.voices * .01) * (1.25 - vegaC.p.emotional_stability * .6) * k * (1 - equanimity() * .4));
  PTSD.starvedInside = ROOM.hist.some(h => h.health < .7) || S.weight < .8;
}
function ptsdCues() {
  const hour = sim.hours % 24, night = hour < 6 || hour >= 21, b = A.beh || {};
  const cues = {
    white: winterAmt(sim.hours) * .8,
    shut_in: b.kind === 'sleep' && b.arrived && A.sleepIndoors ? .6 : 0,
    silence: !COMPANIONS.some(z => z.kind !== 'zombie') && night ? .35 : 0,
    hum: FAC.lit && A.pos.distanceTo(FAC.door) < 35 ? .9 : 0,
    facility: A.pos.distanceTo(FAC.door) < 18 ? 1 : 0,
    dark: night && !(A.built.campfire && A.pos.distanceTo(structPos('campfire')) < 8) ? .3 : 0,
    watched: sim.hours - GOD.lastAct < 6 ? .7 : 0,
    hunger: S.hunger > .7 ? .5 : 0,
  };
  return cues;
}
function ptsdStep(dtH) {
  if (!S.ptsd) return;
  const cues = ptsdCues(), [cue, cv] = Object.entries(cues).sort((a, b) => b[1] - a[1])[0];
  PTSD.lastCue = cv > .2 ? cue : '';
  const company = COMPANIONS.some(z => z.kind !== 'zombie');
  // recovery: time, company, routine, stillness
  S.ptsd = clamp(S.ptsd - dtH * (.0003 + (company ? .0012 : 0) + equanimity() * .001 + (A.beh && A.beh.kind === 'journal' ? .002 : 0)));
  // hypervigilance and a body braced for the hatch
  S.fear = clamp(S.fear + S.ptsd * .02 * dtH * (cv + .2));
  if (!PTSD.flash && cv > .15 && R() < dtH * S.ptsd * cv * .5) startFlashback(cue);
  if (PTSD.flash && sim.hours > PTSD.flash.until) { PTSD.flash = null; say(pick(['I\'m out. I\'m out. I\'m outside. Grass. Sky.', 'Count five things you can see. I counted them.', 'It passed. My hands are still shaking.']), 'ev'); S.relief = clamp(S.relief + .4); }
  const s = [];
  if (S.ptsd > .15) s.push('On guard all the time');
  if (S.ptsd > .25) s.push('Nightmares of the white');
  if (S.ptsd > .3 && PTSD.starvedInside) s.push('Hoards food, eats too little');
  if (S.ptsd > .35) s.push('Can\'t sleep behind a closed door');
  if (S.ptsd > .4) s.push('Avoids the facility');
  if (S.ptsd > .45) s.push('Startles at every sound');
  if (S.ptsd > .5) s.push('Counts the days on a wall again');
  if (S.ptsd > .6) s.push('Feels numb when he should feel glad');
  PTSD.symptoms = s;
}
const CUE_LINE = { white: 'Snow. Everything white. The walls are back.', shut_in: 'The door. Is the door shut? I can\'t breathe behind a shut door.', silence: 'This silence. It\'s the room\'s silence.', hum: 'That hum. The light used to hum like that.',
  facility: 'That building. I was in that building. I can\'t go in there.', dark: 'Dark like when the lights went off. I\'m back in it.', watched: 'Someone is watching me. Like the camera. Like the camera.', hunger: 'Hungry like the days the hatch didn\'t open.' };
function startFlashback(cue) {
  PTSD.flash = { until: sim.hours + rnd(.3, 1.1), cue };
  spike('fear', .35 * S.ptsd + .15); S.grip = clamp(S.grip - .03); spike('surprise', .4); dayNote('flashbacks');
  say(CUE_LINE[cue] || 'The room. I\'m back in the room.', 'bad');
  if (A.beh && !A.ended) A.beh = { kind: 'flashback', target: A.pos.clone(), dur: PTSD.flash.until - sim.hours, t: 0, arrived: true, extra: {}, h0: S.hunger, th0: S.thirst };
  PTSD.nextCut = 0;
}

// ---------- feelings, read through the lexicon ----------
function vegaCtx() {
  const ph = sim.phase, D = derived();
  if (ph === 'life' || ph === 'setup' || ph === 'taken') return {};
  if (ph === 'chamber') {
    const b = ROOM.beh || {};
    return { trapped: 1, alone: 1, escape: D.escape, small: RS < 2.5 ? 1 : 0, hall: 1 - S.grip, watched: watched() + (S.grip < .4 ? .2 : 0), expecting: !ROOM.food && ROOM.hours - (ROOM.lastMealH || 0) > 6 ? .45 : 0,
      justAte: b.kind === 'eat' && b.arrived ? 1 : 0, justWoke: b.kind === 'wake' ? 1 : 0, letdown: ROOM.letdown || 0, catatonic: b.kind === 'catatonic', freedom: vegaC.v.freedom, homebound: 1, lostHome: .6,
      litost: ROOM.litost || 0, drugged: ITEMS.drug > 0 ? .6 : 0, pet: ITEMS.rat && ITEMS.rat.alive ? 1 : 0, edge: 0, purpose: b.kind === 'pry' || b.kind === 'exercise' ? .6 : 0, sick: ITEMS.poison ? .6 : 0, unsure: (1 - S.grip) * .4 };
  }
  const near = r => COMPANIONS.some(z => z.kind !== 'zombie' && z.pos.distanceTo(A.pos) < r);
  const b = A.beh || {}, hour = sim.hours % 24, inVillage = villDist(A.pos.x, A.pos.z)[0] < 30;
  const partner = COMPANIONS.find(z => z.partner), kids = COMPANIONS.filter(z => z.kind === 'child');
  const danger = ANIMALS.some(a => a.alive && (a.state === 'stalk') && a.pos.distanceTo(A.pos) < 25) || HOSTILES.some(z => z.alive && z.pos.distanceTo(A.pos) < 20);
  return { company: near(12), partnerNear: partner && partner.pos.distanceTo(A.pos) < 8, crushNear: ROOM.crush && COMPANIONS.some(z => z.c === ROOM.crush && z.pos.distanceTo(A.pos) < 6), child: kids.length ? 1 : 0,
    fire: A.built.campfire && A.pos.distanceTo(structPos('campfire')) < 6, indoors: b.kind === 'sleep' && A.sleepIndoors, storm: WEATHER.kind === 'storm' || WEATHER.kind === 'blizzard', danger: danger ? 1 : 0, fight: b.kind === 'fight' ? 1 : 0,
    emptyPlace: inVillage && !near(25) && aloneDays() < 120 ? clamp(.7 - aloneDays() / 200) : 0, impermanence: WORLD.rot * .6 + (A.seasonTurn ? .4 : 0), outOfPlace: clamp(.8 - aloneDays() / 10), sonder: b.kind === 'scavenge' && b.arrived ? .7 : 0,
    cute: kids.some(z => z.pos.distanceTo(A.pos) < 5) ? .6 : 0, expecting: citizens.some(c => c.survivor && c.alive && !c.met) && aloneDays() > cfg.outside.findDays * .5 ? .5 : 0, leftRecently: clamp(1 - (sim.hours - (A.lostAt || -1e9)) / 72) * .8,
    edge: heightAt(A.pos.x, A.pos.z) > 12 ? .6 : 0, newLove: partner && sim.hours - (partner.since || 0) < 24 * 20 ? 1 : 0, schaden: clamp(1 - (sim.hours - (A.revengeAt || -1e9)) / 6) * .6, hunt: b.kind === 'hunt' ? 1 : 0,
    dead: citizens.some(c => c.remains && c.found && c.deathPos.distanceTo(A.pos) < 8) ? .7 : 0, sick: A.sickLeft > 0 ? .7 : 0, freedom: vegaC.v.freedom, alone: !near(30), watched: watched(),
    hall: 1 - S.grip, flash: PTSD.flash ? 1 : 0, purpose: b.kind === 'build' || b.kind === 'research' ? .6 : 0, obsess: A.directive === 'revive' ? S.grief : 0, won: b.kind === 'fight' && b.won ? 1 : 0, justAte: b.kind === 'eat' || b.kind === 'cook' ? .8 : 0 };
}
const vegaFeelings = () => emoWords(S, vegaCtx());

// ---------- feelings drive choices ----------
// Nothing he does is scheduled. Every option is scored from his needs, and each score is then bent by
// what he is feeling right now (the same families the lexicon reads) and by what yesterday left him with.
const FEEL_DRIVES = {
  explore: [['curious', .6], ['wander', .8], ['restless', .4]], search: [['lonely', .6], ['hope', .4], ['longing', .4]], pry: [['determ', .7], ['defiant', .5], ['trapped', .4]],
  pound: [['anger', .8], ['aggress', .6], ['trapped', .3]], shout: [['lonely', .5], ['panic', .4], ['anger', .3]], pace: [['restless', .7], ['anxiety', .5]], exercise: [['determ', .5], ['pride', .3], ['restless', .3]],
  sit_hug: [['sad', .5], ['fear', .4], ['vulnerable', .4]], rock: [['dissoc', .5], ['anxiety', .4]], remember: [['nostalgia', .7], ['longing', .5]], read: [['curious', .5], ['bored', .3], ['contemplate', .4]],
  talk_ghost: [['lonely', .6], ['longing', .5], ['haunted', .4]], stare: [['numb', .5], ['apathy', .5], ['dissoc', .4]], meditate: [['contemplate', .6], ['calm', .4], ['transcend', .6], ['anxiety', .2]],
  philosophize: [['contemplate', .7], ['nihil', .4], ['analytic', .3]], watch: [['paranoid', .6], ['contempt', .3], ['defiant', .3]], photo: [['longing', .6], ['love', .4], ['grief', .3]],
  rat: [['tender', .5], ['lonely', .5], ['affection', .4]], mirror: [['shame', .4], ['dissoc', .4], ['curious', .2]], knock: [['haunted', .5], ['lonely', .4]], false_door: [['determ', .4], ['trapped', .5], ['mad', .4]],
  talk: [['lonely', .5], ['affection', .5], ['connected', .4], ['love', .3]], court: [['attract', .9], ['romance', .6], ['lust', .4], ['lonely', .3]], intimate: [['lust', .8], ['romance', .5], ['love', .4]],
  cradle: [['tender', .8], ['protect', .4]], hunt: [['aggress', .3], ['crave', .3], ['feral', .4], ['vengeful', .3]], fight: [['aggress', .6], ['courage', .6], ['protect', .6], ['vengeful', .5]],
  flee: [['fear', .7], ['panic', .6], ['vulnerable', .4]], barricade: [['wary', .6], ['fear', .4], ['protect', .5]], loot: [['crave', .3], ['determ', .2], ['anticip', .2]],
  build: [['determ', .5], ['pride', .3], ['protect', .3]], research: [['curious', .6], ['obsess', .4], ['determ', .3]], revive: [['grief', .5], ['obsess', .6], ['longing', .4]], collect: [['grief', .5], ['obsess', .6]],
  bury: [['grief', .5], ['solemn', .5], ['care', .3]], grave: [['grief', .6], ['longing', .4]], journal: [['contemplate', .4], ['lonely', .3], ['sad', .2]], contemplate: [['contemplate', .6], ['awe', .5], ['calm', .3]],
  sit: [['sad', .4], ['apathy', .4], ['defeat', .3]], wander: [['restless', .4], ['bored', .4]], scavenge: [['crave', .3], ['determ', .2]], tally_out: [['anxiety', .4], ['trapped', .3]],
};
function feelBias(F, k) { const d = FEEL_DRIVES[k]; if (!d) return 1; let s = 0; for (const [f, w] of d) s += (F[f] || 0) * w; return .7 + s * 1.1; }
