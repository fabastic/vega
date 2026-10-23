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

// ---------- research ----------
const RESEARCH = [
  { id: 'tools', name: 'Tools and weapons', books: 1, spec: 0, hours: 18, need: [], desc: 'A spear, an axe, a fishing line. Hunting, chopping and fishing all get easier.' },
  { id: 'agri', name: 'Agriculture', books: 2, spec: 0, hours: 40, need: ['tools'], desc: 'Seed saving and crop rotation. Gardens yield twice as much.' },
  { id: 'husbandry', name: 'Animal husbandry', books: 1, spec: 2, hours: 30, need: ['tools'], desc: 'He can pen chickens he catches. Eggs every day.' },
  { id: 'medicine', name: 'Medicine', books: 3, spec: 2, hours: 70, need: ['agri'], desc: 'Fever remedies from the library\'s herbals. He can study the dead to learn what killed them.' },
  { id: 'power', name: 'Power', books: 3, spec: 0, hours: 90, need: ['tools'], desc: 'Restart the facility\'s generator. The lab works again and research runs twice as fast.' },
  { id: 'biology', name: 'Biology', books: 4, spec: 6, hours: 140, need: ['medicine', 'power'], desc: 'How cells live and die. The first step toward undoing death.' },
  { id: 'reanimation', name: 'Reanimation', books: 2, spec: 8, hours: 180, need: ['biology'], revival: 'zombie', desc: 'Restart a body. What comes back is not quite the person.' },
  { id: 'regeneration', name: 'Regeneration', books: 5, spec: 15, hours: 420, need: ['reanimation'], revival: 'full', desc: 'Rebuild what decay took. Bring someone back as themselves.' },
];
const researchOn = () => cfg.after.research !== 'off';
const resAllowed = n => !n.revival || (n.revival === 'zombie' ? cfg.after.revival !== 'off' : cfg.after.revival === 'full');
function nextResearch() {
  if (!researchOn()) return null;
  return RESEARCH.find(n => !A.research.done[n.id] && resAllowed(n) && n.need.every(x => A.research.done[x])) || null;
}
const researchRate = () => ({ slow: .5, normal: 1, fast: 3 }[cfg.after.research] || 1) * (.5 + vegaC.p.curiosity * .5 + (vegaC.occupation === 'scholar' ? .5 : 0)) * (A.research.done.power ? 2 : A.built.workbench ? 1 : .5) * (.4 + S.grip * .6);
