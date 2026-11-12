// Guard: the detector chain stays closed. Every rule key in the engine's
// RULES table must be reachable by a scan, every pushed type must exist in
// RULES, and every rule must carry its Chinese label and layer mapping in
// the DetectBoard — otherwise the workbench shows a raw English rule id to
// authors, or a rule silently never fires.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scanProse} from '../src/domain/story/detect/engine.js';

const engine = await readFile('src/domain/story/detect/engine.js', 'utf8');
const board = await readFile('src/client/features/story/DetectBoard.tsx', 'utf8');

function top(text, name) {
  const i = text.indexOf(name);
  const chunk = text.slice(i, text.indexOf('\n};', i));
  return new Set([...chunk.matchAll(/'([a-z-]+)':/g)].map(m => m[1]));
}
const rules = top(engine, 'const RULES');
// Pushed types: direct literals + per-line table + global() helpers.
const pushed = new Set([...engine.matchAll(/push\('([a-z-]+)'/g)].map(m => m[1]));
for (const m of engine.matchAll(/\['([a-z-]+)',\s*[A-Z_]/g)) pushed.add(m[1]);
for (const m of engine.matchAll(/global\('([a-z-]+)'/g)) pushed.add(m[1]);
const uiTypes = new Set([...board.matchAll(/'([a-z-]+)':'[^']+'/g)].map(m => m[1]));
const layerMap = new Set([...board.matchAll(/'([a-z-]+)':'(?:expression|narrative|logic)'/g)].map(m => m[1]));

test('every detector rule fires on some scan (no dead rules)', () => {
  assert.ok(rules.size >= 20, `unexpected RULES size ${rules.size}`);
  const dead = [...rules].filter(r => !pushed.has(r));
  assert.deepEqual(dead, [], 'rules registered but never pushed by scanProse');
});

test('every pushed type exists in RULES', () => {
  const ghost = [...pushed].filter(t => !rules.has(t));
  assert.deepEqual(ghost, [], 'scanProse pushes types with no rule metadata');
});

test('every rule has a Chinese label and layer mapping in the board', () => {
  assert.deepEqual([...rules].filter(r => !uiTypes.has(r)), [], 'rules without author-facing labels');
  assert.deepEqual([...rules].filter(r => !layerMap.has(r)), [], 'rules without layer mapping');
});

test('a probe manuscript triggers at least several distinct rule types', () => {
  const probe = [
    '他不是不敢，而是不能。',
    '命运在这一刻才刚刚开始。',
    '她微微一笑，指尖轻轻划过桌沿。他缓缓抬头。她又轻轻叹了口气。他微微颔首。她轻轻放下茶杯。',
    '他深吸一口气，眸光微动，一丝不易察觉的弧度浮上嘴角。',
    '——他想。',
  ].join('\n\n');
  const findings = scanProse(probe);
  const kinds = new Set(findings.map(f => f.type));
  assert.ok(kinds.size >= 4, `probe manuscript should exercise multiple rules, got ${[...kinds]}`);
  for (const f of findings) {
    assert.equal(typeof f.line, 'number');
    assert.ok(f.line >= 1, 'findings are chapter-relative, 1-based');
  }
});
