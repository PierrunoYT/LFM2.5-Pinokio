import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const launcher = require('../pinokio.js');

test('launcher offers install, active scripts, and the captured Web UI', async () => {
  const menu = (active, installed = true, local = {}) => launcher.menu({}, {
    running: script => script === active, exists: () => installed, local: () => local,
  });
  assert.equal((await menu(null, false))[0].href, 'install.js');
  for (const script of ['install.js', 'start.js', 'update.js', 'reset.js']) {
    assert.equal((await menu(script, false))[0].href, script);
  }
  assert.equal((await menu('start.js', true, { url: 'http://127.0.0.1:8123' }))[0].href, 'http://127.0.0.1:8123');
  assert.equal((await menu(null))[0].href, 'start.js');
});

test('reset removes only installed dependencies and update refuses merges', () => {
  assert.deepEqual(require('../reset.js').run[0], { method: 'fs.rm', params: { path: 'app/node_modules' } });
  assert.equal(require('../update.js').run[0].params.message, 'git pull --ff-only');
  const start = require('../start.js');
  assert.equal(start.daemon, true);
  assert.equal(start.run.find(step => step.method === 'local.set').params.url, '{{input.event[1]}}');
});
