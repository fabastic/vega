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
