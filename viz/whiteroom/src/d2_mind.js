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
