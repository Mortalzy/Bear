import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const server = createApp().listen(port, host, () => {
  console.log('Bear API listening on http://' + host + ':' + port);
});
server.on('error', (error) => {
  console.error('API failed to start:', error.code ?? 'UNKNOWN');
  process.exitCode = 1;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close((error) => {
    process.exit(error ? 1 : 0);
  });
  setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
