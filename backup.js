import { randomUUID } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readBookings } from './storage.js';

export function createBackup(dataFile, backupDir, now = new Date()) {
  if (!existsSync(dataFile)) throw new Error('尚无预约数据可备份。');
  readBookings(dataFile);
  mkdirSync(backupDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const target = join(backupDir, `reservations-${stamp}-${randomUUID().slice(0, 8)}.json`);
  copyFileSync(dataFile, target, constants.COPYFILE_EXCL);
  return target;
}
