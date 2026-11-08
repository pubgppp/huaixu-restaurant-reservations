import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readBookings, saveBookings } from '../storage.js';

const testRoot = join(process.cwd(), 'work');
mkdirSync(testRoot, { recursive: true });

test('booking data is saved and read without leftover temporary files', (t) => {
  const directory = mkdtempSync(join(testRoot, 'huaixu-storage-'));
  const file = join(directory, 'bookings.json');
  t.after(() => { unlinkSync(file); rmdirSync(directory); });
  assert.deepEqual(readBookings(file), []);
  const booking = { id: 'a', code: 'HX-123', date: '2026-11-08', time: '18:00', partySize: 2, lambQty: 1, phone: '13800112233' };
  saveBookings(file, [booking]);
  assert.deepEqual(readBookings(file), [booking]);
  assert.match(readFileSync(file, 'utf8'), /HX-123/);
});

test('corrupt data is rejected instead of silently losing bookings', (t) => {
  const directory = mkdtempSync(join(testRoot, 'huaixu-storage-'));
  const file = join(directory, 'bookings.json');
  t.after(() => { unlinkSync(file); rmdirSync(directory); });
  writeFileSync(file, '{broken');
  assert.throws(() => readBookings(file), SyntaxError);
  writeFileSync(file, '[{"date":"2026-11-08"}]');
  assert.throws(() => readBookings(file), /预约数据格式无效/);
});
