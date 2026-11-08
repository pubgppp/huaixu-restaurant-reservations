import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../rate-limit.js';

test('rate limiter isolates clients and resets after the window', () => {
  const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 1000 });
  assert.equal(limiter.consume('a', 0), true);
  assert.equal(limiter.consume('a', 100), true);
  assert.equal(limiter.consume('a', 200), false);
  assert.equal(limiter.consume('b', 200), true);
  assert.equal(limiter.consume('a', 1000), true);
});
