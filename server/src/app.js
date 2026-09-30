import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { readFile, readdir, rm, stat, writeFile, open, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOAD_POLICY, validateFileSelection } from '@bear/shared';

const DAY = 86_400_000;
const RETENTION_DAYS = 30;
// Mail.ru stores ordinary attachments up to 25 MB; reserve room for MIME/base64 overhead.
const MAX_EMAIL_ATTACHMENT_BYTES = 15_000_000;
const reply = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const safeName = (name) => path.basename(name.replaceAll('\\', '/')).replace(/[\r\n\x00-\x1f\x7f]/g, '').slice(0, 150) || 'file';

function configuration(env) {
  const base = env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
  let validBase = false;
  try {
    const url = new URL(base);
    validBase = !url.username && !url.password && !url.search && !url.hash &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)));
  } catch { /* Disabled until configured. */ }
  const port = Number(env.SMTP_PORT ?? 465);
  return { base, port, host: env.SMTP_HOST, user: env.SMTP_USER, password: env.SMTP_PASSWORD,
    recipient: env.COMPANY_EMAIL, root: path.resolve(env.UPLOAD_DIR ?? fileURLToPath(new URL('../storage', import.meta.url))),
    ready: Boolean(validBase && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.COMPANY_EMAIL &&
      Number.isInteger(port) && port > 0 && port <= 65535) };
}

function validateFields(body) {
  if (!body || Object.keys(body).some((key) => !['name', 'phone', 'email', 'description', 'consent'].includes(key))) return 'Некорректные поля заявки.';
  const { name, phone, email, description, consent } = body;
  if (typeof name !== 'string' || !name.trim() || name.length > 100 || /[\r\n\x00-\x1f]/.test(name)) return 'Укажите имя (до 100 символов).';
  if (typeof phone !== 'string' || !/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone)) return 'Укажите телефон в формате +7 (999) 123-45-67.';
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email)) return 'Укажите корректный email.';
  if (typeof description !== 'string' || !description.trim() || description.length > 5000 || /\x00/.test(description)) return 'Опишите проект (до 5000 символов).';
  if (consent !== 'true') return 'Подтвердите согласие на обработку данных.';
  return null;
}

async function validSignature(file) {
  const handle = await open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(128);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.jpg') return head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    if (ext === '.pdf') return head.subarray(0, 5).toString() === '%PDF-';
    if (ext === '.dwg') return /^AC10\d{2}/.test(head.toString('ascii', 0, 6));
    if (ext === '.step') return head.toString('utf8').replace(/^\uFEFF/, '').trimStart().startsWith('ISO-10303-21;');
    if (ext === '.dxf') return /^\s*0\s*\r?\n\s*SECTION\b/i.test(head.toString('ascii')) || head.subarray(0, 22).toString('ascii') === 'AutoCAD Binary DXF\r\n\x1a\0';
    return false;
  } finally { await handle.close(); }
}

async function cleanExpired(root) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/.test(entry.name)) continue;
    const directory = path.join(root, entry.name);
    try {
      if (Date.now() - (await stat(directory)).mtimeMs > RETENTION_DAYS * DAY) await rm(directory, { recursive: true, force: true });
    } catch (error) { if (error.code !== 'ENOENT') console.error('Upload cleanup failed:', error.code); }
  }
}

