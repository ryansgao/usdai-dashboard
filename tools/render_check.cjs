// Load every tab in headless Chromium (1440 light, 390 dark) and fail on a console error, a tab with too few charts,
// a chart with no marks, broken numbers (NaN, undefined, Infinity) or sideways overflow.
// usage: node tools/render_check.cjs <base-url>   (needs the playwright package; CHROME=<path> to pick a browser)
const { chromium } = require('playwright');
const TABS = ['overview', 'vault', 'loans', 'yield', 'redemptions', 'chip', 'valuation', 'method'];
const MIN_SVG = { overview: 2, vault: 4, loans: 2, yield: 3, redemptions: 1, chip: 2, valuation: 0, method: 0 };
const PASSES = [{ w: 1440, h: 900, scheme: 'light' }, { w: 390, h: 844, scheme: 'dark' }];
(async () => {
  const base = process.argv[2].replace(/\/?$/, '/');
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const bad = [];
  for (const pass of PASSES) for (const t of TABS) {
    const p = await b.newPage({ viewport: { width: pass.w, height: pass.h }, colorScheme: pass.scheme });
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + '?tab=' + t, { waitUntil: 'networkidle', timeout: 60000 });
    for (let y = 0; y < 9000; y += 700) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(40); }
    await p.waitForTimeout(900);
    const r = await p.evaluate(() => {
      const svgs = [...document.querySelectorAll('.chart svg, .diagram svg')];
      const empty = svgs.filter((s) => !s.querySelector('path[d]:not([d=""]), rect[height]:not([height="0"])')).length;
      const text = document.querySelector('#view').innerText + ' ' + document.querySelector('#quote').innerText;
      const broken = (text.match(/NaN|Infinity|undefined|\$–|–%/g) || []).slice(0, 8);
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      return { svgs: svgs.length, empty, len: text.length, broken, overflow };
    });
    if (errs.length || r.svgs < MIN_SVG[t] || r.empty || r.len < 200 || r.broken.length || r.overflow) bad.push({ t, w: pass.w, errs, ...r });
    await p.close();
  }
  await b.close();
  if (bad.length) { console.error(JSON.stringify(bad, null, 1)); process.exit(1); }
  console.log(`render ok: ${TABS.length} tabs × ${PASSES.length} passes`);
})().catch((e) => { console.error(e.message); process.exit(1); });
