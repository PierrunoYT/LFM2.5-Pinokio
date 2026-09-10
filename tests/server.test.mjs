import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

test('server binds loopback, emits a capturable URL, serves modules and returns real 404s', { timeout: 15000 }, async () => {
  const command = require('../start.js').run.find(step => step.method === 'shell.run').params;
  assert.match(command.message, /--listen tcp:\/\/127\.0\.0\.1:\{\{port\}\}/);
  const server = spawn(process.execPath, ['node_modules/serve/build/main.js', '.', '--no-clipboard', '--listen', 'tcp://127.0.0.1:0'], {
    cwd: fileURLToPath(new URL('../app', import.meta.url)), env: { ...process.env, NO_UPDATE_CHECK: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  server.stderr.on('data', data => { stderr += data; });
  try {
    const url = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(Error('Server did not become ready: ' + stderr)), 10000);
      const pattern = new RegExp(command.on[0].event.slice(1, -1));
      server.stdout.on('data', data => {
        output += data;
        const match = output.match(pattern);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
      server.on('error', error => { clearTimeout(timer); reject(error); });
      server.on('exit', code => { clearTimeout(timer); reject(Error(`Server exited: ${code} ${stderr}`)); });
    });
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.match(await (await fetch(url)).text(), /LFM2.5 Reader/);
    for (const path of ['app.js', 'worker.js', 'text.mjs']) {
      const response = await fetch(`${url}/${path}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /javascript/);
    }
    assert.equal((await fetch(`${url}/missing.js`)).status, 404);
  } finally {
    server.kill();
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
  }
});
