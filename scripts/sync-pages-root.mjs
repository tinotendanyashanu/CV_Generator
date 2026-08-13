import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  throw new Error('dist/index.html missing — run npm run build:pages first');
}

fs.copyFileSync(path.join(dist, 'index.html'), path.join(root, 'index.html'));
fs.copyFileSync(path.join(dist, 'index.html'), path.join(root, '404.html'));
fs.writeFileSync(path.join(root, '.nojekyll'), '');

const fromAssets = path.join(dist, 'assets');
const toAssets = path.join(root, 'assets');
fs.rmSync(toAssets, { recursive: true, force: true });
fs.cpSync(fromAssets, toAssets, { recursive: true });

console.log('Synced dist → repository root for GitHub Pages (master /).');
