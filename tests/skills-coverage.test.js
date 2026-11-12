// Guard: every skill registered in skillSpecs exists on disk with a SKILL.md,
// every guidance reference file resolves, and no skill folder is orphaned.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';
import {skillSpecs} from '../src/adapters/dsh/skills.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('every registered skill exists with a SKILL.md', async () => {
  const missing = [];
  for (const [name] of skillSpecs) {
    await readFile(join(root, 'skills', name, 'SKILL.md')).catch(() => missing.push(name));
  }
  assert.deepEqual(missing, [], 'skillSpecs reference skill folders that do not exist');
});

test('no skill folder is orphaned (unregistered)', async () => {
  const folders = (await readdir(join(root, 'skills'), {withFileTypes: true}))
    .filter(d => d.isDirectory()).map(d => d.name);
  const registered = new Set(skillSpecs.map(([name]) => name));
  const orphans = folders.filter(f => !registered.has(f));
  assert.deepEqual(orphans, [], 'skill folders exist that skillSpecs do not register');
});

test('every guidance section file exists in its skill folder', async () => {
  // Mirrors the reference table in src/adapters/dsh/guidance.js: modules map
  // to skills/<section>/SKILL.md; story references map to
  // skills/cuigengji-story/references/<file>.md via the table there.
  const {GUIDANCE_SECTIONS} = await import('../src/adapters/dsh/guidance.js');
  const referenceFiles = {
    'story-long': 'long-form.md', 'story-short': 'short-form.md',
    'story-outline': 'outline.md', 'story-tracking': 'tracking.md',
    'story-review': 'review.md', 'story-deslop': 'deslop.md',
    'story-operations': 'operations.md',
  };
  const broken = [];
  for (const section of GUIDANCE_SECTIONS) {
    // core is the compiled persona; preset/all assemble at runtime.
    if (['core', 'preset', 'all'].includes(section)) continue;
    const candidate = referenceFiles[section]
      ? join(root, 'skills', 'cuigengji-story', 'references', referenceFiles[section])
      : join(root, 'skills', `cuigengji-${section}`, 'SKILL.md');
    await readFile(candidate).catch(() => broken.push(section));
  }
  assert.deepEqual(broken, [], 'guidance sections point to missing skill files');
});
