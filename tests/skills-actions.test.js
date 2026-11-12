// Guard: skill documents must not teach agents to call actions that do not
// exist. Full tokens (dotted, lowercase) that match no shipped action AND no
// shipped action with a longer suffix are flagged — pure noun usage of
// parameter names (chapter.revision meaning "the latest revision") is
// tolerated when the domain prefix exists with other actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function resolve(...p) {return p.join('/').replace(/\\/g, '/');}

const actionsText = await readFile(join(root, 'src', 'contracts', 'actions.js'), 'utf8');
const shipped = new Set();
for (const m of actionsText.matchAll(/'([a-z]+(?:\.[a-z-]+)+)'/g)) shipped.add(m[1]);

const skillFiles = [];
for (const dir of (await readdir(join(root, 'skills'), {withFileTypes: true}))) {
  if (!dir.isDirectory()) continue;
  skillFiles.push(join('skills', dir.name, 'SKILL.md'));
  const refs = join('skills', dir.name, 'references');
  for (const f of await readdir(refs).catch(() => [])) {
    if (f.endsWith('.md')) skillFiles.push(join('skills', dir.name, 'references', f));
  }
}

test('skills reference only actions that exist in the shipped contracts', async () => {
  const offenders = [];
  for (const file of skillFiles) {
    const text = await readFile(join(root, file), 'utf8');
    for (const m of text.matchAll(/\b((?:novel|volume|chapter|graph|edge|planning|story|preset|context|binding|variables|guidance|cleanup)\.[a-z][a-z-]*(?:\.[a-z-]+)*)\b/g)) {
      const token = m[1];
      if (shipped.has(token)) continue;
      // Prefix-tolerant: graph.group is a truncation of graph.groups/graph.group.*.
      const prefixExists = [...shipped].some(a => a.startsWith(token + '.') || a === token + 's');
      // Parameter nouns: <domain>.revision used as "the latest revision of X".
      const isParameterNoun = /\.(revision|id|ids|list)$/.test(token) && [...shipped].some(a => a.startsWith(token.split('.')[0] + '.'));
      if (!prefixExists && !isParameterNoun) offenders.push(`${file}: ${token}`);
    }
  }
  assert.deepEqual([...new Set(offenders)], [], 'skills teach actions absent from src/contracts/actions.js');
});
