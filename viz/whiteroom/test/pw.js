const { chromium } = require('playwright');
exports.open = async (file, w = 1440, h = 900) => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/three.min.js', contentType: 'text/javascript' }));
  await p.route('**/OrbitControls.js', r => r.fulfill({ path: __dirname + '/orbit.js', contentType: 'text/javascript' }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
  const html = require('fs').readFileSync(file, 'utf8');
  await p.setContent('<!doctype html><html><head><meta charset=utf8></head><body>' + html + '</body></html>', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const skip = async hrs => { await p.evaluate(h => { window.__v.sim.skipTo = window.__v.sim.hours + h; }, hrs); await p.waitForFunction(() => window.__v.sim.skipTo == null, null, { timeout: 400000 }); };
  return { b, p, errs, skip };
};
