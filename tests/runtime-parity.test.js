// Guard: the committed runtime/ build keeps the same guidance sections and
// skill registrations as src/. A stale or partial rebuild would ship agents a
// different capability set than the sources describe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const srcGuidance = await readFile('src/adapters/dsh/guidance.js', 'utf8');
const runtimeGuidance = await readFile('runtime/adapters/dsh/guidance.js', 'utf8');
const srcSkills = await readFile('src/adapters/dsh/skills.js', 'utf8');
const runtimeSkills = await readFile('runtime/adapters/dsh/skills.js', 'utf8');

function sectionKeys(text) {
  // src uses identifier keys ("story-long":), runtime quotes them ("story-long":).
  const keys = new Set();
  for (const m of text.matchAll(/["']?([a-z-]+)["']?\s*:\s*(?:entry|reference)\(/g)) keys.add(m[1]);
  return keys;
}

test('runtime guidance exposes the same sections as src', () => {
  const fromSrc = sectionKeys(srcGuidance);
  const fromRuntime = sectionKeys(runtimeGuidance);
  assert.ok(fromSrc.size >= 8, `unexpected guidance table size: ${fromSrc.size}`);
  assert.deepEqual([...fromRuntime].sort(), [...fromSrc].sort(), 'runtime/adapters/dsh/guidance.js sections diverge from src');
});

test('runtime skills register the same skill names as src', () => {
  // src uses single quotes, the build re-emits double quotes.
  const names = text => [...text.matchAll(/\["(cuigengji-[a-z]+)"|\['(cuigengji-[a-z]+)'/g)].map(m => m[1] || m[2]);
  assert.deepEqual(names(runtimeSkills).sort(), names(srcSkills).sort(), 'runtime/adapters/dsh/skills.js registrations diverge from src');
});

test('runtime guidance keeps the same reference file mapping as src', () => {
  // reference(id, title, "file") in runtime; ('file') in src.
  const files = text => [...text.matchAll(/,\s*["']([a-z-]+)["']\)/g)].map(m => m[1]).sort();
  const fromSrc = files(srcGuidance);
  assert.ok(fromSrc.length >= 7, `unexpected reference count: ${fromSrc.length}`);
  assert.deepEqual(files(runtimeGuidance), fromSrc, 'reference filename mapping diverges between src and runtime');
});
