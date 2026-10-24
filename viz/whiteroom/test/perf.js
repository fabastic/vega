// Frame timing on this machine's GPU: life (town, follow, iso), the chamber and after.
//   viz/whiteroom/build.sh --test && node viz/whiteroom/test/perf.js
const { open } = require('./pw.js');
(async () => {
  const { b, p, errs, skip } = await open(__dirname + '/t.html', 1440, 900, { gpu: true });
  console.log('gpu', await p.evaluate(() => { const g = window.__v.renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; }));
  await p.evaluate(() => {
    const R = window.__v.renderer, o = R.render.bind(R), orig = window.requestAnimationFrame;
    window.__pf = { ft: [], rt: [], calls: 0, gaps: [], last: 0 };
    R.render = (s, c) => { const t = performance.now(); o(s, c); window.__pf.rt.push(performance.now() - t); window.__pf.calls = R.info.render.calls; };
    window.requestAnimationFrame = cb => orig(t => { const P = window.__pf, s = performance.now(); if (P.last) P.gaps.push(s - P.last); P.last = s; cb(t); P.ft.push(performance.now() - s); });
  });
  const measure = async label => {
    await p.evaluate(() => { const P = window.__pf; P.ft.length = P.rt.length = P.gaps.length = 0; P.last = 0; });
    await p.waitForTimeout(4000);
    const r = await p.evaluate(() => { const P = window.__pf, q = (a, k) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * k))].toFixed(1) : null; };
      return { fps: +(1000 / (q(P.gaps, .5) || 1)).toFixed(0), frameMs: q(P.ft, .5), frameP95: q(P.ft, .95), renderMs: q(P.rt, .5), calls: P.calls }; });
    console.log(label.padEnd(10), JSON.stringify(r));
  };
  // the same world every run, so timings compare
  await p.evaluate(() => { const c = window.__v.cfg(); c.world.fresh = false; c.world.seed = 4242; });
  await p.click('#begin'); await p.waitForTimeout(5000);
  await measure('town');
  await p.click('#vFollow').catch(() => {}); await p.waitForTimeout(1500); await measure('follow');
  await p.click('#vIso').catch(() => {}); await p.waitForTimeout(1500); await measure('iso');
  await p.click('#skipLife'); await p.waitForFunction(() => window.__v.sim.phase === 'chamber', null, { timeout: 300000 }); await p.waitForTimeout(2500);
  await measure('chamber');
  await p.click('#skipRoom'); await p.waitForFunction(() => window.__v.sim.phase === 'after', null, { timeout: 300000 }); await p.waitForTimeout(3000);
  await measure('after');
  console.log('ERR', JSON.stringify(errs.slice(0, 6)));
  await b.close();
})();
