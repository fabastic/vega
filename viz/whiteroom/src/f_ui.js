// =====================================================================
// SETUP: every part of his life is configurable
// =====================================================================
const DEFAULTS = {
  vega: { name: 'Vega', occupation: 'crafter', home: 0, life: 'Wants to leave town and see the coast',
    openness: .74, conscientiousness: .55, extraversion: .8, agreeableness: .66, stability: .42, curiosity: .72, independence: .7, persistence: .64, ambition: .5, impulsiveness: .45,
    freedom: .85, community: .74, family: .55, knowledge: .6, wealth: .3, status: .35,
    appetite: 1, thirst: 1, sleepNeed: 1, bedtime: 22, height: 1.76, build: 1, shirt: '#2b6684', skin: 2, hair: 1, friends: null, crush: '', orient: 'f', philosophy: .5 },
  world: { villages: 3, perVillage: 10, seed: 4242, season: 'spring', fresh: true },
  time: { lifeDays: 45, chamberDays: 120 },
  chamber: { size: 'medium', light: 'always', sound: 'silence', food: 'dwindling', furnish: 'bare', voice: 'none', door: 'steel', canDie: false },
  outside: { cause: 'fever', ending: 'alone', survivors: [], refuge: 'far', findDays: 12 },
  after: { animals: 'normal', wolves: true, research: 'normal', revival: 'zombie', zombies: 'unstable', difficulty: 'realistic', enemies: { risen: 'few', raiders: true, dogs: true, bears: true }, ptsd: 'normal', family: 'on', renew: 'family', gestDays: 40, growDays: 60 },
};
const clone = o => JSON.parse(JSON.stringify(o));
let cfg = clone(DEFAULTS);
try { const saved = JSON.parse(localStorage.getItem('vega-whiteroom-cfg') || 'null'); if (saved && saved.vega) cfg = Object.assign(clone(DEFAULTS), saved, { vega: Object.assign(clone(DEFAULTS.vega), saved.vega), world: Object.assign(clone(DEFAULTS.world), saved.world), time: Object.assign(clone(DEFAULTS.time), saved.time), chamber: Object.assign(clone(DEFAULTS.chamber), saved.chamber), outside: Object.assign(clone(DEFAULTS.outside), saved.outside), after: Object.assign(clone(DEFAULTS.after), saved.after, { enemies: Object.assign(clone(DEFAULTS.after.enemies), (saved.after || {}).enemies) }) }); } catch (e) { /* storage unavailable */ }
const homeRoster = () => roster(cfg).filter(e => e.village === Math.min(cfg.vega.home, cfg.world.villages - 1) && !e.vega);
if (!cfg.vega.friends) cfg.vega.friends = homeRoster().slice(0, 3).map(e => e.name);

const PRESETS = [
  { id: 'default', name: 'The original', note: '120 days, steel door, fading food, alone after.', apply: c => c },
  { id: 'gentle', name: 'Gentle', note: 'Large furnished room, day and night, a kind voice, friends survive.', apply: c => { c.after.difficulty = 'forgiving'; Object.assign(c.chamber, { size: 'large', light: 'cycle', sound: 'silence', food: 'regular', furnish: 'books', voice: 'kind', door: 'steel', canDie: false }); c.time.chamberDays = 60; c.outside.ending = 'survivors'; c.outside.survivors = c.vega.friends.slice(0, 3); c.outside.findDays = 6; c.after.research = 'fast'; c.after.wolves = false; return c; } },
  { id: 'harsh', name: 'Harsh', note: 'Small bare cell, constant hum, scarce food, a cruel voice, no door. He can die.', apply: c => { Object.assign(c.chamber, { size: 'small', light: 'always', sound: 'hum', food: 'scarce', furnish: 'bare', voice: 'cruel', door: 'none', canDie: true }); c.time.chamberDays = 180; c.outside.ending = 'alone'; c.after.animals = 'few'; c.after.research = 'slow'; c.after.difficulty = 'brutal'; return c; } },
  { id: 'dark', name: 'Total deprivation', note: 'A year in silent darkness.', apply: c => { Object.assign(c.chamber, { size: 'medium', light: 'dark', sound: 'silence', food: 'erratic', furnish: 'bare', voice: 'none', door: 'steel', canDie: false }); c.time.chamberDays = 365; return c; } },
  { id: 'escape', name: 'Escape artist', note: 'A door he can break, and the will to break it.', apply: c => { c.chamber.door = 'breakable'; c.vega.persistence = .95; c.vega.independence = .92; c.vega.stability = .6; c.time.chamberDays = 200; return c; } },
  { id: 'science', name: 'Mad science', note: 'A scholar alone, fast research, full revival allowed.', apply: c => { c.vega.occupation = 'scholar'; c.vega.curiosity = .95; c.after.research = 'fast'; c.after.revival = 'full'; c.after.zombies = 'unstable'; c.outside.ending = 'alone'; return c; } },
  { id: 'notalone', name: 'Not alone', note: 'Four people make it. They come looking for him.', apply: c => { c.outside.ending = 'survivors'; const all = roster(c).filter(e => !e.vega); c.outside.survivors = [...c.vega.friends.slice(0, 2), ...all.filter(e => !c.vega.friends.includes(e.name)).slice(-2).map(e => e.name)]; c.outside.findDays = 5; return c; } },
];

