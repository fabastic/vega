// =====================================================================
// AFTER: the dead country, and whatever he makes of it
// =====================================================================
const A = {
  pos: new THREE.Vector3(), yaw: 0, yawT: null, beh: null, base: new THREE.Vector3(), directive: 'free', ended: false,
  inv: { food: 0, cans: 0, meat: 0, wood: 0, stone: 0, seeds: 0, books: 0, medicine: 0, specimens: 0, hides: 0 }, weapon: null, barricade: 0, sleepIndoors: false, backpack: false, lostAt: -1e9, revengeAt: -1e9,
  tools: false, coat: false, sickLeft: 0, sick: 0, buried: 0, found: 0, searches: 0, kills: 0, fish: 0, revived: 0, restored: 0, putDown: 0,
  built: {}, prog: {}, garden: null, pen: 0, research: { done: {}, active: null, progress: 0 }, carrying: null, ghostTown: 0, lastSeason: '', bubble: null, yearSaid: false, met: 0, journal: 0,
};
const COMPANIONS = [], ANIMALS = [], GRAVES = [], STRUCTS = [];
const aloneDays = () => (sim.hours - sim.aloneStart) / 24;
const harm = () => ({ forgiving: .5, realistic: 1, brutal: 1.6 }[cfg.after.difficulty] || 1);   // scales everything that hurts him outside
const nearestVillage = p => villDist(p.x, p.z)[1];
