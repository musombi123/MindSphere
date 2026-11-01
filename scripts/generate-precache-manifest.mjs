import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const outputPath = path.join(distRoot, 'precache-manifest.json');

async function walk(directory, prefix = '') {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await walk(absolute, relative));
    } else if (entry.isFile() && relative !== 'precache-manifest.json' && relative !== 'sw.js') {
      output.push({ file: relative.replace(/\\/g, '/'), absolute });
    }
  }
  return output;
}

const entries = await walk(distRoot);
if (!entries.some((entry) => entry.file === 'index.html')) {
  throw new Error('Production dist/index.html is missing; run vite build first.');
}

const hash = createHash('sha256');
let totalBytes = 0;
const files = [];
for (const entry of entries) {
  const bytes = await readFile(entry.absolute);
  totalBytes += bytes.length;
  hash.update(entry.file);
  hash.update(bytes);
  files.push(entry.file);
}

const manifest = {
  schemaVersion: 1,
  appVersion: packageJson.version,
  buildId: hash.digest('hex').slice(0, 16),
  totalFiles: files.length,
  totalBytes,
  files
};

await writeFile(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('[Project Zero Hour] Offline precache manifest generated.');
console.log('  Files: ' + files.length);
console.log('  Payload: ' + (totalBytes / 1024 / 1024).toFixed(2) + ' MiB');
console.log('  Build ID: ' + manifest.buildId);
