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
