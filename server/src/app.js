import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readdir, rm, stat, open, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOAD_POLICY, validateFileSelection } from '@bear/shared';
import { protectApp, receiveUpload, MAX_REQUEST_BYTES } from './security.js';

const DAY = 86_400_000;
const INCOMPLETE_UPLOAD_DAYS = 1;

const reply = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

const safeName = (name) => {
  // Multipart filename parameters are commonly decoded as Latin-1 by Busboy.
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  const filename = decoded.includes('\uFFFD') ? name : decoded;

  return (
    path
      .basename(filename.replaceAll('\\', '/'))
      .replace(/[\r\n\x00-\x1f\x7f]/g, '')
      .slice(0, 150) || 'file'
  );
};

function configuration(env) {
  const port = Number(env.SMTP_PORT ?? 465);

  return {
    port,
    host: env.SMTP_HOST,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    recipient: env.COMPANY_EMAIL,
    root: path.resolve(
      env.UPLOAD_DIR ?? fileURLToPath(new URL('../storage', import.meta.url))
    ),
    ready: Boolean(
      env.SMTP_HOST &&
        env.SMTP_USER &&
        env.SMTP_PASSWORD &&
        env.COMPANY_EMAIL &&
        Number.isInteger(port) &&
        port > 0 &&
        port <= 65535
    ),
  };
}

function validateFields(body) {
  if (
    !body ||
    Object.keys(body).some(
      (key) => !['name', 'phone', 'email', 'description', 'consent'].includes(key)
    )
  ) {
    return 'Некорректные поля заявки.';
  }

  const { name, phone, email, description, consent } = body;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 100 ||
    /[\r\n\x00-\x1f]/.test(name)
  ) {
    return 'Укажите имя (до 100 символов).';
  }

  if (typeof phone !== 'string' || !/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone)) {
    return 'Укажите телефон в формате +7 (999) 123-45-67.';
  }

  if (
    typeof email !== 'string' ||
    email.length > 254 ||
    !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email)
  ) {
    return 'Укажите корректный email.';
  }

  if (
    typeof description !== 'string' ||
    !description.trim() ||
    description.length > 5000 ||
    /\x00/.test(description)
  ) {
    return 'Опишите проект (до 5000 символов).';
  }

  if (consent !== 'true') {
    return 'Подтвердите согласие на обработку данных.';
  }

  return null;
}

async function validSignature(file) {
  const handle = await open(file.path, 'r');

  try {
    const buffer = Buffer.alloc(128);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.jpg') {
      return head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    }
    if (ext === '.pdf') {
      return head.subarray(0, 5).toString() === '%PDF-';
    }
    if (ext === '.dwg') {
      return /^AC10\d{2}/.test(head.toString('ascii', 0, 6));
    }
    if (ext === '.step') {
      return head
        .toString('utf8')
        .replace(/^\uFEFF/, '')
        .trimStart()
        .startsWith('ISO-10303-21;');
    }
    if (ext === '.dxf') {
      return (
        /^\s*0\s*\r?\n\s*SECTION\b/i.test(head.toString('ascii')) ||
        head.subarray(0, 22).toString('ascii') === 'AutoCAD Binary DXF\r\n\x1a\0'
      );
    }

    return false;
  } finally {
    await handle.close();
  }
}

async function cleanExpired(root) {
  await mkdir(root, { recursive: true, mode: 0o700 });

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/.test(entry.name)) continue;

    const directory = path.join(root, entry.name);

    try {
      if (
        Date.now() - (await stat(directory)).mtimeMs >
        INCOMPLETE_UPLOAD_DAYS * DAY
      ) {
        await rm(directory, { recursive: true, force: true });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Upload cleanup failed:', error.code);
      }
    }
  }
}

