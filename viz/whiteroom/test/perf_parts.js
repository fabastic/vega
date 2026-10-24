// Where a town frame's render time goes: matrices, the shadow pass, the main pass.
//   viz/whiteroom/build.sh --test && node viz/whiteroom/test/perf_parts.js
const { open } = require('./pw.js');
(async () => {
  const { b, p, errs } = await open(__dirname + '/t.html', 1440, 900, { gpu: true });
  await p.evaluate(() => { const c = window.__v.cfg(); c.world.fresh = false; c.world.seed = 4242; });
  await p.click('#begin'); await p.waitForTimeout(5000);
  const r = await p.evaluate(async () => {
    const { renderer: R, scene, camera } = window.__v, gl = R.getContext();
    const time = (fn, n = 30) => { fn(); gl.finish(); const t = performance.now(); for (let i = 0; i < n; i++) fn(); gl.finish(); return +((performance.now() - t) / n).toFixed(2); };
    let objs = 0, meshes = 0; scene.traverse(o => { objs++; if (o.isMesh) meshes++; });
    const out = { objs, meshes };
    out.matrices = time(() => scene.updateMatrixWorld());
    out.full = time(() => R.render(scene, camera));
    R.shadowMap.autoUpdate = false; out.noShadowPass = time(() => R.render(scene, camera)); R.shadowMap.autoUpdate = true;
    scene.autoUpdate = false; R.shadowMap.autoUpdate = false; out.noShadowNoMatrices = time(() => R.render(scene, camera)); scene.autoUpdate = true; R.shadowMap.autoUpdate = true;
    out.calls = R.info.render.calls;
    return out;
  });
  console.log(JSON.stringify(r));
  console.log('ERR', JSON.stringify(errs.slice(0, 4)));
  await b.close();
})();
