import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { UPLOAD_POLICY } from '@bear/shared';

export const MAX_REQUEST_BYTES = UPLOAD_POLICY.maxTotalBytes + 1_000_000;
export const UPLOAD_TIMEOUT_MS = 120_000;

export function protectApp(app, env) {
  const trustProxy = env.TRUST_PROXY ?? 'false';
  if (!['false', 'loopback'].includes(trustProxy)) {
    throw new Error('TRUST_PROXY must be false or loopback.');
  }
  app.set('trust proxy', trustProxy === 'loopback' ? 'loopback' : false);
  app.use(helmet({ strictTransportSecurity: false }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // A global quota bounds work and the number of IP entries reaching the form.
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: 120,
    keyGenerator: () => 'api',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMIT', message: 'Слишком много запросов. Попробуйте позже.' },
    },
  }));

  return rateLimit({
    windowMs: 3_600_000,
    limit: 5,
    // /64 prevents rotating addresses within one IPv6 network to evade the quota.
    keyGenerator: (req) => ipKeyGenerator(req.ip, 64),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMIT', message: 'Слишком много заявок. Попробуйте позже.' },
    },
  });
}

export function receiveUpload(upload, req, res) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const stop = (code) => req.destroy(Object.assign(new Error(code), { code }));
    const timer = setTimeout(() => stop('UPLOAD_TIMEOUT'), UPLOAD_TIMEOUT_MS);
    timer.unref();

    const countBytes = (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BYTES) stop('UPLOAD_TOO_LARGE');
    };
    req.on('data', countBytes);

    // Multer handles aborted/error events, closes file streams and then calls back.
    // Closing oversized chunked requests avoids draining an unlimited body.
    upload(req, res, (error) => {
      clearTimeout(timer);
      req.removeListener('data', countBytes);
      if (error) reject(error);
      else resolve();
    });
  });
}

export function configureHttpServer(server) {
  server.headersTimeout = 15_000;
  server.requestTimeout = UPLOAD_TIMEOUT_MS;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  server.setTimeout(60_000, (socket) => socket.destroy());
}
