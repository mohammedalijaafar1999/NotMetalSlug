// Run a scenario and capture screenshots over time.
//   node scripts/play.mjs "<query>" <outPrefix> <seconds> <shots> [width]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , query = '', prefix = 'artifacts/play', secs = '10', shots = '4', width = '768'] = process.argv;
const base = process.env.GAME_URL ?? 'http://localhost:5173/';
const W = parseInt(width, 10);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: Math.round(W * 9 / 16) }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(base + (query ? '?' + query : ''));
const total = parseFloat(secs) * 1000;
const n = parseInt(shots, 10);
for (let i = 1; i <= n; i++) {
  await page.waitForTimeout(total / n);
  await page.screenshot({ path: `${prefix}${i}.png` });
}
const state = await page.evaluate(() => (window.__game ? window.__game.state() : null));
console.log(JSON.stringify(state));
const errs = await page.evaluate(() => (window.__game ? window.__game.errors : []));
console.log('errors:', errs.length, errs.slice(0, 10).join('\n'));
console.log([...new Set(logs)].slice(0, 30).join('\n'));
await browser.close();
