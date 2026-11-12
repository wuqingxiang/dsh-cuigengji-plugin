/** Shared preview-server plumbing for the UI regression scripts.
 *
 * Every ui-*.mjs script starts the disposable workbench preview the same
 * way: spawn the script, await its JSON ready line, and tear it down at the
 * end. Centralizing it keeps the per-script boilerplate to one call.
 *
 * No desktop profile, real novels or model calls are involved. */
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');

/** Start the preview and resolve once its stdout prints the ready JSON line.
 * @param {string[]} args extra argv for scripts/preview-workbench.mjs (e.g. ['--story-demo'])
 * @param {{timeoutMs?: number}} options
 * @returns {Promise<{url: string, preview: import('node:child_process').ChildProcess, root: string}>} */
export async function startPreview(args = [], {timeoutMs = 30000} = {}) {
  const preview = spawn(process.execPath, ['scripts/preview-workbench.mjs', ...args], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  const {url} = await new Promise((done, reject) => {
    let output = '', errors = '';
    const timeout = setTimeout(() => reject(new Error(errors || `Preview was not ready within ${timeoutMs}ms`)), timeoutMs);
    preview.stderr.on('data', chunk => {errors += chunk;});
    preview.once('exit', code => {clearTimeout(timeout); reject(new Error(`Preview exited ${code}: ${errors}`));});
    preview.stdout.on('data', chunk => {
      output += chunk;
      const line = output.split('\n').find(value => value.startsWith('{'));
      if (line) {clearTimeout(timeout); done(JSON.parse(line));}
    });
  });
  return {url, preview, root};
}

/** A dispatch caller bound to the preview URL; throws the server's message. */
export function dispatchCall(url) {
  return async (action, args = {}) => {
    const response = await fetch(new URL('/dispatch', url), {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({action, args})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  };
}

/** Prepare a screenshot directory under test-results/<name>. */
export async function shotDir(name) {
  const shots = join(root, 'test-results', name);
  await mkdir(shots, {recursive: true});
  return shots;
}
