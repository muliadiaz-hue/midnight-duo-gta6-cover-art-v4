// tools/shots.mjs — takes the four screenshots for the Midnight Duo entry
// with headless Chromium (Playwright, already in the arsenal): it serves
// app/ with serve.ts, loads each ?shot= URL from shots.json, waits for the
// app to mark the frame ready, and saves a JPEG into screenshots/.
// Usage: node tools/shots.mjs [--port 8901] [--quality 85]

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun/arsenal/tools-js/node_modules/playwright');

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex === -1 ? 8901 : Number(args[portIndex + 1]);
const qualityIndex = args.indexOf('--quality');
const quality = qualityIndex === -1 ? 85 : Number(args[qualityIndex + 1]);

const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));

const server = spawn('node', ['serve.ts', '--port', String(port)], {
  cwd: repo,
  stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await chromium.launch();
try {
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[${shot.name}] console error:`, msg.text());
    });
    page.on('pageerror', (err) => console.log(`[${shot.name}] page error:`, String(err)));
    await page.goto(`http://127.0.0.1:${port}/${shot.query}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(
        () => document.documentElement.dataset.shotReady === '1' || document.documentElement.dataset.shotError,
        { timeout: 15000 },
      );
    } catch {
      console.log(`[${shot.name}] WARNING: shot-ready flag never appeared`);
    }
    const err = await page.evaluate(() => document.documentElement.dataset.shotError || '');
    if (err) console.log(`[${shot.name}] shot error: ${err}`);
    await page.waitForTimeout(400);
    const out = join(repo, 'screenshots', shot.name);
    await page.screenshot({ path: out, type: 'jpeg', quality });
    console.log(`${shot.name}: ${shot.w}x${shot.h} -> ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log('done');
