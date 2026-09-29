import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

test('API is reachable but never reports a submitted request before mail is connected', async (t) => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  const url = 'http://127.0.0.1:' + server.address().port;
  const health = await fetch(url + '/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', requestsEnabled: false });

  const config = await fetch(url + '/api/config').then((r) => r.json());
  assert.equal(config.requestsEnabled, false);
  assert.equal(config.uploads.maxFileBytes, 50_000_000);
  assert.equal(config.uploads.maxFiles, 5);

  const response = await fetch(url + '/api/requests', { method: 'POST' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'REQUESTS_UNAVAILABLE');

  const unknown = await fetch(url + '/api/unknown');
  assert.equal(unknown.status, 404);
});