const get = path => path.split('.').reduce((o, k) => o[k], cfg);
const set = (path, v) => { const ks = path.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], cfg)[last] = v; };
const pct = v => Math.round(v * 100) + '%';
const R2 = (k, l, a, b, ends, step = .01, fmt = pct) => ({ k, l, type: 'range', min: a, max: b, step, ends, fmt });
const SEL = (k, l, opts, hint) => ({ k, l, type: 'seg', opts, hint });
const villageOpts = () => VILLAGE_DEFS.slice(0, cfg.world.villages).map((v, i) => [i, v.name]);
const TABS = [
  { id: 'vega', label: 'Him', fields: () => [
    { k: 'vega.name', l: 'Name', type: 'text' },
    SEL('vega.occupation', 'Work', [['crafter', 'Crafter'], ['farmer', 'Farmer'], ['hunter', 'Hunter'], ['scholar', 'Scholar'], ['healer', 'Healer']], 'Hunters hunt better afterwards. Scholars research faster.'),
    SEL('vega.home', 'Home village', villageOpts()),
    { k: 'vega.life', l: 'What he wants from life', type: 'text' },
    SEL('vega.orient', 'He is drawn to', [['f', 'Women'], ['m', 'Men'], ['both', 'Both']]),
    SEL('vega.crush', 'His crush', [['', 'Let it happen'], ...homeRoster().map(e => [e.name, e.name + (e.sex === 'f' ? ' ♀' : ' ♂')])], 'Someone he already has feelings for. Whether they feel the same is up to them.'),
    R2('vega.philosophy', 'Philosophical bent', 0, 1, ['Practical', 'Philosophical'], .01),
    R2('vega.extraversion', 'Outgoing', 0, 1, ['Quiet', 'Outgoing']), R2('vega.stability', 'Emotional stability', 0, 1, ['Anxious', 'Steady']),
    R2('vega.persistence', 'Persistence', 0, 1, ['Gives up', 'Stubborn']), R2('vega.curiosity', 'Curiosity', 0, 1, ['Incurious', 'Curious']),
    R2('vega.independence', 'Independence', 0, 1, ['Dependent', 'Independent']), R2('vega.agreeableness', 'Kindness', 0, 1, ['Prickly', 'Kind']),
    R2('vega.conscientiousness', 'Discipline', 0, 1, ['Scattered', 'Careful']), R2('vega.openness', 'Openness', 0, 1, ['Set in his ways', 'Open']),
    R2('vega.ambition', 'Ambition', 0, 1, ['Content', 'Ambitious']), R2('vega.impulsiveness', 'Impulsiveness', 0, 1, ['Deliberate', 'Impulsive']),
    R2('vega.freedom', 'Values freedom', 0, 1, ['Little', 'Above all']), R2('vega.community', 'Values belonging', 0, 1, ['Little', 'Above all']),
    R2('vega.family', 'Values family', 0, 1, ['Little', 'Above all']), R2('vega.knowledge', 'Values knowledge', 0, 1, ['Little', 'Above all']),
    { k: 'vega.friends', l: 'His closest friends', type: 'checks', wide: true, list: () => homeRoster().map(e => [e.name, '']) , hint: 'These people start close to him. In the chamber, they are who he misses and sees.' },
  ] },
  { id: 'body', label: 'Body', fields: () => [
    R2('vega.height', 'Height', 1.5, 2.0, ['1.50 m', '2.00 m'], .01, v => v.toFixed(2) + ' m'), R2('vega.build', 'Build', .85, 1.2, ['Slight', 'Broad'], .01, v => v.toFixed(2)),
    R2('vega.appetite', 'Appetite', .6, 1.5, ['Eats little', 'Always hungry'], .05, v => v.toFixed(2) + '×'), R2('vega.thirst', 'Thirst', .7, 1.4, ['Rarely thirsty', 'Always thirsty'], .05, v => v.toFixed(2) + '×'),
    R2('vega.sleepNeed', 'Sleep need', .7, 1.3, ['Short sleeper', 'Long sleeper'], .05, v => v.toFixed(2) + '×'), R2('vega.bedtime', 'Bedtime', 19, 25, ['19:00', '01:00'], .5, v => `${String(Math.floor(v % 24)).padStart(2, '0')}:${v % 1 ? '30' : '00'}`),
    { k: 'vega.shirt', l: 'Shirt colour', type: 'color' },
    SEL('vega.skin', 'Skin tone', SKINS.map((c, i) => [i, `●`]), 'From deep brown to fair.'),
    SEL('vega.hair', 'Hair colour', HAIRS.map((c, i) => [i, `●`])),
  ] },
  { id: 'world', label: 'World', fields: () => [
    R2('world.villages', 'Villages', 1, 4, ['1', '4'], 1, v => v), R2('world.perVillage', 'People per village', 5, 14, ['5', '14'], 1, v => v),
    R2('time.lifeDays', 'Days of normal life', 10, 90, ['10', '90'], 1, v => v + ' days'),
    SEL('world.season', 'Season when he is born into the story', [['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']]),
    SEL('world.fresh', 'Each run', [[true, 'New world every time'], [false, 'Reuse this seed']], 'A new world means new land, new strangers and new choices. Reuse a seed to replay a world.'),
    { k: 'world.seed', l: 'World seed', type: 'number', hint: 'Shown so you can replay a world you liked: switch to "Reuse this seed".' },
  ] },
  { id: 'chamber', label: 'Chamber', fields: () => [
    R2('time.chamberDays', 'Days in the chamber', 7, 365, ['1 week', '1 year'], 1, v => v + ' days'),
    SEL('chamber.size', 'Size', [['small', 'Small (4 m)'], ['medium', 'Medium (6 m)'], ['large', 'Large (9 m)']]),
    SEL('chamber.light', 'Light', [['always', 'Always on'], ['cycle', 'Day and night'], ['flicker', 'Random'], ['dark', 'Always dark']], 'Constant light wrecks sleep and his sense of time.'),
    SEL('chamber.sound', 'Sound', [['silence', 'Silence'], ['hum', 'Electric hum'], ['static', 'Static'], ['voices', 'Voices of his friends']]),
    SEL('chamber.food', 'Food through the hatch', [['regular', 'Every 8 hours'], ['erratic', 'At random'], ['scarce', 'Scarce'], ['dwindling', 'Regular, then fading']]),
    SEL('chamber.furnish', 'Furniture', [['bare', 'Nothing'], ['bed', 'Bed and toilet'], ['books', 'Bed, toilet and books']]),
    SEL('chamber.voice', 'Observer voice', [['none', 'Never speaks'], ['kind', 'Kind'], ['cruel', 'Cruel'], ['both', 'Both']]),
    SEL('chamber.door', 'The door', [['steel', 'Findable, never opens'], ['breakable', 'He can break it'], ['none', 'No door he can find']]),
    SEL('chamber.canDie', 'Can he die in there?', [[false, 'No, he is kept alive'], [true, 'Yes']]),
  ] },
  { id: 'outside', label: 'Outside', fields: () => [
    SEL('outside.cause', 'What kills the villages', [['fever', 'A fever'], ['famine', 'A blight and famine'], ['both', 'Both']]),
    SEL('outside.ending', 'When he comes out', [['alone', 'Everyone is dead'], ['survivors', 'A few survived']]),
    { k: 'outside.survivors', l: 'Who survives', type: 'checks', wide: true, list: () => roster(cfg).filter(e => !e.vega).map(e => [e.name, VILLAGE_DEFS[e.village].name]), hint: 'Only used when a few survive. They flee to a refuge village and find him, or he finds them.', when: () => cfg.outside.ending === 'survivors' },
    SEL('outside.refuge', 'Where the survivors hide', [['far', 'Farthest village'], ...villageOpts().map(([i, n]) => [String(i), n])]),
    R2('outside.findDays', 'Days before they come looking', 1, 60, ['1', '60'], 1, v => v + ' days'),
  ] },
  { id: 'after', label: 'Afterwards', fields: () => [
    SEL('after.difficulty', 'Survival difficulty', [['forgiving', 'Forgiving'], ['realistic', 'Realistic'], ['brutal', 'Brutal']], 'How hard hunger, thirst, cold, fever and wounds hit him once he is out.'),
    SEL('after.animals', 'Wild animals', [['none', 'None'], ['few', 'Few'], ['normal', 'Normal'], ['many', 'Many']]),
    SEL('after.wolves', 'Wolves', [[true, 'Yes'], [false, 'No']]),
    SEL('after.research', 'Research', [['off', 'Off'], ['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], 'Tools, farming, medicine, power, biology, and beyond.'),
    SEL('after.revival', 'Can he bring the dead back?', [['off', 'No'], ['zombie', 'As zombies'], ['full', 'As zombies, then as themselves']]),
    SEL('after.zombies', 'The revived are', [['docile', 'Docile'], ['unstable', 'Unstable and dangerous']]),
    SEL('after.enemies.risen', 'The unburied dead', [['off', 'Stay dead'], ['few', 'Some rise'], ['hordes', 'Hordes']], 'Bodies he has not buried can get up at night.'),
    SEL('after.enemies.raiders', 'Raiders', [[true, 'Yes'], [false, 'No']], 'Armed strangers who follow his smoke and his stockpile.'),
    SEL('after.enemies.dogs', 'Wild dogs', [[true, 'Yes'], [false, 'No']]),
    SEL('after.enemies.bears', 'Bears', [[true, 'Yes'], [false, 'No']]),
    SEL('after.ptsd', 'What the room leaves', [['none', 'Nothing'], ['mild', 'Mild'], ['normal', 'PTSD'], ['severe', 'Severe PTSD']]),
    SEL('after.family', 'Children', [['on', 'Possible'], ['off', 'No']], 'If he finds someone, a child can be born.'),
    SEL('after.renew', 'Continuing life', [['family', 'A family before reviving the dead'], ['both', 'Both'], ['revive', 'Reviving the dead']]),
    R2('after.gestDays', 'Days to a birth', 10, 120, ['10', '120'], 1, v => v + ' days'),
  ] },
];
let curTab = 'vega';
function renderSetup() {
  $('#presets').innerHTML = PRESETS.map(p => `<button type="button" data-p="${p.id}"><b>${p.name}</b><small>${p.note}</small></button>`).join('');
  $('#tabs').innerHTML = TABS.map(t => `<button type="button" role="tab" aria-selected="${t.id === curTab}" data-t="${t.id}">${t.label}</button>`).join('');
  const tab = TABS.find(t => t.id === curTab);
  $('#tabpanels').innerHTML = `<div class="tabpanel" role="tabpanel">${tab.fields().map(fieldHTML).join('')}</div>`;
  $('#brandName').textContent = (cfg.vega.name || 'Vega').toUpperCase();
  $('#goSummary').textContent = `${cfg.vega.name}, ${cfg.time.lifeDays} days of life, ${cfg.time.chamberDays} days in the chamber, ${cfg.world.villages} village${cfg.world.villages > 1 ? 's' : ''} of ${cfg.world.perVillage}, ${cfg.outside.ending === 'survivors' ? (cfg.outside.survivors.length + ' survivor' + (cfg.outside.survivors.length === 1 ? '' : 's')) : 'nobody survives'}.`;
}
function fieldHTML(f) {
  if (f.when && !f.when()) return '';
  const id = 'f_' + f.k.replace('.', '_'), v = get(f.k);
  const hint = f.hint ? `<span class="hint">${f.hint}</span>` : '';
  if (f.type === 'range') return `<div class="field"><label for="${id}">${f.l} <span class="val" id="${id}_v">${f.fmt(v)}</span></label><input type="range" id="${id}" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}"><div class="ends"><span>${f.ends[0]}</span><span>${f.ends[1]}</span></div>${hint}</div>`;
  if (f.type === 'text') return `<div class="field"><label for="${id}">${f.l}</label><input type="text" id="${id}" data-k="${f.k}" value="${escapeHtml(v)}" maxlength="40">${hint}</div>`;
  if (f.type === 'number') return `<div class="field"><label for="${id}">${f.l}</label><div class="row"><input type="number" id="${id}" data-k="${f.k}" value="${v}" style="width:120px"><button type="button" data-rand="${f.k}">New seed</button></div>${hint}</div>`;
  if (f.type === 'color') return `<div class="field"><label for="${id}">${f.l}</label><input type="color" id="${id}" data-k="${f.k}" value="${v}" style="width:64px;height:34px;padding:2px">${hint}</div>`;
  if (f.type === 'seg') {
    const isSwatch = f.k === 'vega.skin' || f.k === 'vega.hair', pal = f.k === 'vega.skin' ? SKINS : HAIRS;
    return `<div class="field${f.wide ? ' wide' : ''}"><span class="flabel">${f.l}</span><div class="seg" role="group" aria-label="${f.l}">${f.opts.map(([val, lab], i) => `<button type="button" data-k="${f.k}" data-v='${JSON.stringify(val)}' aria-pressed="${String(v) === String(val)}"${isSwatch ? ` style="color:#${new THREE.Color(pal[i]).getHexString()};font-size:16px;line-height:1" aria-label="Option ${i + 1}"` : ''}>${lab}</button>`).join('')}</div>${hint}</div>`;
  }
  if (f.type === 'checks') {
    const sel = new Set(v || []);
    return `<div class="field wide"><span class="flabel">${f.l} <span class="dim">(${sel.size} chosen)</span></span><div class="checks">${f.list().map(([n, sub]) => `<label><input type="checkbox" data-k="${f.k}" value="${escapeHtml(n)}" ${sel.has(n) ? 'checked' : ''}>${escapeHtml(n)}${sub ? ` <small>${sub}</small>` : ''}</label>`).join('')}</div>${hint}</div>`;
  }
  return '';
}
function onSetupInput(e) {
  const t = e.target, k = t.dataset.k;
  if (!k) return;
  if (t.type === 'range') { const f = TABS.flatMap(x => x.fields()).find(x => x.k === k); set(k, +t.value); const lab = document.getElementById(t.id + '_v'); if (lab) lab.textContent = f.fmt(+t.value); if (k === 'world.villages' || k === 'world.perVillage') { cfg.vega.home = Math.min(cfg.vega.home, cfg.world.villages - 1); cfg.vega.friends = cfg.vega.friends.filter(n => homeRoster().some(e => e.name === n)); cfg.outside.survivors = cfg.outside.survivors.filter(n => roster(cfg).some(e => e.name === n)); if (e.type === 'change') renderSetup(); } renderSummary(); return; }
  if (t.type === 'text') { set(k, t.value.trim() || (k === 'vega.name' ? 'Vega' : t.value)); if (k === 'vega.name') $('#brandName').textContent = get(k).toUpperCase(); renderSummary(); return; }
  if (t.type === 'number') { set(k, Math.abs(parseInt(t.value, 10) || 1)); return; }
  if (t.type === 'color') { set(k, t.value); return; }
  if (t.type === 'checkbox') { const arr = new Set(get(k)); t.checked ? arr.add(t.value) : arr.delete(t.value); set(k, [...arr]); if (e.type === 'change') renderSetup(); }
}
function renderSummary() { $('#goSummary').textContent = `${cfg.vega.name}, ${cfg.time.lifeDays} days of life, ${cfg.time.chamberDays} days in the chamber, ${cfg.world.villages} village${cfg.world.villages > 1 ? 's' : ''} of ${cfg.world.perVillage}, ${cfg.outside.ending === 'survivors' ? (cfg.outside.survivors.length + ' survivor' + (cfg.outside.survivors.length === 1 ? '' : 's')) : 'nobody survives'}.`; }
$('#setup').addEventListener('input', onSetupInput);
$('#setup').addEventListener('change', onSetupInput);
$('#setup').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.t) { curTab = b.dataset.t; renderSetup(); return; }
  if (b.dataset.p) { const keep = { name: cfg.vega.name, friends: cfg.vega.friends, seed: cfg.world.seed }; cfg = clone(DEFAULTS); cfg.vega.name = keep.name; cfg.vega.friends = keep.friends; cfg.world.seed = keep.seed; PRESETS.find(p => p.id === b.dataset.p).apply(cfg); renderSetup(); return; }
  if (b.dataset.rand) { set(b.dataset.rand, Math.floor(Math.random() * 1e6)); renderSetup(); return; }
  if (b.dataset.k && b.dataset.v != null) {
    let v = JSON.parse(b.dataset.v); set(b.dataset.k, v);
    if (b.dataset.k === 'vega.home') { cfg.vega.friends = homeRoster().slice(0, 3).map(x => x.name); }
    renderSetup();
  }
});