export function createApp({ env = process.env, transport, now = () => Date.now() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const config = configuration(env);
  const mailer = transport ?? (config.ready ? nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: config.port !== 465, auth: { user: config.user, pass: config.password },
  }) : null);
  let activeUploads = 0;
  const attempts = new Map();
  const upload = multer({ storage: multer.diskStorage({
    destination(req, _file, callback) {
      try { const directory = path.join(config.root, req.requestId);
        mkdirSync(directory, { recursive: true, mode: 0o700 }); callback(null, directory);
      } catch (error) { callback(error); }
    },
    filename(_req, _file, callback) { callback(null, randomUUID()); },
  }), limits: { files: UPLOAD_POLICY.maxFiles, fileSize: UPLOAD_POLICY.maxFileBytes,
    fields: 5, fieldSize: 16_384, parts: 10, fieldNameSize: 40 } }).array('files', UPLOAD_POLICY.maxFiles);

  app.get('/api/health', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ status: 'ok', requestsEnabled: config.ready }); });
  app.get('/api/config', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ requestsEnabled: config.ready, uploads: UPLOAD_POLICY }); });

  app.post('/api/requests', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!config.ready) return reply(res, 503, 'REQUESTS_UNAVAILABLE', 'Приём заявок пока не настроен.');
    const recent = (attempts.get(req.ip) ?? []).filter((time) => now() - time < 3_600_000);
    if (recent.length >= 5) return reply(res, 429, 'RATE_LIMIT', 'Слишком много заявок. Попробуйте позже.');
    recent.push(now()); attempts.set(req.ip, recent);
    if (attempts.size > 10_000) attempts.clear();
    if (activeUploads >= 2) return reply(res, 503, 'BUSY', 'Сервер занят. Повторите попытку позже.');
    if (!req.is('multipart/form-data')) return reply(res, 415, 'CONTENT_TYPE', 'Ожидается форма с файлами.');
    if (Number(req.headers['content-length']) > UPLOAD_POLICY.maxTotalBytes + 1_000_000) return reply(res, 413, 'TOO_LARGE', 'Размер заявки превышает лимит.');
    activeUploads++;
    req.requestId = randomUUID();
    const directory = path.join(config.root, req.requestId);
    let delivered = false;
    try {
      await new Promise((resolve, reject) => upload(req, res, (error) => error ? reject(error) : resolve()));
      const invalid = validateFields(req.body);
      if (invalid) return reply(res, 400, 'INVALID_FIELDS', invalid);
      const files = req.files ?? [];
      const problems = validateFileSelection(files.map((file) => ({ name: file.originalname, size: file.size })));
      if (problems.length) return reply(res, 400, 'INVALID_FILES', problems.join(' '));
      for (const file of files) if (!await validSignature(file)) return reply(res, 400, 'INVALID_FILES', 'Формат файла не соответствует расширению: ' + safeName(file.originalname));
      const attachments = [];
      const entries = [];
      let attachmentBytes = 0;
      for (const file of files) {
        if (attachmentBytes + file.size <= MAX_EMAIL_ATTACHMENT_BYTES) {
          attachments.push({ filename: safeName(file.originalname), path: file.path, contentType: 'application/octet-stream' });
          attachmentBytes += file.size;
        } else {
          const token = randomBytes(32).toString('hex');
          entries.push({ id: file.filename, name: safeName(file.originalname), size: file.size,
            tokenHash: createHash('sha256').update(token).digest('hex'), token });
        }
      }
      if (entries.length) await writeFile(path.join(directory, 'metadata.json'), JSON.stringify({ expiresAt: now() + RETENTION_DAYS * DAY,
        files: entries.map(({ token, ...file }) => file) }), { mode: 0o600, flag: 'wx' });
      const links = entries.map((file) => `${file.name} (${(file.size / 1_000_000).toFixed(2)} МБ): ${config.base}/api/files/${req.requestId}/${file.id}/${file.token}`);
      await mailer.sendMail({ from: config.user, to: config.recipient, replyTo: req.body.email,
        subject: 'Новая заявка с сайта BEAR',
        text: `Новая заявка BEAR\n\nИмя: ${req.body.name.trim()}\nТелефон: ${req.body.phone}\nEmail: ${req.body.email}\n\nОписание:\n${req.body.description.trim()}\n\nВложения:\n${attachments.length ? attachments.map((file) => file.filename).join('\n') : 'Нет'}\n\nКрупные файлы (ссылки действуют ${RETENTION_DAYS} дней):\n${links.length ? links.join('\n') : 'Нет'}\n`,
        attachments });
      delivered = true;
      // Nodemailer consumes attachment paths during sendMail; remove copies once SMTP accepts.
      if (entries.length) {
        await Promise.all(attachments.map((file) => rm(file.path, { force: true })))
          .catch((error) => console.error('Failed to remove sent attachment:', error.code));
      } else {
        await rm(directory, { recursive: true, force: true })
          .catch((error) => console.error('Failed to remove sent attachments:', error.code));
      }
      res.status(201).json({ id: req.requestId, message: 'Заявка отправлена.' });
    } catch (error) {
      if (error instanceof multer.MulterError) reply(res, 400, 'INVALID_UPLOAD', 'Не удалось принять файлы: превышен лимит размера или количества.');
      else { console.error('Request processing failed:', error.code ?? error.name ?? 'UNKNOWN');
        reply(res, 502, 'DELIVERY_FAILED', 'Не удалось отправить заявку. Попробуйте позже.'); }
    } finally {
      activeUploads--;
      if (!delivered) await rm(directory, { recursive: true, force: true }).catch(() => console.error('Failed to remove unsuccessful upload'));
    }
  });

  app.get('/api/files/:requestId/:fileId/:token', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { requestId, fileId, token } = req.params;
    if (![requestId, fileId].every((id) => /^[0-9a-f-]{36}$/.test(id)) || !/^[0-9a-f]{64}$/.test(token)) return reply(res, 404, 'NOT_FOUND', 'Файл не найден.');
    try {
      const directory = path.join(config.root, requestId);
      const metadata = JSON.parse(await readFile(path.join(directory, 'metadata.json'), 'utf8'));
      const file = metadata.files.find((item) => item.id === fileId && item.tokenHash === createHash('sha256').update(token).digest('hex'));
      if (!file || metadata.expiresAt < now()) return reply(res, 404, 'NOT_FOUND', 'Срок действия ссылки истёк или файл не найден.');
      const filePath = path.join(directory, fileId); await stat(filePath);
      res.set('Content-Type', 'application/octet-stream'); res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Disposition', `attachment; filename="file${path.extname(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
      res.set('Content-Length', String(file.size));
      createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
    } catch { if (!res.headersSent) reply(res, 404, 'NOT_FOUND', 'Файл не найден.'); }
  });
  app.use((_req, res) => reply(res, 404, 'NOT_FOUND', 'Адрес не найден.'));
  app.use((error, _req, res, next) => { if (res.headersSent) return next(error);
    console.error('Unhandled request error:', error.code ?? 'UNKNOWN'); reply(res, 500, 'INTERNAL_ERROR', 'Ошибка сервера.'); });
  if (config.ready) {
    cleanExpired(config.root).catch((error) => console.error('Upload cleanup failed:', error.code));
    setInterval(() => cleanExpired(config.root).catch((error) => console.error('Upload cleanup failed:', error.code)), DAY).unref();
  }
  return app;
}
