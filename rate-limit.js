export function createRateLimiter({ maxAttempts, windowMs }) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isInteger(windowMs) || windowMs < 1) {
    throw new TypeError('Invalid rate limit settings');
  }
  const buckets = new Map();
  return {
    consume(key, now = Date.now()) {
      const current = buckets.get(key);
      if (!current || now >= current.expiresAt) {
        buckets.set(key, { count: 1, expiresAt: now + windowMs });
        return true;
      }
      if (current.count >= maxAttempts) return false;
      current.count += 1;
      if (buckets.size > 1000) {
        for (const [bucketKey, bucket] of buckets) {
          if (now >= bucket.expiresAt) buckets.delete(bucketKey);
        }
      }
      return true;
    }
  };
}