export function createApp({ env = process.env, transport } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const requestLimiter = protectApp(app, env);

  const config = configuration(env);
  const mailer =
    transport ??
    (config.ready
      ? nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.port === 465,
          requireTLS: config.port !== 465,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 30_000,
          auth: { user: config.user, pass: config.password },
        })
      : null);

  let activeUploads = 0;

  const upload = multer({
    fileFilter(_req, file, callback) {
      if (!UPLOAD_POLICY.extensions.includes(path.extname(file.originalname).toLowerCase())) {
        return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      }
      callback(null, true);
    },
    storage: multer.diskStorage({
      destination(req, _file, callback) {
        try {
          const directory = path.join(config.root, req.requestId);
          mkdirSync(directory, { recursive: true, mode: 0o700 });
          callback(null, directory);
        } catch (error) {
          callback(error);
        }
      },
      filename(_req, _file, callback) {
        callback(null, randomUUID());
      },
    }),
    limits: {
      files: UPLOAD_POLICY.maxFiles,
      fileSize: Math.min(UPLOAD_POLICY.maxFileBytes, UPLOAD_POLICY.maxTotalBytes),
      fields: 5,
      fieldSize: 16_384,
      parts: 10,
      fieldNameSize: 40,
    },
  }).array('files', UPLOAD_POLICY.maxFiles);

  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', requestsEnabled: config.ready });
  });

  app.get('/api/config', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ requestsEnabled: config.ready, uploads: UPLOAD_POLICY });
  });

  app.post('/api/requests', requestLimiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');

    if (!config.ready) {
      return reply(res, 503, 'REQUESTS_UNAVAILABLE', 'Приём заявок пока не настроен.');
    }

    if (activeUploads >= 2) {
      res.set('Retry-After', '10');
      return reply(res, 503, 'BUSY', 'Сервер занят. Повторите попытку позже.');
    }
    if (!req.is('multipart/form-data')) {
      return reply(res, 415, 'CONTENT_TYPE', 'Ожидается форма с файлами.');
    }
    if (
      Number(req.headers['content-length']) >
      MAX_REQUEST_BYTES
    ) {
      return reply(res, 413, 'TOO_LARGE', 'Размер заявки превышает лимит.');
    }

    activeUploads++;
    req.requestId = randomUUID();

    const directory = path.join(config.root, req.requestId);
    let delivered = false;

    try {
      await receiveUpload(upload, req, res);

      const invalid = validateFields(req.body);
      if (invalid) return reply(res, 400, 'INVALID_FIELDS', invalid);

      const files = req.files ?? [];
      const problems = validateFileSelection(
        files.map((file) => ({ name: file.originalname, size: file.size }))
      );
      if (problems.length) {
        return reply(res, 400, 'INVALID_FILES', problems.join(' '));
      }

      for (const file of files) {
        if (!(await validSignature(file))) {
          return reply(
            res,
            400,
            'INVALID_FILES',
            'Формат файла не соответствует расширению: ' + safeName(file.originalname)
          );
        }
      }

      const attachments = files.map((file) => ({
        filename: safeName(file.originalname),
        path: file.path,
        contentType: 'application/octet-stream',
      }));

      const result = await mailer.sendMail({
        from: config.user,
        to: config.recipient,
        replyTo: req.body.email,
        subject: 'Новая заявка с сайта BEAR',
        textEncoding: 'base64',
        text: `Новая заявка BEAR\n\nИмя: ${req.body.name
          .trim()
          .normalize('NFC')}\nТелефон: ${req.body.phone}\nEmail: ${
          req.body.email
        }\n\nОписание:\n${req.body.description
          .trim()
          .normalize('NFC')}\n\nФайлы во вложении:\n${
          attachments.length
            ? attachments.map((file) => file.filename).join('\n')
            : 'Нет'
        }\n`,
        attachments,
      });

      if (result?.accepted && !result.accepted.includes(config.recipient)) {
        throw new Error('Recipient rejected');
      }

      delivered = true;

      // Nodemailer finishes reading attachment paths before sendMail resolves.
      await rm(directory, { recursive: true, force: true }).catch((error) =>
        console.error('Failed to remove sent attachments:', error.code)
      );

      res.status(201).json({ id: req.requestId, message: 'Заявка отправлена.' });
    } catch (error) {
      if (req.aborted || res.destroyed || res.writableEnded) return;
      if (error instanceof multer.MulterError) {
        reply(
          res,
          400,
          'INVALID_UPLOAD',
          'Не удалось принять файлы: превышен лимит размера или количества.'
        );
      } else {
        console.error(
          'Request processing failed:',
          error.code ?? error.name ?? 'UNKNOWN'
        );
        reply(
          res,
          502,
          'DELIVERY_FAILED',
          'Не удалось отправить заявку. Попробуйте позже.'
        );
      }
    } finally {
      activeUploads--;

      if (!delivered) {
        await rm(directory, { recursive: true, force: true }).catch(() =>
          console.error('Failed to remove unsuccessful upload')
        );
      }
    }
  });

  app.use((_req, res) =>
    reply(res, 404, 'NOT_FOUND', 'Адрес не найден.')
  );

  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);

    console.error('Unhandled request error:', error.code ?? 'UNKNOWN');
    reply(res, 500, 'INTERNAL_ERROR', 'Ошибка сервера.');
  });

  if (config.ready) {
    cleanExpired(config.root).catch((error) =>
      console.error('Upload cleanup failed:', error.code)
    );

    setInterval(
      () =>
        cleanExpired(config.root).catch((error) =>
          console.error('Upload cleanup failed:', error.code)
        ),
      DAY
    ).unref();
  }

  return app;
}
