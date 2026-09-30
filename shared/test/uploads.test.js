import test from 'node:test';
import assert from 'node:assert/strict';
import { UPLOAD_POLICY, validateFileSelection } from '../src/index.js';

test('attachments are optional', () => {
  assert.deepEqual(validateFileSelection([]), []);
});
test('allows supported formats with a combined size within 18 MB', () => {
  assert.deepEqual(validateFileSelection([
    { name: 'drawing.DWG', size: 10_000_000 },
    { name: 'model.step', size: 7_000_000 },
    { name: 'brief.pdf', size: 1_000_000 },
  ]), []);
});
test('rejects files over 25 MB and collections over 18 MB', () => {
  assert.equal(UPLOAD_POLICY.maxFileBytes, 25_000_000);
  assert.equal(UPLOAD_POLICY.maxTotalBytes, 18_000_000);
  assert.ok(validateFileSelection([{ name: 'a.pdf', size: 25_000_001 }]).some((error) => error.includes('25 МБ')));
  assert.ok(validateFileSelection([{ name: 'a.pdf', size: 9_000_000 }, { name: 'b.pdf', size: 9_000_001 }])
    .some((error) => error.includes('18 МБ')));
});
test('rejects a sixth attachment', () => {
  assert.ok(validateFileSelection(Array.from({ length: 6 }, () => ({ name: 'a.jpg', size: 10 }))).length);
});
test('rejects empty files, executable suffixes and malformed metadata', () => {
  for (const file of [
    { name: 'a.pdf', size: 0 }, { name: 'a.pdf.exe', size: 10 },
    { name: '.pdf', size: 10 }, { name: 'a.pdf', size: -1 },
    { name: 'a.pdf', size: NaN }, null,
  ]) assert.ok(validateFileSelection([file]).length);
});