// =====================================================================
// RUNNING THE STORY
// =====================================================================
let speed = 1;
const sim = { phase: 'setup', hours: 7, takeAt: 0, chamberStart: 0, collapseAt: Infinity, aloneStart: 0, skipTo: null, lastDay: -1 };
const fmtClock = h => { const d = Math.floor(h / 24) + 1, hh = Math.floor(h % 24), mm = Math.floor((h * 60) % 60); return `Day ${d} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const fmtShort = h => `D${Math.floor(h / 24) + 1} ${String(Math.floor(h % 24)).padStart(2, '0')}:${String(Math.floor((h * 60) % 60)).padStart(2, '0')}`;

$('#begin').addEventListener('click', () => {
  if (cfg.world.fresh !== false) cfg.world.seed = Math.floor(Math.random() * 1e6);
  try { localStorage.setItem('vega-whiteroom-cfg', JSON.stringify(cfg)); } catch (e) { /* fine */ }
  cfg.vega.home = Math.min(cfg.vega.home, cfg.world.villages - 1);
  $('#setup').hidden = true;
  $('#fadeTxt').textContent = 'Building the villages…'; $('#fade').classList.add('on');
  setTimeout(() => {
    buildWorld(); buildPeople(); spawnAnimals();
    sim.takeAt = cfg.time.lifeDays * 24 + 3;
    selected = vegaC;
    buildCitList();
    setPhase('life'); setTownCam(); setSpeed(1);
    $('#fade').classList.remove('on');
    renderLifePanel(true);
  }, 60);
});

function setPhase(ph) {
  sim.phase = ph;
  const idx = { setup: -1, life: 0, taken: 1, chamber: 1, return: 2, after: 3 }[ph];
  ['ph1', 'ph2', 'ph3', 'ph4'].forEach((id, i) => { $('#' + id).className = i === idx ? 'on' : (i < idx ? 'done' : ''); });
  $('#setupPanel').hidden = ph !== 'setup';
  $('#lifePanel').hidden = !(ph === 'life' || ph === 'taken');
  $('#roomPanel').hidden = ph !== 'chamber';
  $('#afterPanel').hidden = !(ph === 'after' || ph === 'return');
  $('#feedSec').hidden = !(ph === 'chamber' || ph === 'after' || ph === 'return');
  $('#tlWrap').hidden = ph !== 'chamber';
  const mindBtns = ph === 'chamber' || ph === 'after';
  $('#vMind').hidden = $('#vReal').hidden = !mindBtns;
  $('#vFollow').hidden = $('#vMap').hidden = $('#vIso').hidden = !(ph === 'life' || ph === 'after');
  $('#vPov').hidden = !(ph === 'chamber' || ph === 'after');
  updateAudio();
}
function fadeThen(text, fn, ms = 2400) {
  $('#fadeTxt').textContent = text; $('#fade').classList.add('on');
  sim.skipTo = null; setSpeed(0);
  setTimeout(() => { clearTags(); fn(); setTimeout(() => { $('#fade').classList.remove('on'); setSpeed(1); }, 400); }, reduceMotion ? 300 : ms);
}
function takeVega() {
  setPhase('taken');
  fadeThen(`${fmtClock(sim.hours)}. ${NAME()} is taken from his bed in ${homeName()}. Nobody sees him go.`, () => {
    sim.chamberStart = sim.hours;
    const days = cfg.time.chamberDays, cd = Math.min(rnd(5, 12), Math.max(2, days * .15));
    sim.collapseAt = sim.hours + 24 * cd;
    const end = Math.max(cd + 8, days - 4);
    for (const c of citizens) {
      if (c.isVega || c.survivor) continue;
      const d = cd + 3 + Math.pow(R(), .85) * (end - cd - 3);
      c.deathAt = sim.chamberStart + d * 24 + rnd(0, 24);
      c.sickAt = c.deathAt - rnd(36, 96);
      const late = d > end * .6;
      c.cause = cfg.outside.cause === 'fever' ? 'the fever' : cfg.outside.cause === 'famine' ? (late ? pick(['hunger', 'the cold']) : 'hunger') : (late ? pick(['hunger', 'the cold', 'the fever']) : 'the fever');
    }
    vegaC.act = null;
    scene.remove(vegaC.h.root);
    enterRoom();
    renderer.domElement.style.filter = '';
    setCCTV(); setPhase('chamber'); buildGodPanel($('#rGod'), GOD_ROOM);
    feedDirty = true;
  });
}
function goAfter() {
  setPhase('return');
  fadeThen(ROOM.broke ? `Chamber day ${Math.floor(ROOM.hours / 24) + 1}. He tore the door out of its frame and walked into ${seasonAt(sim.hours)} light.` : `Chamber day ${cfg.time.chamberDays}. The power failed and the door swung open. ${NAME()} walks out into ${seasonAt(sim.hours)} light.`, () => {
    for (const [, g] of ghosts) { g.want = 0; g.op = 0; g.root.visible = false; }
    const rot = clamp((sim.hours - sim.collapseAt) / (24 * 90));
    applyDecay(rot); WORLD.lastRot = rot;
    for (const c of citizens) if (!c.isVega && !c.alive) makeRemains(c);
    scene.add(vegaC.h.root); vegaC.h.root.visible = true;
    A.pos.copy(FAC.door); A.yaw = Math.atan2(VILL[vegaC.homeVillage].x - FAC.door.x, VILL[vegaC.homeVillage].z - FAC.door.z);
    A.base.copy(vegaC.home.door); A.inv.food = 3;
    A.beh = { kind: 'arrive', target: VILL[vegaC.homeVillage].places.plaza.pos.clone(), dur: .5, t: 0, arrived: false, extra: {} };
    sim.aloneStart = sim.hours;
    S.grief = 0; S.boredom = .2; S.loneliness = Math.max(S.loneliness, .5); S.fear = .5; S.health = Math.max(S.health, .45); S.warmth = 1; S.guilt = .25; S.thirst = Math.min(S.thirst, .35);
    say('A rain barrel by the facility door. I drank until I was sick. Next to it, a crate of the same bread they fed me through the hatch. Three loaves.', 'ev');
    say(line(ALINES.arrive, true));
    renderer.domElement.style.filter = '';
    ptsdInit(); dayReset(); HALL.lastStage = hallStageOf(S.grip + .15);
    if (S.ptsd > .2) say('Out. I\'m out. So why do I keep checking for the walls?', 'mind');
    setPhase('after'); setFollow(); buildDirs(); buildGodPanel($('#aGod'), GOD_WORLD);
  }, 2800);
}
function showEnding(where) {
  const days = where === 'chamber' ? Math.floor(ROOM.hours / 24) : Math.floor(aloneDays());
  $('#endEyebrow').textContent = `This is how he died · ${fmtClock(sim.hours)}`;
  if (where === 'chamber') {
    $('#endTitle').textContent = `${NAME()} died in the chamber`;
    $('#endText').textContent = `He lived ${cfg.time.lifeDays} normal days and survived ${days} in the white chamber. The hatch did not give him enough.`;
  } else {
    $('#endTitle').textContent = `${NAME()} died after ${days} day${days === 1 ? '' : 's'} outside`;
    const cause = S.thirst > .9 ? 'thirst' : S.hunger > .85 ? 'hunger' : A.sickLeft > 0 ? 'the fever' : S.warmth < .25 ? 'the cold' : S.pain > .3 ? 'his wounds' : 'everything at once';
    $('#endText').textContent = `He lived ${cfg.time.lifeDays} normal days, ${Math.floor(ROOM.hours / 24)} in the white chamber, and ${days} in what was left. In the end it was ${cause}.`;
  }
  const total = citizens.length - 1;
  const st = [['Normal life', `${cfg.time.lifeDays} days`], ['In the chamber', `${Math.floor(ROOM.hours / 24)} days`], ['Days he thought passed inside', ROOM.sleeps + 1], ['Grip on reality at the end', Math.round(S.grip * 100) + '%']];
  if (where === 'after') st.push(['Children', FAMILY.children.length], ['Times you intervened', GOD.acts], ['Depth of mind', depthStage()],
    ['Days outside', days], ['People he found', `${A.found} of ${total}`], ['Graves dug', A.buried], ['Survivors met', A.met], ['Brought back', A.revived + (A.restored ? ` (${A.restored} as themselves)` : '')], ['Research finished', Object.keys(A.research.done).length], ['Animals hunted', A.kills]);
  $('#endStats').innerHTML = st.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('#ending').hidden = false;
}
$('#endWatch').addEventListener('click', () => { $('#ending').hidden = true; });
$('#endRestart').addEventListener('click', () => location.reload());
$('#skipLife').addEventListener('click', () => { if (sim.phase === 'life') sim.skipTo = sim.takeAt; });
$('#skipRoom').addEventListener('click', () => { if (sim.phase === 'chamber' && !ROOM.released) sim.skipTo = sim.chamberStart + cfg.time.chamberDays * 24; });
$('#skipAfter').addEventListener('click', () => { if (sim.phase === 'after' && !A.ended) sim.skipTo = sim.hours + 240; });
$('#ivLights').addEventListener('click', e => { if (sim.phase !== 'chamber' || ROOM.released) return; ROOM.darkManual = ROOM.darkManual == null ? !ROOM.dark : (ROOM.darkManual ? null : true); const dark = ROOM.darkManual === true; e.currentTarget.setAttribute('aria-pressed', dark); e.currentTarget.textContent = dark ? 'Lights on' : 'Lights off'; say(dark ? (S.grip > .5 ? 'Dark. Finally dark.' : 'Something is in here with me. In the dark.') : 'The light is back.', dark && S.grip <= .5 ? 'bad' : 'ev'); updateAudio(); });
$('#ivNoise').addEventListener('click', e => { if (sim.phase !== 'chamber' || ROOM.released) return; ROOM.noise = !ROOM.noise; e.currentTarget.setAttribute('aria-pressed', ROOM.noise); say(ROOM.noise ? 'A hiss from everywhere. Like rain that never lands.' : 'The hiss stopped. The silence is louder.', 'ev'); updateAudio(); });
$('#ivVoice').addEventListener('click', () => { if (sim.phase !== 'chamber' || ROOM.released) return; const keep = cfg.chamber.voice; cfg.chamber.voice = keep === 'none' ? 'kind' : keep; observerVoice(); cfg.chamber.voice = keep; });
$('#ivFood').addEventListener('click', () => { if (sim.phase !== 'chamber' || ROOM.released || ROOM.food) return; deliverFood(true); });

// ---------- views and cameras ----------
let camMode = 'town', selected = null;
function setTownCam() { camMode = 'town'; const v = VILL[vegaC.homeVillage]; camera.fov = 45; camera.updateProjectionMatrix(); camera.position.set(v.x + 10, v.h + 42, v.z + 52); controls.target.set(v.x, v.h, v.z + 2); controls.minDistance = 3; controls.maxDistance = 420; controls.update(); }
function setMap() { camMode = 'map'; camera.fov = 45; camera.updateProjectionMatrix(); camera.position.set(0, 360, 210); controls.target.set(0, 0, -10); controls.update(); }
function setCCTV() { camMode = 'cctv'; camera.fov = 70; camera.updateProjectionMatrix(); camera.position.set(RS - .25, RH - .18, RS - .25); controls.target.set(-.2, .7, -.2); controls.minDistance = .5; controls.maxDistance = RS * 2; controls.update(); }
function setIso() { camMode = 'iso'; camera.fov = 22; camera.updateProjectionMatrix(); controls.minDistance = 10; controls.maxDistance = 200; }
function setPov() { camMode = 'pov'; controls.minDistance = .01; }
function setFollow() { camMode = 'follow'; camera.fov = 45; camera.updateProjectionMatrix(); controls.minDistance = 3; controls.maxDistance = 420; const t = followTarget(); camera.position.copy(t).add(new THREE.Vector3(10, 13, 14)); controls.target.copy(t); controls.update(); }
const followTarget = () => sim.phase === 'after' ? A.pos.clone() : (selected ? selected.pos.clone() : VILL[0].places.plaza.pos.clone());
controls.addEventListener('start', () => { if (camMode === 'follow' || camMode === 'town') camMode = 'free'; });
const isoFollow = (t, dtR) => { const want = t.clone().add(new THREE.Vector3(30, 34, 30)); camera.position.lerp(want, Math.min(1, dtR * 2)); controls.target.lerp(t, Math.min(1, dtR * 3)); };
$('#viewReset').addEventListener('click', () => sim.phase === 'chamber' ? setCCTV() : sim.phase === 'after' ? setFollow() : sim.phase === 'setup' ? null : setTownCam());
$('#vFollow').addEventListener('click', setFollow);
$('#vMap').addEventListener('click', setMap);
$('#vIso').addEventListener('click', setIso);
$('#vPov').addEventListener('click', () => camMode === 'pov' ? (sim.phase === 'chamber' ? setCCTV() : setFollow()) : setPov());
$('#ivCam').addEventListener('click', () => { if (camMode === 'cctv') { camMode = 'free'; $('#ivCam').textContent = 'CCTV camera'; } else { setCCTV(); $('#ivCam').textContent = 'Free camera'; } });
function setView(m) { viewMode = m; $('#vMind').setAttribute('aria-pressed', m === 'mind'); $('#vReal').setAttribute('aria-pressed', m === 'real'); }
$('#vMind').addEventListener('click', () => setView('mind'));
$('#vReal').addEventListener('click', () => setView('real'));

// picking people in the villages
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointermove', e => {
  if (!vegaC || !(sim.phase === 'chamber' || sim.phase === 'after' || sim.phase === 'life')) return;
  const head = vegaC.h.root.position, dist = camera.position.distanceTo(head);
  if (dist > 9 || camMode === 'pov') { HALL.mouse = null; return; }
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  HALL.mouse = ray.ray.at(dist * .9, new THREE.Vector3());
});
renderer.domElement.addEventListener('pointerleave', () => { HALL.mouse = null; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  if (godPlace(e)) return;
  if (sim.phase === 'chamber' || sim.phase === 'after') {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mouse, camera);
    if (ray.intersectObject(vegaC.h.root, true).length) {
      if (sim.phase === 'chamber') { spike('fear', .15); spike('surprise', .6); godAct('torment', 'tapped on the glass'); say(pick(['A knock. From above. From the camera.', 'Something tapped. Like a finger on glass.', 'Who is there? I heard that.']), 'mind'); ROOM.beh.t = ROOM.beh.dur; }
      else { spike('surprise', .4); A.bubble = { text: pick(['Who\'s there?', 'Hello?', 'I know you\'re watching.']), cls: 'bub', until: performance.now() + 2200 }; GOD.lastAct = sim.hours; }
      return;
    }
  }
  if (sim.phase !== 'life') return;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(citizens.filter(c => c.h.root.visible && c.h.root.parent === scene).map(c => c.h.root), true);
  if (hits.length) { selected = hits[0].object.userData.cit; renderLifePanel(true); }
});

// ---------- timeline, grain, sound ----------
function recordHist() { while (ROOM.hours >= ROOM.nextHist) { ROOM.hist.push({ h: ROOM.nextHist, grip: S.grip, hope: S.hope, health: S.health, fear: S.fear }); ROOM.nextHist += Math.max(1, cfg.time.chamberDays / 120 * 2); if (ROOM.hist.length > 5000) ROOM.hist.shift(); } }
function drawTimeline() {
  const c = $('#tl'), g = c.getContext('2d'), W = c.width, H = c.height, dpr = devicePixelRatio;
  g.clearRect(0, 0, W, H);
  const hist = ROOM.hist; if (hist.length < 2) return;
  const span = cfg.time.chamberDays * 24, x = h => h / span * W, y = v => H - 6 * dpr - v * (H - 14 * dpr);
  g.fillStyle = 'rgba(252,252,250,.78)'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#d8dbd6'; g.lineWidth = 1; g.font = `${10 * dpr}px "Martian Mono", monospace`; g.fillStyle = '#5b6168';
  const stepD = cfg.time.chamberDays > 150 ? 50 : cfg.time.chamberDays > 60 ? 20 : 7;
  for (let d = stepD; d < cfg.time.chamberDays; d += stepD) { g.beginPath(); g.moveTo(x(d * 24), 0); g.lineTo(x(d * 24), H); g.stroke(); g.fillText('D' + d, x(d * 24) + 3 * dpr, 11 * dpr); }
  for (const [key, col, w] of [['fear', '#a8692a', 1.2], ['health', '#c4321f', 1.5], ['hope', '#2b6684', 1.5], ['grip', '#16181b', 2]]) {
    g.strokeStyle = col; g.lineWidth = w * dpr; g.beginPath();
    hist.forEach((p, i) => i ? g.lineTo(x(p.h), y(p[key])) : g.moveTo(x(p.h), y(p[key]))); g.stroke();
  }
}
const grain = $('#grain'), gctx = grain.getContext('2d'); let grainLevel = 0, grainT = 0;
function drawGrain(now) {
  grain.style.opacity = (grainLevel * .65).toFixed(3);
  if (grainLevel < .01 || now - grainT < 70) return; grainT = now;
  const img = gctx.createImageData(320, 200);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  gctx.putImageData(img, 0, 0);
}
let AC = null, hum = null, staticNode = null, wind = null, soundOn = false;
function initAudio() {
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const g = AC.createGain(); g.gain.value = 0; g.connect(AC.destination);
  const o1 = AC.createOscillator(); o1.frequency.value = 60; const o2 = AC.createOscillator(); o2.frequency.value = 120; o2.type = 'triangle';
  const g2 = AC.createGain(); g2.gain.value = .3; o1.connect(g); o2.connect(g2); g2.connect(g); o1.start(); o2.start(); hum = g;
  const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; const sg = AC.createGain(); sg.gain.value = 0; src.connect(sg); sg.connect(AC.destination); src.start(); staticNode = sg;
  const tin = AC.createOscillator(); tin.frequency.value = 6800; const tg = AC.createGain(); tg.gain.value = 0; tin.connect(tg); tg.connect(AC.destination); tin.start(); HALL.tin = tg;
  const src2 = AC.createBufferSource(); src2.buffer = buf; src2.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; const wg = AC.createGain(); wg.gain.value = 0; src2.connect(lp); lp.connect(wg); wg.connect(AC.destination); src2.start(); wind = wg;
}
function sfx(kind) {
  if (!soundOn || !AC) return;
  const t = AC.currentTime, g = AC.createGain(); g.connect(AC.destination);
  const osc = (type, f0, f1, dur, vol) => { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); o.start(t); o.stop(t + dur + .05); };
  if (kind === 'thud') osc('sine', 110, 40, .2, .5);
  if (kind === 'hatch') osc('square', 220, 200, .25, .06);
  if (kind === 'door') osc('sawtooth', 70, 140, 1.4, .08);
  if (kind === 'voice') osc('sine', 190, 150, .9, .05);
  if (kind === 'beat') osc('sine', 62, 40, .16, .35);
}
function updateAudio() {
  if (!AC) return;
  const inRoom = sim.phase === 'chamber';
  hum.gain.value = soundOn && inRoom && !ROOM.dark && cfg.chamber.sound !== 'silence' ? .035 : (soundOn && inRoom && !ROOM.dark ? .01 : 0);
  staticNode.gain.value = soundOn && inRoom && ROOM.noise ? .04 : 0;
  wind.gain.value = soundOn && (sim.phase === 'after' || sim.phase === 'life') ? (sim.phase === 'after' ? .05 : .015) : 0;
}
$('#snd').addEventListener('click', e => {
  soundOn = !soundOn; e.currentTarget.setAttribute('aria-pressed', soundOn);
  if (soundOn && !AC) { try { initAudio(); } catch (err) { soundOn = false; e.currentTarget.setAttribute('aria-pressed', 'false'); } }
  if (AC && AC.state === 'suspended') AC.resume();
  updateAudio();
});

// ---------- panels ----------
function meters(el, rows) {
  if (el._n !== rows.length) { el.innerHTML = rows.map(() => '<span class="k"></span><span class="bar"><i></i></span><span class="v"></span>').join(''); el._n = rows.length; }
  const ks = el.querySelectorAll('.k'), is = el.querySelectorAll('.bar i'), vs = el.querySelectorAll('.v');
  rows.forEach(([label, val, cls, txt], i) => {
    if (ks[i].textContent !== label) ks[i].textContent = label;
    is[i].style.width = (clamp(val) * 100).toFixed(1) + '%'; is[i].className = cls || '';
    vs[i].textContent = txt != null ? txt : Math.round(clamp(val) * 100);
  });
}
const kv = (el, rows) => { const html = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join(''); if (el._h !== html) { el.innerHTML = html; el._h = html; } };
const setHTML = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };
const sev = (v, inv) => { const x = inv ? 1 - v : v; return x > .7 ? 'bad' : ''; };
function feelings() {
  const D = derived();
  const f = [['fear', S.fear, '#c4321f'], ['loneliness', S.loneliness, '#2b6684'], ['boredom', S.boredom, '#5b6168'], ['hope', S.hope, '#3d7a4f'], ['anger', S.anger, '#c4321f'], ['grief', S.grief, '#16181b'],
    ['guilt', S.guilt, '#6a4f9c'], ['nostalgia', S.nostalgia, '#a8692a'], ['shame', S.shame, '#a8692a'], ['dread', S.dread, '#6a4f9c'], ['pride', S.pride, '#3d7a4f'], ['awe', S.awe, '#2b6684'],
    ['curiosity', S.curiosity, '#2b6684'], ['love', S.love, '#c4321f'], ['despair', D.despair, '#16181b'], ['apathy', D.apathy, '#5b6168']];
  return f.filter(x => x[1] > .08).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, v, c]) => `<span style="border-color:${c};background:color-mix(in srgb, ${c} ${Math.round(v * 28)}%, transparent);font-weight:${v > .6 ? 600 : 500}">${n} ${Math.round(v * 100)}</span>`).join('');
}
const perceiveHTML = () => perceptions().map(p => `<li class="${p.u ? 'unreal' : ''}"><span>${escapeHtml(p.t)}${p.u ? ' <em>(not real)</em>' : ''}</span></li>`).join('');
let lastSel = null;
function renderLifePanel(force) {
  const c = selected; if (!c) return;
  if (force || lastSel !== c) {
    lastSel = c;
    $('#selName').textContent = c.name + (c.isVega ? ' (subject)' : '');
    const ts = Object.entries(c.p).sort((a, b) => Math.abs(b[1] - .5) - Math.abs(a[1] - .5)).slice(0, 5);
    $('#selTraits').innerHTML = ts.map(([k, v]) => `<span class="chip ${Math.abs(v - .5) > .25 ? 'hi' : ''}">${v >= .5 ? TRAIT_NAMES[k] : TRAIT_LOW[k]}</span>`).join('')
      + `<span class="chip">${c.occupation}</span><span class="chip">eats ${c.rates.hunger > .042 ? 'often' : c.rates.hunger < .03 ? 'little' : 'normally'}</span><span class="chip">${c.chrono % 24 < 21 && c.chrono < 24 ? 'early sleeper' : c.chrono % 24 > 22.5 || c.chrono >= 24 ? 'night owl' : 'sleeps at ten'}</span>`;
    document.querySelectorAll('#citList button').forEach(b => b.classList.toggle('sel', +b.dataset.i === c.i));
  }
  $('#selEyebrow').textContent = `${VILL[c.village].name} · ${c.occupation}`;
  $('#selLife').textContent = (c.isVega ? c.life : c.life) + '.';
  const a = c.act;
  const where = { eat: 'the market', forage: 'the fields', drink: 'the well', sleep: 'home', work: 'the workshop', learn: 'the library', social: 'the plaza', wander: 'the edge of the village', family: 'home', visit: a && a.visitV != null ? VILL[a.visitV].name : '' };
  const doing = !a ? 'Deciding' : (a.arrived ? { eat: 'Eating at the market', forage: 'Foraging in the fields', drink: 'Drinking at the well', sleep: 'Asleep at home', work: 'Working at the workshop', learn: 'Reading in the library', social: c.chatPartner ? `Talking with ${c.chatPartner.name}` : 'Looking for company at the plaza', wander: 'Wandering', family: 'At home with family', visit: `Visiting ${where.visit}` }[a.kind] : `Walking to ${where[a.kind]}`);
  $('#selDoing').textContent = `${doing} · ${Math.round(c.money)} coins`;
  $('#selThought').textContent = c.thought;
  const n = c.needs;
  meters($('#selNeeds'), [['Hunger', n.hunger, sev(n.hunger)], ['Thirst', n.thirst, sev(n.thirst)], ['Tiredness', n.sleep, sev(n.sleep)], ['Energy', n.energy, sev(n.energy, 1) || 'good'], ['Health', n.health, sev(n.health, 1) || 'good']]);
  meters($('#selWants'), Object.entries(c.w).sort((x, y) => y[1].w * (1 - y[1].l) - x[1].w * (1 - x[1].l)).map(([k, w]) => [`${WANT_LABEL[k]} · weight ${w.w.toFixed(2)}`, 1 - w.l, 'civ']));
  const ls = lifeState(c);
  setHTML($('#selFeel'), feelChips(emoWords(ls, { company: !!(c.chatPartner && c.act && c.act.arrived), partnerNear: c.partner && c.partner.pos.distanceTo(c.pos) < 6, crushNear: c.crush && c.crush.pos.distanceTo(c.pos) < 6 }), 10));
  setHTML($('#selHeart'), heartHTML(c));
  const rel = topFriend(c, 4).filter(([, v]) => v > .03);
  $('#selRel').innerHTML = rel.length ? rel.map(([o, v]) => `<span><b>${o.name}</b> <span class="dim">· ${VILL[o.homeVillage].name}, ${v > .6 ? 'close friend' : v > .3 ? 'friend' : 'acquaintance'} (${Math.round(v * 100)})</span></span>`).join('') : '<span class="dim">Nobody yet.</span>';
  const lived = clamp((sim.hours - 7) / (sim.takeAt - 7 || 1));
  meters($('#lifeMeter'), [[`Day ${Math.floor(sim.hours / 24) + 1} of ${cfg.time.lifeDays}`, lived, 'civ', Math.round(lived * 100) + '%']]);
  $('#lifeText').textContent = `On the night after day ${cfg.time.lifeDays}, ${NAME()} is taken to the chamber for ${cfg.time.chamberDays} days. Every friendship he makes until then goes in with him.`;
}
function buildCitList() {
  $('#citList').innerHTML = citizens.map(c => `<li><button type="button" data-i="${c.i}"><span class="d" style="background:#${new THREE.Color(c.shirt).getHexString()}"></span><span class="n">${escapeHtml(c.name)}</span><span class="a" id="ca${c.i}"></span></button></li>`).join('');
  $('#citList').onclick = e => { const b = e.target.closest('button'); if (!b) return; selected = citizens[+b.dataset.i]; renderLifePanel(true); setFollow(); };
}
const SHORT = { eat: 'eating', forage: 'foraging', drink: 'drinking', sleep: 'asleep', work: 'working', learn: 'reading', social: 'chatting', wander: 'wandering', visit: 'travelling', family: 'at home' };
function renderCitList() { for (const c of citizens) { const el = document.getElementById('ca' + c.i); if (!el) continue; const t = `${VILL[c.village].name.slice(0, 4)} · ${c.act ? (c.act.arrived ? SHORT[c.act.kind] : 'walking') : ''}`; if (el.textContent !== t) el.textContent = t; } }
function renderRoomPanel() {
  const D = derived(), b = ROOM.beh;
  $('#rEyebrow').textContent = `Chamber · subject ${NAME()} · day ${Math.min(cfg.time.chamberDays, Math.floor(ROOM.hours / 24) + 1)} of ${cfg.time.chamberDays}`;
  $('#rDoing').textContent = BEH_LABEL[b.kind] || 'Standing';
  setHTML($('#rPerceive'), perceiveHTML());
  meters($('#rBody'), [['Hunger', S.hunger, sev(S.hunger)], ['Thirst', S.thirst, sev(S.thirst)], ['Exhaustion', S.sleep, sev(S.sleep)], ['Cleanliness', S.hygiene, sev(S.hygiene, 1) || 'good'], ['Pain', S.pain, S.pain > .4 ? 'bad' : ''], ['Health', S.health, sev(S.health, 1) || 'good'], ['Body weight', S.weight, S.weight < .75 ? 'bad' : 'good']]);
  setHTML($('#rFeel'), feelChips(vegaFeelings()));
  setHTML($('#rDepth'), mindHTML()); setHTML($('#rDay'), dayHTML());
  meters($('#rMind'), [['Grip on reality', S.grip, (sev(S.grip, 1) || 'mind')], ['Hope', S.hope, sev(S.hope, 1) || 'good'], ['Despair', D.despair, sev(D.despair)]]);
  const f = ROOM.friends;
  const wants = [['Get out', D.escape], [f.length ? `See ${f[0].c.name} again` : 'See anyone at all', S.loneliness * (.6 + (f[0] ? f[0].a * .6 : 0))], ['Food and water', Math.max(S.hunger, S.thirst)], ['Sleep in the dark', S.sleep * (ROOM.dark ? .4 : 1)],
    ['Know what day it is', clamp((.25 + vegaC.p.conscientiousness * .5) * Math.min(1, ROOM.hours / 60) + .15)], ['Something to do', S.boredom], ['Be told why', clamp(.2 + ROOM.hours / 600 + S.anger * .3)], ['Feel clean', 1 - S.hygiene], ['Go home', S.nostalgia]].sort((a, b) => b[1] - a[1]);
  meters($('#rWants'), wants.map(([k, v]) => [k, v, v > .7 ? 'bad' : 'civ']));
  const searched = Math.round(ROOM.searched.flat().filter(x => x > .3).length / 24 * 100);
  const C = cfg.chamber;
  setHTML($('#rEscape'), (ROOM.released ? `<span><b>Open.</b> ${ROOM.broke ? 'He broke it himself.' : 'The power failed.'}</span>` : ROOM.seamFound ? `<span><b>Seam found</b> on the north wall. ${C.door === 'breakable' ? `He has forced it ${Math.round(ROOM.doorDamage * 100)}% of the way.` : ROOM.doorDamage >= .35 ? 'Steel underneath. It will not move.' : 'He is trying to pry it open.'}</span>` : `<span>No way out found. He has searched ${searched}% of the walls.</span>`)
    + `<span class="dim">${ROOM.attempts} escape attempts · ${ROOM.tallies} tally marks · ${ROOM.booksRead ? ROOM.booksRead + ' books read · ' : ''}thinks it is day ${ROOM.sleeps + 1}</span>`);
  const alive = citizens.filter(c => !c.isVega && c.alive).length;
  kv($('#outKv'), [['Alive outside', `${alive} of ${citizens.length - 1}`], ['Food supply', Math.round(WORLD.food * 100) + '%'], ['His friends alive', ROOM.friends.filter(x => x.c.alive).length + ' of ' + ROOM.friends.length]]);
  const out = OUT.slice(-8).reverse();
  setHTML($('#outFeed'), out.map(e => `<li class="${e.friend ? 'bad' : 'out'}"><time>${fmtShort(e.h)}</time><span>${escapeHtml(e.text)}</span></li>`).join('') || '<li class="out"><time></time><span>Life goes on in the villages.</span></li>');
  $('#skipRoom').disabled = ROOM.released; $('#ivFood').disabled = ROOM.food || ROOM.released;
}
function buildDirs() {
  $('#dirs').innerHTML = Object.entries(DIRECTIVES).map(([k, d]) => `<button type="button" data-d="${k}" aria-pressed="${A.directive === k}"${k === 'revive' && cfg.after.revival === 'off' || k === 'research' && cfg.after.research === 'off' ? ' disabled' : ''}>${d.label}</button>`).join('');
}
$('#dirs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; A.directive = b.dataset.d; buildDirs(); if (A.beh && !A.ended && A.beh.kind !== 'arrive') A.beh.t = A.beh.dur; $('#dirHint').textContent = A.directive === 'free' ? 'He decides for himself.' : `He leans toward: ${DIRECTIVES[A.directive].label.toLowerCase()}. Hunger, thirst and cold still come first.`; });
function renderAfterPanel() {
  const D = derived(), b = A.beh;
  $('#aEyebrow').textContent = `After · day ${Math.floor(aloneDays()) + 1} outside · ${WORLD.season} · ${Math.round(tempAt(sim.hours))}°C`;
  $('#aDoing').textContent = (ALABEL[b.kind] || 'Standing') + (b.kind === 'build' ? `: ${STRUCT[b.extra.k].label.toLowerCase()}` : b.kind === 'hunt' && b.extra.a ? ` ${b.extra.a.type}` : b.kind === 'explore' && b.extra.v ? ` toward ${b.extra.v.name}` : '');
  setHTML($('#aPerceive'), perceiveHTML());
  meters($('#aBody'), [['Hunger', S.hunger, sev(S.hunger)], ['Thirst', S.thirst, sev(S.thirst)], ['Exhaustion', S.sleep, sev(S.sleep)], ['Warmth', S.warmth, sev(S.warmth, 1) || 'good'], ['Cleanliness', S.hygiene, sev(S.hygiene, 1) || 'good'], ['Pain', S.pain, S.pain > .4 ? 'bad' : ''], ['Health', S.health, sev(S.health, 1) || 'good'], ['Body weight', S.weight, S.weight < .75 ? 'bad' : 'good']]);
  setHTML($('#aFeel'), feelChips(vegaFeelings()));
  setHTML($('#aDepth'), mindHTML()); setHTML($('#aDay'), dayHTML()); setHTML($('#aPtsd'), ptsdHTML()); setHTML($('#aFam'), familyHTML()); setHTML($('#aThreat'), threatHTML());
  meters($('#aMind'), [['Grip on reality', S.grip, (sev(S.grip, 1) || 'mind')], ['Hope', S.hope, sev(S.hope, 1) || 'good'], ['Despair', D.despair, sev(D.despair)]]);
  const dead = citizens.filter(c => !c.isVega && !c.alive && !c.companion);
  const wants = [['Survive the day', Math.max(S.hunger, S.thirst, 1 - S.warmth, 1 - S.health)], ['Company', S.loneliness], ['Bring them back', cfg.after.revival !== 'off' ? S.grief * .6 + S.love * .4 : 0], ['Understand what happened', clamp(S.curiosity * .6 + (A.research.done.medicine ? 0 : .3))],
    ['Lay them to rest', dead.length ? clamp(dead.filter(c => !c.buried).length / Math.max(1, dead.length) * (.4 + vegaC.p.agreeableness * .5)) : 0], ['Feel safe', Math.max(S.fear, S.dread)], ['Comfort', clamp((1 - S.hygiene) * .5 + (1 - S.warmth) * .5)], ['Purpose', D.apathy * .7 + (1 - S.pride) * .3], ['See what is out there', VILL.filter(v => !v.visited).length / VILL.length * vegaC.p.curiosity]].sort((a, b) => b[1] - a[1]);
  meters($('#aWants'), wants.map(([k, v]) => [k, v, v > .7 ? 'bad' : 'civ']));
  const I = A.inv;
  setHTML($('#aInv'), [['food', 'meals'], ['cans', 'tins'], ['meat', 'raw meat'], ['wood', 'wood'], ['stone', 'stone'], ['seeds', 'seeds'], ['books', 'books'], ['specimens', 'specimens'], ['medicine', 'medicine'], ['hides', 'hides']].map(([k, l]) => `<div><b>${Math.floor(I[k])}</b><span>${l}</span></div>`).join(''));
  kv($('#aSurv'), [['Built', Object.keys(A.built).map(k => STRUCT[k].label.toLowerCase()).join(', ') || 'nothing yet'], ['Garden', A.garden ? (A.garden.growth >= 1 ? 'ready to harvest' : `growing, ${Math.round(A.garden.growth * 100)}%`) : (A.built.garden ? 'empty' : 'none')], ['Hens in the pen', A.pen], ['Houses searched', `${HOUSES.filter(h => h.searched).length} of ${HOUSES.length}`], ['Villages seen', `${VILL.filter(v => v.visited).length} of ${VILL.length}`], ['Hunted / fish caught', `${A.kills} / ${A.fish}`], ['Weapons and tools', A.tools ? 'spear, axe, line' : 'bare hands'], ['Coat', A.coat ? 'hide coat' : 'what he wore in'], ['Fever', A.sickLeft > 0 ? 'sick' : 'no'], ['Stores stripped', `${STORES.filter(s => s.store !== 'crate' && s.searched).length} of ${STORES.filter(s => s.store !== 'crate').length}`]]);
  setHTML($('#aRes'), !researchOn() ? '<li class="locked">Research is turned off in this run.</li>' : RESEARCH.filter(resAllowed).map(n => {
    const done = A.research.done[n.id], active = A.research.active === n, avail = n.need.every(x => A.research.done[x]);
    const st = done ? 'done' : active ? `${Math.round(A.research.progress / n.hours * 100)}%` : avail ? `needs ${n.books} book${n.books > 1 ? 's' : ''}${n.spec ? `, ${n.spec} specimens` : ''}` : 'locked';
    return `<li class="${done ? 'done' : avail || active ? '' : 'locked'}"><b>${n.name}</b><span class="st">${st}</span>${active ? `<span class="bar"><i style="width:${Math.min(100, A.research.progress / n.hours * 100).toFixed(1)}%"></i></span>` : ''}<small>${n.desc}</small></li>`;
  }).join(''));
  setHTML($('#aComp'), COMPANIONS.length ? COMPANIONS.map(z => `<span><b>${escapeHtml(z.c.name)}</b> <span class="dim">· ${z.kind === 'survivor' ? 'survivor, from ' + VILL[z.c.homeVillage].name : z.kind === 'zombie' ? (z.unstable ? 'revived, unstable' : 'revived, docile') : 'brought back as themselves'}</span></span>`).join('') : `<span class="dim">Nobody.${citizens.some(c => c.survivor && c.alive && !c.met) ? ' Someone may still be out there.' : ''}</span>`);
  const people = citizens.filter(c => !c.isVega).sort((a, b) => (vegaC.rel.get(b) || 0) - (vegaC.rel.get(a) || 0));
  setHTML($('#aDead'), people.map(c => { const st = c.companion ? (c.revived === 'zombie' ? 'zombie' : 'alive') : c.alive ? 'alive' : c.buried ? 'buried' : c.found ? 'found' : ''; const txt = c.companion ? (c.revived === 'zombie' ? 'walking again' : c.revived === 'restored' ? 'brought back' : 'with him') : c.alive ? (c.survivor ? 'alive somewhere' : 'dying') : c.buried ? 'buried' : c.found ? 'found dead' : 'not found'; return `<li class="${st}"><b>${escapeHtml(c.name)}</b><span>${txt}</span></li>`; }).join(''));
  $('#skipAfter').disabled = A.ended;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-atlas]'); if (!b) return;
  if (b.dataset.atlas === 'life' && selected) openAtlas(emoWords(lifeState(selected), {}), `${selected.name}, right now`);
  else openAtlas(vegaFeelings(), `${NAME()}, right now`);
});
$('#atlasClose').addEventListener('click', () => { $('#atlas').hidden = true; });
$('#atlasQ').addEventListener('input', renderAtlas); $('#atlasNow').addEventListener('change', renderAtlas);
function renderFeed() {
  feedDirty = false;
  const ev = EVENTS.slice(-45).reverse();
  setHTML($('#feedList'), ev.map(e => `<li class="${e.cls}"><time>${fmtShort(e.h)}${Math.abs(e.bh - e.h) > .5 ? `<br><span style="color:var(--alarm)">feels ${fmtShort(e.bh)}</span>` : ''}</time><span>${escapeHtml(e.text)}</span></li>`).join(''));
}
