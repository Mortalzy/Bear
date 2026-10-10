import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, stat, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { privacyConfiguration } from '../src/privacy.js';
import { cleanConsents, removeConsent } from '../src/consent-store.js';

const settings = {
  SMTP_HOST: 'smtp.mail.ru', SMTP_USER: 'sender@mail.ru',
  SMTP_PASSWORD: 'test-only', COMPANY_EMAIL: 'bear.fiberglass@mail.ru',
  PUBLIC_SITE_URL: 'https://bear.example', OPERATOR_OGRNIP: '123456789012345',
  OPERATOR_ADDRESS: 'Тестовый адрес', HOSTING_PROCESSOR: 'Хостинг, адрес',
  MAIL_PROCESSOR: 'Почта, адрес', PRIVACY_DOCUMENTS_APPROVED: 'true',
  RKN_NOTIFICATION_CONFIRMED: 'true', RU_DATA_LOCATION_CONFIRMED: 'true',
};

async function fixture(t, overrides = {}, transport) {
  const directory = await mkdtemp(path.join(tmpdir(), 'bear-privacy-'));
  const env = { ...settings, UPLOAD_DIR: path.join(directory, 'uploads'),
    CONSENT_DIR: path.join(directory, 'consents'), ...overrides };
  const messages = [];
  const server = createApp({ env, transport: transport ?? {
    sendMail: async (mail) => { messages.push(mail); return { accepted: [mail.to] }; },
  } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { env, messages, url: 'http://127.0.0.1:' + server.address().port };
}

function form(env, overrides = {}) {
  const data = new FormData();
  const fields = { name: 'Иван', phone: '+7 (999) 123-45-67', email: 'ivan@example.com',
    description: 'Корпус', consent: 'true', consentRevision: privacyConfiguration(env).revision,
    ...overrides };
  for (const [key, value] of Object.entries(fields)) if (value !== null) data.set(key, value);
  return data;
}

test('SMTP alone, incomplete details, missing confirmations and foreign mail cannot enable intake', async (t) => {
  for (const overrides of [
    { OPERATOR_ADDRESS: '' }, { OPERATOR_OGRNIP: '' }, { PUBLIC_SITE_URL: 'http://bear.example' },
    { HOSTING_PROCESSOR: '' }, { MAIL_PROCESSOR: '' }, { PRIVACY_DOCUMENTS_APPROVED: 'false' },
    { RKN_NOTIFICATION_CONFIRMED: 'false' }, { RU_DATA_LOCATION_CONFIRMED: 'false' },
    { SMTP_HOST: 'smtp.gmail.com' }, { COMPANY_EMAIL: 'owner@gmail.com' },
  ]) {
    const { env, url, messages } = await fixture(t, overrides);
    assert.equal((await fetch(url + '/api/config').then((r) => r.json())).requestsEnabled, false);
    const response = await fetch(url + '/api/requests', { method: 'POST', body: form(env) });
    assert.equal(response.status, 503);
    assert.equal(messages.length, 0);
  }
});

test('standalone legal pages work without JavaScript and escape owner-provided details', async (t) => {
  const { url } = await fixture(t, { OPERATOR_ADDRESS: '<script>unsafe</script>',
    PRIVACY_DOCUMENTS_APPROVED: 'false' });
  for (const endpoint of ['/privacy', '/consent']) {
    const response = await fetch(url + endpoint);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const html = await response.text();
    assert.match(html, /Проект документа/);
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.ok(!html.includes('<script>unsafe'));
    assert.match(html, /Пиронен Герман Сергеевич/);
  }
});

test('missing confirmation is rejected before any upload; stale or unchecked body is rejected', async (t) => {
  const { env, url, messages } = await fixture(t);
  const data = form(env);
  data.append('files', new Blob(['%PDF-1.7\n']), 'plan.pdf');
  const response = await fetch(url + '/api/requests', { method: 'POST', body: data });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'CONSENT_REQUIRED');
  assert.deepEqual(await readdir(env.UPLOAD_DIR), []);
  for (const overrides of [{ consent: 'false' }, { consent: null }, { consentRevision: 'old' }]) {
    assert.equal((await fetch(url + '/api/requests', {
      method: 'POST', headers: { 'X-Bear-Consent': privacyConfiguration(env).revision },
      body: form(env, overrides),
    })).status, 400);
  }
  assert.equal(messages.length, 0);
});

test('successful intake records exact documents privately, binds email and cleans expired receipts', async (t) => {
  const { env, url, messages } = await fixture(t);
  const configuration = privacyConfiguration(env);
  const response = await fetch(url + '/api/requests', {
    method: 'POST', headers: { 'X-Bear-Consent': configuration.revision }, body: form(env),
  });
  assert.equal(response.status, 201);
  const { id } = await response.json();
  const file = path.join(env.CONSENT_DIR, id + '.json');
  const receipt = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(receipt.subjectEmail, 'ivan@example.com');
  assert.equal(receipt.consentText, configuration.consentText);
  assert.equal(receipt.policyText, configuration.policyText);
  assert.equal(receipt.revision, configuration.revision);
  assert.match(receipt.requestHash, /^[0-9a-f]{64}$/);
  assert.equal('ip' in receipt, false);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.match(messages[0].text, new RegExp(id));
  assert.equal((await fetch(url + '/consents/' + id + '.json')).status, 404);
  assert.notEqual(privacyConfiguration({ ...env, OPERATOR_ADDRESS: 'Другой адрес' }).revision, receipt.revision);
  await cleanConsents(env.CONSENT_DIR, Date.parse(receipt.expiresAt) - 1);
  assert.equal((await readdir(env.CONSENT_DIR)).length, 1);
  await cleanConsents(env.CONSENT_DIR, Date.parse(receipt.expiresAt));
  assert.deepEqual(await readdir(env.CONSENT_DIR), []);
  await assert.rejects(removeConsent(env.CONSENT_DIR, '../outside'));
});

test('journal write failure prevents mail delivery', async (t) => {
  const { env, url, messages } = await fixture(t);
  await readdir(env.CONSENT_DIR);
  await rm(env.CONSENT_DIR, { recursive: true, force: true });
  await writeFile(env.CONSENT_DIR, 'blocked');
  const response = await fetch(url + '/api/requests', {
    method: 'POST', headers: { 'X-Bear-Consent': privacyConfiguration(env).revision }, body: form(env),
  });
  assert.equal(response.status, 502);
  assert.equal(messages.length, 0);
});

test('production requires HTTPS behind a local proxy and the configured Origin', async (t) => {
  const { env, url } = await fixture(t, { NODE_ENV: 'production' });
  const headers = { 'X-Bear-Consent': privacyConfiguration(env).revision,
    Origin: 'https://foreign.example', 'X-Forwarded-Proto': 'https' };
  assert.equal((await fetch(url + '/api/requests', { method: 'POST', headers, body: form(env) })).status, 403);
  headers.Origin = env.PUBLIC_SITE_URL;
  delete headers['X-Forwarded-Proto'];
  assert.equal((await fetch(url + '/api/requests', { method: 'POST', headers, body: form(env) })).status, 403);
  headers['X-Forwarded-Proto'] = 'https';
  assert.equal((await fetch(url + '/api/requests', { method: 'POST', headers, body: form(env) })).status, 201);
});
