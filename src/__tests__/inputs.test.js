import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePositiveInt } from '../inputs.js';

test('accepts valid positive integers', () => {
  assert.equal(parsePositiveInt('1', 'max-repos'), 1);
  assert.equal(parsePositiveInt('108', 'max-repos'), 108);
  assert.equal(parsePositiveInt('0012', 'max-repos'), 12);
});

test('rejects malformed integer inputs', () => {
  assert.throws(() => parsePositiveInt('', 'max-repos'), /positive integer/);
  assert.throws(() => parsePositiveInt('0', 'max-repos'), /positive integer/);
  assert.throws(() => parsePositiveInt('-1', 'max-repos'), /positive integer/);
  assert.throws(() => parsePositiveInt('12abc', 'max-repos'), /positive integer/);
  assert.throws(() => parsePositiveInt('10.5', 'max-repos'), /positive integer/);
});
