import test from 'node:test';
import assert from 'node:assert/strict';
import { UPLOAD_POLICY, validateFileSelection } from '../src/index.js';

test('attachments are optional', () => {
  assert.deepEqual(validateFileSelection([]), []);
});
test('allows supported formats with a combined size within 200 MB', () => {
  assert.deepEqual(validateFileSelection([
    { name: 'drawing.DWG', size: 10_000_000 },
    { name: 'model.step', size: 7_000_000 },
    { name: 'brief.pdf', size: 1_000_000 },
  ]), []);
});
test('rejects files over 25 MB and collections over 200 MB', () => {
  assert.equal(UPLOAD_POLICY.maxFileBytes, 25_000_000);
  assert.equal(UPLOAD_POLICY.maxTotalBytes, 200_000_000);
  assert.ok(validateFileSelection([{ name: 'a.pdf', size: 25_000_001 }]).some((error) => error.includes('25 МБ')));
  const files = Array.from({ length: 10 }, (_, i) => ({ name: i + '.pdf', size: 20_000_000 }));
  files[9].size++;
  assert.ok(validateFileSelection(files).some((error) => error.includes('200 МБ')));
});
test('allows exactly 25 MB per file, 200 MB total, and ten attachments', () => {
  assert.deepEqual(validateFileSelection([{ name: 'a.pdf', size: 25_000_000 }]), []);
  assert.deepEqual(validateFileSelection(Array.from({ length: 8 }, (_, i) => ({ name: i + '.pdf', size: 25_000_000 }))), []);
  assert.deepEqual(validateFileSelection(Array.from({ length: 10 }, (_, i) => ({ name: i + '.pdf', size: 20_000_000 }))), []);
});
test('rejects an eleventh attachment', () => {
  assert.ok(validateFileSelection(Array.from({ length: 11 }, (_, i) => ({ name: i + '.jpg', size: 10 })))
    .some((error) => error.includes('10 файлов')));
});
test('rejects empty files, executable suffixes and malformed metadata', () => {
  for (const file of [
    { name: 'a.pdf', size: 0 }, { name: 'a.pdf.exe', size: 10 },
    { name: '.pdf', size: 10 }, { name: 'a.pdf', size: -1 },
    { name: 'a.pdf', size: NaN }, null,
  ]) assert.ok(validateFileSelection([file]).length);
});
