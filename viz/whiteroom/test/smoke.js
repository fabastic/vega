const { open } = require('./pw.js');
(async () => {
  const { b, p, errs, skip } = await open(__dirname + '/t.html');
  const shot = n => p.screenshot({ path: __dirname + '/' + n + '.png' });
  const st = () => p.evaluate(() => { const v = window.__v, S = v.S; return JSON.stringify({ ph: v.sim.phase, d: (v.sim.hours / 24).toFixed(1), beh: v.sim.phase === 'chamber' ? v.ROOM.beh && v.ROOM.beh.kind : v.A.beh && v.A.beh.kind, grip: S.grip && +S.grip.toFixed(2), hp: S.health && +S.health.toFixed(2), depth: S.depth && +S.depth.toFixed(2), ptsd: S.ptsd && +S.ptsd.toFixed(2) }); });
  // a short run: 12 days of life, 20 in the chamber
  await p.click('button[data-t="chamber"]');
  await p.evaluate(() => { const r = document.querySelector('input[data-k="time.chamberDays"]'); r.value = 20; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('button[data-t="world"]');
  await p.evaluate(() => { const r = document.querySelector('input[data-k="time.lifeDays"]'); r.value = 12; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('#begin'); await p.waitForTimeout(6000);
  console.log('life', await st(), JSON.stringify(errs.slice(0, 4)));
  await skip(24 * 6);
  console.log('romance', await p.evaluate(() => { const v = window.__v; return v.citizens.filter(c => c.partner || c.crush).map(c => `${c.name}->${c.partner ? 'P:' + c.partner.name : 'C:' + c.crush.name}`).join(' ') + ' | purchases ' + v.citizens.reduce((s, c) => s + (c.purchases || 0), 0); }));
  await p.click('#vIso'); await p.waitForTimeout(2500); await shot('s_iso');
  console.log('ERR life', JSON.stringify(errs.slice(0, 6)));
  await p.click('#skipLife'); await p.waitForFunction(() => window.__v.sim.phase === 'chamber', null, { timeout: 300000 }); await p.waitForTimeout(3000);
  for (const id of ['rat', 'mirror', 'photo']) await p.click(`#rGod button[data-g="${id}"]`);
  await skip(24 * 8); await p.click('[data-s="1"]'); await p.waitForTimeout(2500); await shot('s_room');
  console.log('chamber', await st(), await p.evaluate(() => document.querySelector('#rFeel').textContent.slice(0, 200)));
  console.log('ERR chamber', JSON.stringify(errs.slice(0, 6)));
  await p.click('#skipRoom'); await p.waitForFunction(() => window.__v.sim.phase === 'after', null, { timeout: 300000 }); await p.waitForTimeout(4000);
  await skip(24 * 4); await p.click('[data-s="1"]'); await p.waitForTimeout(2500); await shot('s_after');
  console.log('after', await st());
  console.log('ERR', JSON.stringify(errs.slice(0, 10)));
  await b.close();
})();
