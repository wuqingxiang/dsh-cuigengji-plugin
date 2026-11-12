// Guard: the three action surfaces stay coherent as actions evolve.
//   TOOL_ACTIONS — what DSH tools expose to agents
//   HUMAN_ACTIONS — what the workbench UI may call through RPC
//   MEMORY_ACTIONS — what the MCP bridge exposes
import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_ACTIONS, HUMAN_ACTIONS, MEMORY_ACTIONS} from '../src/contracts/actions.js';

const tool = new Set(Object.values(TOOL_ACTIONS).flat());
const human = new Set(HUMAN_ACTIONS);
const memory = new Set(MEMORY_ACTIONS);

test('every DSH tool action is callable by the UI surface', () => {
  // novel.focus is deliberately agent-only (the session's own book choice).
  const agentOnly = new Set(['novel.focus']);
  const missing = [...tool].filter(a => !human.has(a) && !agentOnly.has(a));
  assert.deepEqual(missing, [], 'tool actions unreachable from HUMAN_ACTIONS');
});

test('every MCP action is a DSH tool action except the guidance reader', () => {
  // guidance.read rides the MCP surface for on-demand rules; agents get it
  // through the dedicated cuigengji_guidance tool instead.
  const mcpOnly = new Set(['guidance.read']);
  const missing = [...memory].filter(a => !tool.has(a) && !mcpOnly.has(a));
  assert.deepEqual(missing, [], 'MCP exposes actions no DSH tool provides');
});

test('MCP stays scoped to memory/variables/preset surfaces', () => {
  const scopedPrefixes = ['graph.', 'edge.', 'variables.', 'preset.'];
  const outOfScope = [...memory].filter(a => !scopedPrefixes.some(p => a.startsWith(p)) && a !== 'guidance.read' && a !== 'context.get');
  assert.deepEqual(outOfScope, [], 'MCP surface grew beyond its memory-bridge scope');
});
