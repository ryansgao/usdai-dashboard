const { chromium } = require('playwright');
(async () => {
  const [url, out, w, h, scheme, full, hash] = process.argv.slice(2);
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: scheme, deviceScaleFactor: 1 });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto(url + (hash || ''), { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  // scroll through to trigger lazy work
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 700) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(60); }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
  await p.screenshot({ path: out, fullPage: full === '1' });
  console.log(JSON.stringify({ errs, height: H }));
  await b.close();
})();
