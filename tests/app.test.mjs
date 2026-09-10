import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { cleanText, splitSections } from '../app/text.mjs';

function setup({ gpu = true, throwWorker = false } = {}) {
  const elements = new Map();
  const element = () => ({
    value: '', textContent: '', innerHTML: '', disabled: false, style: {},
    listeners: {}, children: [],
    classList: { values: new Set(), add(v) { this.values.add(v); }, remove(v) { this.values.delete(v); } },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    querySelectorAll() { return []; }, appendChild(child) { this.children.push(child); }, focus() {},
  });
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  get('model-select').value = 'model-a';
  const workers = [];
  class Worker {
    constructor() { if (throwWorker) throw Error('Cannot create worker'); this.listeners = {}; this.sent = []; workers.push(this); }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    postMessage(data) { this.sent.push(data); }
    terminate() { this.terminated = true; }
    emit(data) { this.listeners.message({ data }); }
  }
  const context = vm.createContext({ document: { getElementById: get, createElement: element },
    navigator: { gpu: gpu ? {} : undefined }, Worker, performance, cleanText, splitSections });
  vm.runInContext(readFileSync(new URL('../app/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, ''), context);
  return { get, workers, run: code => vm.runInContext(code, context) };
}

test('unsupported WebGPU and worker construction failure leave cleanup usable', () => {
  for (const options of [{ gpu: false }, { throwWorker: true }]) {
    const app = setup(options);
    assert.equal(app.get('meta-model').textContent, 'Failed');
    assert.ok(app.get('loading-overlay').classList.values.has('hidden'));
    assert.equal(app.get('retry-model').disabled, false);
    app.get('source-input').value = 'A useful article.';
    app.run('convertSource()');
    assert.equal(app.get('meta-status').textContent, 'Converted');
  }
});

test('model failure permits retry and ignores events from terminated workers', () => {
  const app = setup();
  const first = app.workers[0];
  assert.equal(app.get('model-select').disabled, true);
  first.emit({ type: 'error', message: 'Download failed' });
  assert.ok(first.terminated);
  app.get('retry-model').listeners.click();
  first.emit({ type: 'ready' });
  assert.equal(app.get('meta-model').textContent, 'Loading');
  app.workers[1].emit({ type: 'ready' });
  assert.equal(app.get('meta-model').textContent, 'Ready');
  app.get('model-select').listeners.change();
  assert.ok(app.workers[1].terminated);
});

test('generation disables switching; stale errors do not mark model failed', () => {
  const app = setup();
  const worker = app.workers[0];
  worker.emit({ type: 'ready' });
  app.get('source-input').value = 'The article contains useful facts.';
  app.run('convertSource()');
  app.get('chat-input').value = 'What facts?';
  app.run('askQuestion()');
  const request = worker.sent.at(-1);
  assert.equal(app.get('model-select').disabled, true);
  worker.emit({ type: 'done', generationId: request.generationId, output: 'Facts.' });
  assert.equal(app.get('model-select').disabled, false);
  worker.emit({ type: 'error', generationId: request.generationId - 1, message: 'Stale' });
  assert.equal(app.get('meta-model').textContent, 'Ready');
  app.get('source-input').value = '';
  app.run('updateControls()');
  assert.equal(app.get('clear-btn').disabled, false);
  app.run('convertSource()');
  assert.equal(app.get('chat-text').textContent, '');
  assert.ok(!app.get('chat-response').classList.values.has('visible'));
});

test('worker crash during generation restores controls and reports failure', () => {
  const app = setup();
  const worker = app.workers[0];
  worker.emit({ type: 'ready' });
  app.get('source-input').value = 'Article text.';
  app.run('convertSource()');
  app.get('chat-input').value = 'Question?';
  app.run('askQuestion()');
  worker.listeners.error({ preventDefault() {}, message: 'GPU lost' });
  assert.equal(app.get('chat-text').textContent, 'Error: GPU lost');
  assert.equal(app.get('meta-model').textContent, 'Failed');
  assert.equal(app.get('convert-btn').disabled, false);
});
