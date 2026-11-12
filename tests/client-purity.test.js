// Guards the client↔domain sharing boundary: every non-type import from the
// client must stay browser-safe. A node: dependency added to shared domain
// logic would break the client bundle at build time with no early signal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const root = new URL('../', import.meta.url);
const clientDir = new URL('src/client/', root);

const isSource = name => /\.(tsx?|jsx?)$/.test(name);
const files = await readdir(clientDir, {recursive: true, withFileTypes: true});
const clientFiles = files.filter(entry => entry.isFile() && isSource(entry.name))
  .map(entry => resolve(entry.parentPath, entry.name));

// Resolve relative specifiers the way esbuild does for this tree: .ts/.tsx/.js
// extensions as written, then extension-less with .ts/.tsx/.js/.jsx/.index.
function resolveSpecifier(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`];
  return candidates;
}

/** One graph walk over client sources collecting cross-layer imports. */
async function collectImports() {
  const crossLayer = [];
  for (const file of clientFiles) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/from\s+'(\.[^']+)'/g)) {
      const specifier = match[1];
      // The shared-logic boundary is domain/ and application/queries/.
      if (!/\/(?:domain|application\/queries)\//.test(specifier)) continue;
      const typeOnly = new RegExp(`import\\s+type\\s*\\{[^}]*\\}\\s*from\\s+'${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(text);
      crossLayer.push({file, specifier, typeOnly});
    }
  }
  return crossLayer;
}

/** Node builtins reachable from an entry file, following relative imports. */
async function nodeDepsOf(entry, seen = new Set()) {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const text = await readFile(entry, 'utf8').catch(() => '');
  if (!text) return [];
  const found = new Set();
  for (const match of text.matchAll(/from\s+'(node:[^']+)'|require\('(node:[^']+)'\)/g)) {
    found.add(match[1] || match[2]);
  }
  for (const match of text.matchAll(/from\s+'(\.[^']+)'/g)) {
    for (const candidate of resolveSpecifier(entry, match[1])) {
      const inner = await nodeDepsOf(candidate, seen);
      inner.forEach(dep => found.add(dep));
      if (inner.length || await readFile(candidate, 'utf8').catch(() => null)) break;
    }
  }
  return [...found];
}

test('runtime imports from domain stay browser-safe with no node: dependencies', async () => {
  const imports = await collectImports();
  // The boundary is used at all; keep this honest as the codebase evolves.
  assert.ok(imports.length >= 30, `expected the client to share domain logic, found ${imports.length} imports`);
  const runtime = imports.filter(item => !item.typeOnly);
  assert.ok(runtime.length > 0, 'runtime (non-type) shared imports must exist');
  const offenders = [];
  for (const item of runtime) {
    for (const candidate of resolveSpecifier(item.file, item.specifier)) {
      const text = await readFile(candidate, 'utf8').catch(() => null);
      if (text !== null) {
        const deps = await nodeDepsOf(candidate);
        if (deps.length) offenders.push(`${item.file} -> ${item.specifier} (via ${candidate}) pulls in ${deps.join(', ')}`);
        break;
      }
    }
  }
  assert.deepEqual(offenders, [],
    'files shared with the client must not depend on node: builtins; extract the pure part or move the import');
});
