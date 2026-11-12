// Guard: persona version markers must match the skill bodies they gate.
// The persona tells sessions "reload the skill if its loaded copy lacks this
// marker" — a stale marker pair silently keeps old instructions in use.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const joinRoot = (...p) => p.join('/').replace(/\\/g, '/');

const persona = await readFile(joinRoot(root, 'src', 'adapters', 'dsh', 'skills.js'), 'utf8');
const canvas = persona.match(/shared-canvas-v(\d+)/)?.[0];
const story = persona.match(/story-workflow-v(\d+)/)?.[0];
assert.ok(canvas && story, 'persona must carry both version markers');

test('skills carrying the shared-canvas marker match the persona version', async () => {
  const mismatches = [];
  for (const dir of (await readdir(joinRoot(root, 'skills'), {withFileTypes: true}))) {
    if (!dir.isDirectory()) continue;
    const text = await readFile(joinRoot(root, 'skills', dir.name, 'SKILL.md'), 'utf8');
    const mark = text.match(/shared-canvas-v(\d+)/)?.[0];
    if (mark && mark !== canvas) mismatches.push(`${dir.name}: ${mark} vs persona ${canvas}`);
  }
  assert.deepEqual(mismatches, [], 'skill marker drifted from persona; stale sessions keep old rules');
});

test('the story skill carries the story-workflow marker from the persona', async () => {
  const text = await readFile(joinRoot(root, 'skills', 'cuigengji-story', 'SKILL.md'), 'utf8');
  const mark = text.match(/story-workflow-v(\d+)/)?.[0];
  assert.equal(mark, story, 'story skill must track the persona story-workflow version');
});
