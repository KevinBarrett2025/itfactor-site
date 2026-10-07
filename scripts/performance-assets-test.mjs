import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const marketingNames = [
  'ActorKit',
  'Editor',
  'Export',
  'Hero',
  'Ratings',
  'SizeCard',
  'Slate',
  'iCloud',
  'watch',
];

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(target));
    else if (entry.name.endsWith('.html')) files.push(target);
  }
  return files;
}

test('rendered pages use the optimized brand asset, not the oversized source logo', async () => {
  for (const file of await htmlFiles(fileURLToPath(root))) {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /src=["']\/?logo\.png["']/);
  }
});

test('rendered marketing images use responsive WebP candidates', async () => {
  let optimizedReferences = 0;
  for (const file of await htmlFiles(fileURLToPath(root))) {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /src=["']\/?assets\/marketing\/[^"']+\.png["']/);
    optimizedReferences += (html.match(/assets\/marketing\/webp-v1\//g) || []).length;
  }
  assert.ok(optimizedReferences > 50, 'expected responsive marketing image references');
});

test('all versioned WebP candidates exist, are valid containers, and are materially smaller', async () => {
  for (const name of marketingNames) {
    const source = new URL(`../assets/marketing/${name}.png`, import.meta.url);
    const sourceSize = (await stat(source)).size;
    for (const width of [480, 768, 1284]) {
      const candidate = new URL(`../assets/marketing/webp-v1/${name}-${width}.webp`, import.meta.url);
      const bytes = await readFile(candidate);
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP');
      assert.ok(bytes.length < sourceSize * 0.2, `${name}-${width} should be at least 80% smaller`);
    }
  }
});

test('homepage preloads the responsive hero and versioned assets have immutable caching', async () => {
  const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(homepage, /rel="preload"[\s\S]*imagesrcset="[^"]*Hero-480\.webp 480w,[^"]*Hero-1284\.webp 1284w"/);
  const headers = await readFile(new URL('../_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/assets\/brand\/logo-176-v1\.webp[\s\S]*max-age=31536000, immutable/);
  assert.match(headers, /\/assets\/marketing\/webp-v1\/\*[\s\S]*max-age=31536000, immutable/);
});

test('web app manifest references existing icon files with accurate sizes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../site.webmanifest', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.icons, [
    { src: '/favicon_192.png', sizes: '192x192', type: 'image/png' },
    { src: '/favicon.png', sizes: '512x512', type: 'image/png' },
  ]);
  for (const icon of manifest.icons) await stat(new URL(`..${icon.src}`, import.meta.url));
});
