// Browser smoke test: plays every mission with the autopilot (invincible, fast-forward) in
// headless Chromium, captures screenshots and console errors.
//   node scripts/smoke.mjs                 (uses dev server at GAME_URL or http://localhost:5173/)
//   node scripts/smoke.mjs --dist          (serves dist/ and loads the single-file build)
//   node scripts/smoke.mjs --missions=1,3 --timeout=300 --speed=8 --shots=6
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  }),
);
const timeout = parseInt(args.timeout ?? '300', 10);
const speed = parseInt(args.speed ?? '8', 10);
const shots = parseInt(args.shots ?? '4', 10);
const outDir = args.out ?? 'artifacts/smoke';
mkdirSync(outDir, { recursive: true });

let server = null;
let url = process.env.GAME_URL ?? 'http://localhost:5173/';
if (args.dist) {
  if (!existsSync('dist/iron-ruckus.html')) {
    console.error('dist/iron-ruckus.html missing: run npm run build');
    process.exit(1);
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  server = createServer((req, res) => {
    const p = req.url.split('?')[0];
    const f = join('dist', p === '/' ? 'iron-ruckus.html' : p);
    try {
      const data = readFileSync(f);
      res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  }).listen(4173);
  url = 'http://localhost:4173/';
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 768, height: 432 } });
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));
await page.goto(url + '?mute=1&fast=1&seed=7');
await page.waitForFunction(() => window.__game && window.__game.scene && window.__game.scene !== 'boot', null, { timeout: 30000 });

const levels = await page.evaluate(() => window.__game.levels());
let missions = levels.filter((l) => l.mission >= 1).map((l) => l.mission);
if (args.missions) missions = args.missions.split(',').map(Number);
if (!missions.length) {
  console.log('No missions registered yet; checking sandbox only.');
}
const results = [];
for (const m of missions.length ? missions : [0]) {
  const errStart = consoleErrors.length;
  await page.evaluate(
    ({ m, speed }) => {
      const g = window.__game;
      g.invincible(true);
      g.autopilot(true);
      g.speed(speed);
      if (m === 0) g.startMission(0, { levelId: 'sandbox' });
      else g.startMission(m);
    },
    { m, speed },
  );
  const t0 = Date.now();
  let st = null;
  let shot = 0;
  const shotEvery = (timeout * 1000) / Math.max(1, shots);
  let nextShot = 2000;
  let maxCam = 0;
  while (Date.now() - t0 < timeout * 1000) {
    await page.waitForTimeout(500);
    st = await page.evaluate(() => window.__game.state());
    if (st.camX !== undefined) maxCam = Math.max(maxCam, st.camX);
    if (Date.now() - t0 > nextShot && shot < shots) {
      await page.screenshot({ path: `${outDir}/m${m}_${++shot}.png` });
      nextShot += shotEvery / 2;
    }
    if (st.scene !== 'gameplay' || st.phase === 'complete' || st.worldState === 'complete') break;
  }
  await page.screenshot({ path: `${outDir}/m${m}_end.png` });
  const done = st && (st.phase === 'complete' || st.worldState === 'complete' || st.scene === 'tally');
  const errs = consoleErrors.slice(errStart);
  results.push({ mission: m, completed: !!done, seconds: Math.round((Date.now() - t0) / 1000), gameTime: Math.round(st?.time ?? 0), maxCam, levelW: st?.levelW, boss: st?.boss, errors: errs.length, firstError: errs[0] ?? '' });
  console.log(JSON.stringify(results[results.length - 1]));
  await page.evaluate(() => window.__game.speed(1));
}
const fpsInfo = await page.evaluate(() => window.__game.app.loop.fps);
console.log('fps (last)', fpsInfo);
await browser.close();
server?.close();
const failed = results.filter((r) => !r.completed || r.errors > 0);
console.log(failed.length ? `SMOKE FAILED (${failed.length})` : 'SMOKE OK');
process.exit(failed.length ? 1 : 0);
