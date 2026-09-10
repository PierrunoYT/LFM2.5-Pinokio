import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('worker serializes GPU work, releases old models, and recovers after errors', async () => {
  const sent = [];
  let handler, release, disposed = 0;
  const generator = async () => {
    await new Promise(resolve => { release = resolve; });
    return [{ generated_text: [{ role: 'assistant', content: 'Answer' }] }];
  };
  generator.dispose = async () => { disposed++; };
  const context = vm.createContext({
    self: { addEventListener: (_, fn) => { handler = fn; }, postMessage: msg => sent.push(msg) },
    pipeline: async () => generator, TextStreamer: class {},
  });
  vm.runInContext(readFileSync(new URL('../app/worker.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, ''), context);
  const send = data => handler({ data });
  await send({ type: 'generate', generationId: 1 });
  assert.equal(sent.at(-1).generationId, 1);
  await send({ type: 'load' });
  const pending = send({ type: 'generate', generationId: 2 });
  await send({ type: 'generate', generationId: 3 });
  assert.equal(sent.at(-1).message, 'Model is busy');
  release();
  await pending;
  assert.equal(sent.at(-1).output, 'Answer');
  await send({ type: 'load' });
  assert.equal(disposed, 1);
});
