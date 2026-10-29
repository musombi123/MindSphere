import { cp, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const payloads = [
  ['node_modules/three/examples/jsm/libs/draco/gltf', 'public/decoders/draco'],
  ['node_modules/three/examples/jsm/libs/basis', 'public/decoders/basis']
];

for (const [source, target] of payloads) {
  const from = resolve(root, source);
  const to = resolve(root, target);
  try {
    await access(from);
    await mkdir(to, { recursive: true });
    await cp(from, to, { recursive: true, force: true });
    process.stdout.write('[character-pipeline] Copied ' + source + ' -> ' + target + '\n');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.warn('[character-pipeline] Decoder source not found: ' + source + '. Compressed assets using this codec will not load until the copy path is updated.');
    } else {
      throw error;
    }
  }
}
