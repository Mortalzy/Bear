import test from 'node:test';
import assert from 'node:assert/strict';
import { UPLOAD_POLICY, validateFileSelection } from '../src/index.js';

test('attachments are optional', () => {
  assert.deepEqual(validateFileSelection([]), []);
});
test('allows several supported formats, including uppercase', () => {
  assert.deepEqual(validateFileSelection([
    { name: 'drawing.DWG', size: 50_000_000 },
    { name: 'model.step', size: 12_000_000 },
    { name: 'brief.pdf', size: 500 },
  ]), []);
});
test('accepts exactly five files at the size limit', () => {
  const files = Array.from({ length: 5 }, (_, i) => ({ name: i + '.pdf', size: 50_000_000 }));
  assert.deepEqual(validateFileSelection(files), []);
  assert.equal(UPLOAD_POLICY.maxTotalBytes, 250_000_000);
});
test('rejects even one byte above the per-file limit', () => {
  assert.ok(validateFileSelection([{ name: 'a.pdf', size: 50_000_001 }]).length);
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
