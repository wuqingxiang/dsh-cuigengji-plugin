// Cross-check docs/story-workbench.md section names against the shipped UI
// section table in src/client/features/story/index.tsx (the source of truth).
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile('src/client/features/story/index.tsx', 'utf8');
const doc = await readFile('docs/story-workbench.md', 'utf8');

// The sections map in index.tsx: {overview:'…', chapters:'…', …}
const mapMatch = source.match(/const sections=\{([^}]+)\} as const/);
assert.ok(mapMatch, 'story section table not found in index.tsx');
const uiSections = {};
for (const m of mapMatch[1].matchAll(/(\w+):'([^']+)'/g)) uiSections[m[1]] = m[2];
const uiNames = new Set(Object.values(uiSections));

test('every shipped story section is documented in story-workbench.md', () => {
  const missing = Object.values(uiSections).filter(name => !doc.includes(name));
  assert.deepEqual(missing, [], 'story sections shipped in the UI but absent from the doc');
});

test('the doc documents exactly the twelve shipped sections', () => {
  // The doc's section table rows are the | name | lines under 十二个分区.
  const tableRows = [...doc.matchAll(/^\| ([^|]+) \|/gm)].map(m => m[1].trim())
    .filter(name => name && name !== '分区' && name !== '---');
  const documented = new Set(tableRows);
  const extra = [...documented].filter(name => !uiNames.has(name));
  assert.deepEqual(extra, [], 'doc documents sections that no longer exist in the UI');
});
