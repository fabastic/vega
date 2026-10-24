const { chromium } = require('playwright');
// gpu: run the installed Chrome on this machine's graphics card, for timing; otherwise software GL, for repeatable screenshots
exports.open = async (file, w = 1440, h = 900, { gpu = false } = {}) => {
  const soft = { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] };
  // without Playwright's own browser downloaded, fall back to the installed Chrome
  const b = gpu ? await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit', ...(process.env.DGPU ? ['--force_high_performance_gpu'] : [])] })
    : await chromium.launch(soft).catch(() => chromium.launch({ ...soft, channel: 'chrome' }));
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
