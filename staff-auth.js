import { createHash, timingSafeEqual } from 'node:crypto';

export function isStaffKeyConfigured(key) {
  return typeof key === 'string' && key.length >= 16;
}

export function isStaffAuthorized(configuredKey, providedKey) {
  if (!isStaffKeyConfigured(configuredKey) || typeof providedKey !== 'string') return false;
  const expected = createHash('sha256').update(configuredKey).digest();
  const actual = createHash('sha256').update(providedKey).digest();
  return timingSafeEqual(expected, actual);
}
