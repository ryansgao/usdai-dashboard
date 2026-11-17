// Exercise the trading-style interactions on the CHIP price chart and the Overview assets chart:
// hover (crosshair + dimming + shared guide on other charts), drag to measure, legend-hover isolate, keyboard step.
// usage: node tools/interaction_check.cjs <base-url> <out-dir>
const { chromium } = require('playwright');
(async () => {
  const [base, out] = process.argv.slice(2);
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(base + '?tab=yield', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const ov = await p.$('#yield .ov'); const bb = await ov.boundingBox();
  await p.mouse.move(bb.x + bb.width * 0.4, bb.y + bb.height / 2); await p.waitForTimeout(200);
  const r = {};
  r.dim = await p.$eval('#yield .xhair .dim', (n) => +n.getAttribute('width'));
  r.ghosts = await p.$$eval('.ghost', (ns) => ns.filter((n) => n.style.display !== 'none').length);
  await p.mouse.down(); await p.mouse.move(bb.x + bb.width * 0.8, bb.y + bb.height / 2, { steps: 8 }); await p.waitForTimeout(150);
  r.measure = await p.$eval('#yield .mlabel', (n) => n.textContent);
  await p.screenshot({ path: out + '/drag.png', clip: { x: bb.x - 60, y: bb.y - 120, width: bb.width + 80, height: bb.height + 200 } });
  await p.mouse.up();
  const leg = await p.$('#yield .legend button'); await leg.hover(); await p.waitForTimeout(250);
  r.faded = await p.$$eval('#yield svg [data-s].faded', (ns) => ns.length);
  await p.focus('#yield .chart svg[tabindex]'); await p.keyboard.press('End'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
  r.keyTip = await p.$eval('#yield .tip', (n) => n.style.opacity);
  await p.screenshot({ path: out + '/legend.png', clip: { x: bb.x - 60, y: bb.y - 120, width: bb.width + 80, height: bb.height + 220 } });
  console.log(JSON.stringify({ ...r, errs }));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
