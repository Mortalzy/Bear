import { mkdir, chmod, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { RETENTION_DAYS } from './privacy.js';

const DAY = 86_400_000;
const receiptName = /^[0-9a-f-]{36}\.json$/;

export async function saveConsent(root, receipt) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  await writeFile(path.join(root, receipt.id + '.json'), JSON.stringify({
    ...receipt,
    // Reserve one day for scheduled cleanup; total retention stays within 90 days.
    expiresAt: new Date(Date.parse(receipt.acceptedAt) + (RETENTION_DAYS - 1) * DAY).toISOString(),
  }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

export async function removeConsent(root, id) {
  if (!receiptName.test(id + '.json')) throw new Error('Invalid request ID');
  await rm(path.join(root, id + '.json'), { force: true });
}

export async function cleanConsents(root, now = Date.now()) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isFile() || !receiptName.test(entry.name)) continue;
    const filename = path.join(root, entry.name);
    try {
      const receipt = JSON.parse(await readFile(filename, 'utf8'));
      if (Number.isFinite(Date.parse(receipt.expiresAt)) && Date.parse(receipt.expiresAt) <= now) {
        await rm(filename, { force: true });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
