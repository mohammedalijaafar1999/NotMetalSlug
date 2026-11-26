// After `vite build`: produce dist/iron-ruckus.html - a single self-contained HTML file
// (JS inlined) that can be opened directly or hosted anywhere.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const htmlPath = join(dist, 'index.html');
if (!existsSync(htmlPath)) {
  console.error('dist/index.html missing - run vite build first');
  process.exit(1);
}
let html = readFileSync(htmlPath, 'utf8');
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_m, src) => {
  const js = readFileSync(join(dist, src.replace(/^\.\//, '')), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_m, href) => {
  const css = readFileSync(join(dist, href.replace(/^\.\//, '')), 'utf8');
  return `<style>${css}</style>`;
});
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
writeFileSync(join(dist, 'iron-ruckus.html'), html);
console.log(`wrote dist/iron-ruckus.html (${(html.length / 1024).toFixed(0)} KB)`);
