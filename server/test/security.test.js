import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import { configureHttpServer, UPLOAD_TIMEOUT_MS } from '../src/security.js';

async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'bear-security-'));
  const messages = [];
  const env = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'test-only',
    COMPANY_EMAIL: 'recipient@example.com',
    UPLOAD_DIR: directory,
    ...overrides,
  };
  const server = createApp({
    env,
    transport: {
      async sendMail(mail) {
        messages.push(mail);
        return { accepted: [mail.to] };
      },
    },
  }).listen(0, '127.0.0.1');
  configureHttpServer(server);
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { url: 'http://127.0.0.1:' + server.address().port, directory, messages };
}

function validForm() {
  const data = new FormData();
  data.set('name', 'Иван');
  data.set('phone', '+7 (999) 123-45-67');
  data.set('email', 'ivan@example.com');
  data.set('description', 'Корпус катера');
  data.set('consent', 'true');
  return data;
}

async function attempt(url, ip) {
  const response = await fetch(url + '/api/requests', {
    method: 'POST',
    headers: ip ? { 'X-Forwarded-For': ip } : {},
  });
  await response.arrayBuffer();
  return response;
}

async function waitFor(condition) {
  const deadline = performance.now() + 3000;
  while (!(await condition())) {
    assert.ok(performance.now() < deadline, 'Timed out waiting for upload cleanup');
    await nextTurn();
  }
}

function partialUpload(url) {
  const req = request(url + '/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=bear-test' },
  });
  req.on('error', () => {});
  req.write('--bear-test\r\nContent-Disposition: form-data; name="files"; filename="plan.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\n');
  req.write(Buffer.alloc(16_384));
  return req;
}

test('security headers cover successful and unknown API responses', async (t) => {
  const { url } = await fixture(t);
  for (const route of ['/api/health', '/api/unknown']) {
    const response = await fetch(url + route);
    await response.arrayBuffer();
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(response.headers.get('content-security-policy'), /object-src 'none'/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('strict-transport-security'), null);
  }
});

test('untrusted forwarded headers cannot evade the five-attempt quota', async (t) => {
  const { url } = await fixture(t);
  for (let i = 0; i < 5; i++) {
    assert.equal((await attempt(url, '198.51.100.' + (i + 1))).status, 415);
  }
  const blocked = await attempt(url, '203.0.113.1');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});

test('trusted proxy separates visitors, ignores a spoofed leftmost IP, and groups IPv6 /64', async (t) => {
  const { url } = await fixture(t, { TRUST_PROXY: 'loopback' });
  for (let i = 0; i < 5; i++) {
    assert.equal((await attempt(url, '198.51.100.10')).status, 415);
  }
  assert.equal((await attempt(url, '203.0.113.99, 198.51.100.10')).status, 429);
  assert.equal((await attempt(url, '198.51.100.11')).status, 415);
  for (let i = 0; i < 5; i++) {
    assert.equal((await attempt(url, '2001:db8:1:1::' + (i + 1))).status, 415);
  }
  assert.equal((await attempt(url, '2001:db8:1:1::99')).status, 429);
  assert.equal((await attempt(url, '2001:db8:1:2::1')).status, 415);
});

test('the form quota expires after an hour', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const { url } = await fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await attempt(url)).status, 415);
  assert.equal((await attempt(url)).status, 429);
  t.mock.timers.tick(3_600_001);
  assert.equal((await attempt(url)).status, 415);
});

test('the shared API quota also protects unknown paths', async (t) => {
  const { url } = await fixture(t);
  for (let i = 0; i < 120; i++) {
    const response = await fetch(url + '/api/unknown-' + i);
    await response.arrayBuffer();
    assert.equal(response.status, 404);
  }
  const blocked = await fetch(url + '/api/health');
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error.code, 'RATE_LIMIT');
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});

test('an executable upload is rejected without delivering mail or keeping files', async (t) => {
  const { url, directory, messages } = await fixture(t);
  const body = validForm();
  body.append('files', new Blob(['MZ']), 'drawing.pdf.exe');
  const response = await fetch(url + '/api/requests', { method: 'POST', body });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_UPLOAD');
  await waitFor(async () => (await readdir(directory)).length === 0);
  assert.equal(messages.length, 0);
});

test('an oversized chunked body is terminated, cleaned up, and releases its upload slot', async (t) => {
  const { url, directory, messages } = await fixture(t);
  const body = validForm();
  for (let i = 0; i < 2; i++) {
    body.append('files', new Blob(['%PDF-1.7\n', new Uint8Array(10_000_000)]), i + '.pdf');
  }
  const encoded = new Request(url + '/api/requests', { method: 'POST', body });
  assert.equal(encoded.headers.get('content-length'), null);
  await assert.rejects(fetch(encoded.url, {
    method: 'POST',
    headers: encoded.headers,
    body: encoded.body,
    duplex: 'half',
  }), TypeError);
  await waitFor(async () => (await readdir(directory)).length === 0);
  assert.equal(messages.length, 0);
  const next = await fetch(encoded.url, { method: 'POST', body: validForm() });
  assert.equal(next.status, 201);
  assert.equal(messages.length, 1);
});

test('aborted uploads release both slots and delete their partial files', async (t) => {
  const { url, directory, messages } = await fixture(t);
  const uploads = [partialUpload(url), partialUpload(url)];
  t.after(() => uploads.forEach((req) => req.destroy()));
  await waitFor(async () => (await readdir(directory)).length === 2);
  const busy = await fetch(url + '/api/requests', { method: 'POST', body: validForm() });
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get('retry-after'), '10');
  await busy.arrayBuffer();
  const closed = uploads.map((req) => new Promise((resolve) => req.once('close', resolve)));
  uploads.forEach((req) => req.destroy());
  await Promise.all(closed);
  await waitFor(async () => (await readdir(directory)).length === 0);
  const response = await fetch(url + '/api/requests', { method: 'POST', body: validForm() });
  assert.equal(response.status, 201);
  assert.equal(messages.length, 1);
});

test('an upload exceeding its deadline is terminated and cleaned up', async (t) => {
  const { url, directory } = await fixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const req = partialUpload(url);
  t.after(() => req.destroy());
  await waitFor(async () => (await readdir(directory)).length === 1);
  const closed = new Promise((resolve) => req.once('close', resolve));
  t.mock.timers.tick(UPLOAD_TIMEOUT_MS + 1);
  await closed;
  await waitFor(async () => (await readdir(directory)).length === 0);
  t.mock.timers.reset();
  const response = await fetch(url + '/api/requests', { method: 'POST', body: validForm() });
  assert.equal(response.status, 201);
});
