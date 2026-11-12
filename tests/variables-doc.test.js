// Guard: the variables dialog's four tab labels stay documented in
// docs/variables.md, mirroring the story-sections guard for this feature.
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile('src/client/features/variables/index.tsx', 'utf8');
const doc = await readFile('docs/variables.md', 'utf8');

const tabMatch = source.match(/\[\['state','([^']+)'\]\s*,\s*\['definitions','([^']+)'\]\s*,\s*\['history','([^']+)'\]\s*,\s*\['import','([^']+)'\]\]/);
assert.ok(tabMatch, 'variables tab table not found');

test('every variables tab label is explained in docs/variables.md', () => {
  const labels = tabMatch.slice(1);
  const missing = labels.filter(label => !doc.includes(label));
  assert.deepEqual(missing, [], 'variables UI tabs absent from the user doc');
});
