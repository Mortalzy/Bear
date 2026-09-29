import express from 'express';
import { UPLOAD_POLICY } from '@bear/shared';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', requestsEnabled: false });
  });

  app.get('/api/config', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ requestsEnabled: false, uploads: UPLOAD_POLICY });
  });

  // Explicitly reject until storage, validation and mail delivery are wired.
  // No body parser / upload middleware: this scaffold does not save requests.
  app.post('/api/requests', (_req, res) => {
    res.status(503).json({
      error: { code: 'REQUESTS_UNAVAILABLE', message: 'Приём заявок пока не подключён.' },
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Адрес не найден.' } });
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    // Avoid logging user payloads, tokens or transport credentials.
    console.error('Unhandled request error');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ошибка сервера.' } });
  });
  return app;
}
