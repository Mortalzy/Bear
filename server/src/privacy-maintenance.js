import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanConsents, removeConsent } from './consent-store.js';
import { cleanExpired } from './app.js';

const root = path.resolve(process.env.CONSENT_DIR ?? fileURLToPath(new URL('../consents', import.meta.url)));
const uploads = path.resolve(process.env.UPLOAD_DIR ?? fileURLToPath(new URL('../storage', import.meta.url)));
const [command, id] = process.argv.slice(2);

try {
  if (command === 'cleanup' && !id) {
    await cleanConsents(root);
    await cleanExpired(uploads);
    console.log('Scheduled privacy cleanup completed.');
  } else if (command === 'delete' && /^[0-9a-f-]{36}$/.test(id ?? '')) {
    await removeConsent(root, id);
    console.log('Consent receipt removed. Also remove mail, exports and backup copies as required.');
  } else {
    throw new Error('Usage: privacy-maintenance.js cleanup | delete <request-id>');
  }
} catch (error) {
  console.error('Privacy maintenance failed:', error.code ?? error.message);
  process.exitCode = 1;
}
