import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaffAuthorized, isStaffKeyConfigured } from '../staff-auth.js';

test('staff access requires a configured 16-character key', () => {
  assert.equal(isStaffKeyConfigured(undefined), false);
  assert.equal(isStaffKeyConfigured('short'), false);
  assert.equal(isStaffKeyConfigured('a-secure-demo-key'), true);
  assert.equal(isStaffAuthorized('short', 'short'), false);
});

test('staff key comparison accepts only the exact key', () => {
  assert.equal(isStaffAuthorized('a-secure-demo-key', 'a-secure-demo-key'), true);
  assert.equal(isStaffAuthorized('a-secure-demo-key', 'a-secure-demo-keY'), false);
  assert.equal(isStaffAuthorized('a-secure-demo-key', undefined), false);
});
