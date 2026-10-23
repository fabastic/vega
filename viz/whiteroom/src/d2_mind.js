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
