/* ------------------------------------------------------------------------- */
/* Static syntax check for every JavaScript module and test.                 */
/* Run with: npm run lint:js                                                 */
/* ------------------------------------------------------------------------- */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function collect(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      files.push(...collect(full));
    } else if (/\.(?:js|mjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = [
  ...collect(path.join(ROOT, 'js')),
  ...collect(path.join(ROOT, 'tests')),
  path.join(ROOT, 'server.mjs'),
  path.join(ROOT, 'scripts', 'check.mjs'),
];

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`\n✗ ${path.relative(ROOT, file)}`);
    console.error(result.stderr.trim());
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed the syntax check.`);
  process.exit(1);
}
console.log(`✓ ${files.length} JavaScript files parse cleanly.`);
