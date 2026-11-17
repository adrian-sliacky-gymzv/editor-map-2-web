import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'indexnow.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const keyFile = path.join(root, `${config.key}.txt`);

if (!/^[a-f0-9]{32}$/.test(config.key)) {
  throw new Error('indexnow.json: key must be 32 lowercase hex characters');
}
if (!fs.existsSync(keyFile)) {
  throw new Error(`IndexNow key file is missing: ${path.basename(keyFile)}`);
}
if (fs.readFileSync(keyFile, 'utf8').trim() !== config.key) {
  throw new Error('IndexNow key file does not match indexnow.json');
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const urls = args.filter((url) => /^https:\/\//.test(url));
const urlList = urls.length ? urls : config.urls;
const body = {
  host: config.host,
  key: config.key,
  keyLocation: config.keyLocation,
  urlList,
};

if (dryRun) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
const text = await response.text();

if (!response.ok) {
  console.error(`IndexNow failed: HTTP ${response.status}${text ? ` — ${text}` : ''}`);
  process.exitCode = 1;
} else {
  console.log(`IndexNow accepted ${urlList.length} URL(s): HTTP ${response.status}${text ? ` — ${text}` : ''}`);
}
