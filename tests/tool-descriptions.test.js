// Guard: action tokens in DSH tool descriptions (src/index.js) must resolve
// to shipped actions on some reachable surface. File-path tokens
// (guidance.js) and MCP-internal handlers are excluded as non-actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOOL_ACTIONS, HUMAN_ACTIONS, MEMORY_ACTIONS} from '../src/contracts/actions.js';

const index = await readFile('src/index.js', 'utf8');
const tool = new Set(Object.values(TOOL_ACTIONS).flat());
const human = new Set(HUMAN_ACTIONS);
const memory = new Set(MEMORY_ACTIONS);
const anySurface = a => tool.has(a) || human.has(a) || memory.has(a);

test('tool descriptions reference only actions that exist on some surface', () => {
  const offenders = new Set();
  for (const m of index.matchAll(/\b((?:novel|volume|chapter|graph|edge|planning|story|preset|context|binding|variables|guidance|cleanup|library|workspace|transfer|maintenance|activity|pet|usage)\.[a-z][a-z-]*(?:\.[a-z-]+)*)\b/g)) {
    const token = m[1];
    if (/\.(js|ts|mjs)$/.test(token)) continue; // import paths, not actions
    if (anySurface(token)) continue;
    const prefixOk = [...anySurfaceSet()].some(a => a.startsWith(token + '.') || a === token + 's');
    const nounOk = /\.(revision|id|ids|read|sync|close|start)$/.test(token) && prefixInDomain(token);
    if (!prefixOk && !nounOk) offenders.add(token);
  }
  assert.deepEqual([...offenders], [], 'descriptions teach actions no surface provides');
});

function* anySurfaceSet() {yield* tool; yield* human; yield* memory;}
function prefixInDomain(token) {
  const domain = token.split('.')[0];
  return [...anySurfaceSet()].some(a => a.startsWith(domain + '.'));
}
