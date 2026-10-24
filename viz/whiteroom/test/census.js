// What the scene's meshes are: per house, per person, and the largest of the rest.
//   viz/whiteroom/build.sh --test && node viz/whiteroom/test/census.js
const { open } = require('./pw.js');
(async () => {
  const { b, p, errs } = await open(__dirname + '/t.html', 1200, 800);
  await p.evaluate(() => { const c = window.__v.cfg(); c.world.fresh = false; c.world.seed = 4242; });
  await p.click('#begin'); await p.waitForTimeout(4000);
  console.log(JSON.stringify(await p.evaluate(() => {
    const v = window.__v, count = o => { let n = 0; o.traverse(x => { if (x.isMesh) n++; }); return n; };
    const houses = v.BUILDS.map(b => count(b.g)), people = v.citizens.map(c => count(c.h.root));
    const seen = new Set([...v.BUILDS.map(b => b.g), ...v.citizens.map(c => c.h.root)]);
    const rest = {}; v.scene.children.forEach(c => { if (seen.has(c)) return; const n = count(c); if (!n) return; const first = c.children[0], k = c.isMesh ? 'mesh:' + c.geometry.type : `${c.type}(${c.children.length}) first:${first ? first.type + (first.geometry ? ':' + first.geometry.type : '') : ''}`; rest[k] = (rest[k] || 0) + n; });
    const sum = a => a.reduce((s, x) => s + x, 0); let all = 0; v.scene.traverse(o => { if (o.isMesh) all++; });
    return { all, houses: v.BUILDS.length, perHouse: Math.round(sum(houses) / houses.length), people: people.length, perPerson: Math.round(sum(people) / people.length), rest: Object.entries(rest).sort((a, b) => b[1] - a[1]).slice(0, 8) };
  })));
  console.log('ERR', JSON.stringify(errs.slice(0, 4)));
  await b.close();
})();
