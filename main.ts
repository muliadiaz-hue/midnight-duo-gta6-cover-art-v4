// Midnight Duo — a GTA 6-style cover maker for gta6-cover-art-01.
//
// The app lives in app/ (plain static files: an editor that turns the
// duo's photos into a band poster and exports it as a PNG). This program
// hands it in: it copies app/ and screenshots/ beside this file into the
// output directory and writes dossier.json with the kit's vendored library.
// Run outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Hand-in summary, printed after the copy so a local run shows what the
// grader will receive. Kept deliberately small: one line per screenshot.
function handInSummary() {
  const shotsDir = join(out, 'screenshots');
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).sort() : [];
  const lines = shots.map((name) => {
    const bytes = statSync(join(shotsDir, name)).size;
    return `  ${name} (${bytes} bytes)`;
  });
  const dossierBytes = statSync(join(out, 'dossier.json')).size;
  console.log(`dossier.json (${dossierBytes} bytes)`);
  for (const line of lines) console.log(line);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

handInSummary();
