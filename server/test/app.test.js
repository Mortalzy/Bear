import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

test('mails small attachments and private links for large files; rejects invalid uploads', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bear-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const messages = [];
  const env = { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'test-only', COMPANY_EMAIL: 'bear.fiberglass@mail.ru',
    PUBLIC_BASE_URL: 'http://localhost:5173', UPLOAD_DIR: directory };
  const server = createApp({ env, transport: { sendMail: async (mail) => { messages.push({ ...mail, attachmentContent: await readFile(mail.attachments[0].path, 'utf8') }); return { accepted: [mail.to] }; } } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  const form = (content = '%PDF-1.7\n', includeLarge = false) => {
    const data = new FormData();
    data.set('name', 'Иван'); data.set('phone', '+7 (999) 123-45-67');
    data.set('email', 'ivan@example.com'); data.set('description', 'Нужен корпус катера'); data.set('consent', 'true');
    data.append('files', new Blob([content]), 'drawing.pdf');
    if (includeLarge) data.append('files', new Blob(['%PDF-1.7\n', new Uint8Array(16_000_000)]), 'large.pdf');
    return data;
  };
  const response = await fetch(url + '/api/requests', { method: 'POST', body: form('%PDF-1.7\n', true) });
  assert.equal(response.status, 201);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, env.COMPANY_EMAIL);
  assert.equal(messages[0].replyTo, 'ivan@example.com');
  assert.equal(messages[0].attachments.length, 1);
  assert.equal(messages[0].attachments[0].filename, 'drawing.pdf');
  assert.equal(messages[0].attachmentContent, '%PDF-1.7\n');
  const link = messages[0].text.match(/http:\/\/localhost:5173\/api\/files\/[^\s]+/)[0];
  const file = await fetch(url + new URL(link).pathname);
  assert.equal(file.status, 200);
  assert.equal(Number(file.headers.get('content-length')), 16_000_009);
  assert.ok((await file.arrayBuffer()).byteLength > 16_000_000);
  assert.match(file.headers.get('content-disposition'), /attachment/);
  const invalidLink = await fetch(url + new URL(link).pathname.replace(/.$/, (last) => last === '0' ? '1' : '0'));
  assert.equal(invalidLink.status, 404);
  const rejected = await fetch(url + '/api/requests', { method: 'POST', body: form('not a pdf') });
  assert.equal(rejected.status, 400);
  assert.equal(messages.length, 1);
  for (let attempt = 0; attempt < 20 && (await readdir(directory)).length !== 1; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal((await readdir(directory)).length, 1);
});

test('reports mail failure and removes uploaded files', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bear-failed-mail-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = { SMTP_HOST: 'smtp.example.com', SMTP_USER: 'sender@example.com', SMTP_PASSWORD: 'test',
    COMPANY_EMAIL: 'bear.fiberglass@mail.ru', PUBLIC_BASE_URL: 'http://localhost:5173', UPLOAD_DIR: directory };
  const server = createApp({ env, transport: { sendMail: async () => { throw Object.assign(new Error('failure'), { code: 'MAIL_TEST' }); } } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const data = new FormData();
  data.set('name', 'Иван'); data.set('phone', '+7 (999) 123-45-67');
  data.set('email', 'ivan@example.com'); data.set('description', 'Проект'); data.set('consent', 'true');
  data.append('files', new Blob(['%PDF-1.7\n']), 'plan.pdf');
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/requests', { method: 'POST', body: data });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'DELIVERY_FAILED');
    for (let attempt = 0; attempt < 20 && (await readdir(directory)).length; attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(await readdir(directory), []);
  } finally { console.error = originalError; }
});
