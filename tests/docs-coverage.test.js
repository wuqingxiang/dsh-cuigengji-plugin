// Guard: every script referenced in the public docs exists, and every
// UI/feature test entry is reachable from the verification table in
// docs/development.md. Keeps docs and package.json honest as both evolve.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {relative, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const join = (...p) => p.join('/').replace(/\\/g, '/');
const pkg = JSON.parse(await readFile(join2(root, 'package.json'), 'utf8'));
function join2(...p) {return p.join('/').replace(/\\/g, '/');}

const docFiles = (await readdir(join(root, 'docs'), {recursive: true}))
  .filter(f => f.endsWith('.md')).map(f => join('docs', f));
docFiles.push('README.md', 'AGENTS.md');

test('every script referenced in public docs exists in package.json', async () => {
  const referenced = new Set();
  for (const doc of docFiles) {
    const text = await readFile(join(root, doc), 'utf8');
    for (const m of text.matchAll(/`(npm run )?(test[:][a-z0-9:-]+|check[:][a-z-]+)`/g)) referenced.add(m[2]);
  }
  const missing = [...referenced].filter(s => !pkg.scripts[s]);
  assert.deepEqual(missing, [], 'docs reference npm scripts that do not exist');
});

test('docs contain no broken local links', async () => {
  const broken = [];
  for (const doc of docFiles) {
    const text = await readFile(join(root, doc), 'utf8');
    for (const m of text.matchAll(/\]\(([^)#?]+?)(?:#[^)]*)?\)/g)) {
      const target = m[1].trim();
      if (/^(https?:|mailto:)/.test(target)) continue;
      await readFile(resolve(root, dirname(join(root, doc)), target)).catch(() => broken.push(`${doc} -> ${target}`));
    }
  }
  assert.deepEqual(broken, [], 'docs contain links to missing local files');
});

test('every test:* script is discoverable from the verification docs', async () => {
  const allDocs = (await Promise.all(docFiles.map(d => readFile(join(root, d), 'utf8')))).join('\n');
  // Core lifecycle scripts may live in prose/code blocks; test entries must
  // be named somewhere so a contributor can find how to run them.
  const orphans = Object.keys(pkg.scripts)
    .filter(s => s.startsWith('test:'))
    .filter(s => !allDocs.includes(`\`${s}\``));
  assert.deepEqual(orphans, [], 'test scripts exist that no public doc mentions');
});

test('docs reference only existing images, and feature screenshots stay out of the promo area', async () => {
  const referenced = new Set();
  for (const doc of docFiles) {
    const text = await readFile(join(root, doc), 'utf8');
    for (const m of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) referenced.add(m[1]);
    for (const m of text.matchAll(/\]\(([^)]+\.(?:png|jpg|jpeg|gif|webp|svg))\)/g)) referenced.add(m[1]);
  }
  const broken = [];
  for (const ref of referenced) {
    if (/^(https?:|mailto:)/.test(ref)) continue;
    await readFile(resolve(root, ref)).catch(() => broken.push(ref));
  }
  assert.deepEqual(broken, [], 'docs embed images that do not exist');
  // docs/screenshots holds real feature captures referenced by the docs;
  // promotional material belongs under .github/assets (AGENTS.md).
  const stray = (await readdir(join(root, 'docs', 'screenshots')).catch(() => []))
    .filter(name => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name) && !referenced.has(`docs/screenshots/${name}`));
  assert.deepEqual(stray, [], 'unreferenced images in docs/screenshots are promo material; move them to .github/assets');
});

test('install guide states the shipped version and floor it declares', async () => {
  const guide = await readFile(join(root, 'docs', 'getting-started.md'), 'utf8');
  assert.ok(guide.includes(`dsh-cuigengji-plugin@${pkg.version}`), 'install guide must name the shipped version');
  assert.ok(guide.includes(pkg.engines.dsh.replace(/^>=/, '')), 'install guide must state the declared DSH floor');
});

test('every public doc under docs/ is reachable from docs/README.md (AGENTS.md entry-point rule)', async () => {
  const index = await readFile(join(root, 'docs', 'README.md'), 'utf8');
  const orphans = (await readdir(join(root, 'docs')).catch(() => []))
    .filter(f => f.endsWith('.md') && f !== 'README.md' && !index.includes(f));
  assert.deepEqual(orphans, [], 'new public docs must be listed in docs/README.md');
});
