// Quick screenshot helper: node scripts/shot.mjs "<query>" out.png [waitMs] [steps]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , query = '', out = 'artifacts/shot.png', waitMs = '3000'] = process.argv;
const base = process.env.GAME_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 768, height: 432 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(base + (query ? '?' + query : ''));
await page.waitForTimeout(parseInt(waitMs, 10));
await page.screenshot({ path: out });
const state = await page.evaluate(() => (window.__game ? window.__game.state() : null));
console.log(JSON.stringify(state));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
