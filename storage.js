import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readBookings(file) {
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed) || parsed.some((item) =>
    !item || typeof item.id !== 'string' || typeof item.code !== 'string' ||
    typeof item.date !== 'string' || typeof item.time !== 'string' ||
    !Number.isInteger(item.partySize) || !Number.isInteger(item.lambQty) ||
    typeof item.phone !== 'string'
  )) {
    throw new Error('预约数据格式无效');
  }
  return parsed;
}

export function saveBookings(file, bookings) {
  mkdirSync(dirname(file), { recursive: true });
  const tempFile = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tempFile, JSON.stringify(bookings, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(tempFile, file);
  } finally {
    if (existsSync(tempFile)) unlinkSync(tempFile);
  }
}
