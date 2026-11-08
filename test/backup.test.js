import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createBackup } from '../backup.js';

const testRoot = join(process.cwd(), 'work');
mkdirSync(testRoot, { recursive: true });

test('backup command copies valid reservation data without changing the source', (t) => {
  const directory = mkdtempSync(join(testRoot, 'backup-test-'));
  const source = join(directory, 'reservations.json');
  const backupDir = join(directory, 'backups');
  t.after(() => {
    for (const file of readdirSync(backupDir)) unlinkSync(join(backupDir, file));
    rmdirSync(backupDir);
    unlinkSync(source);
    rmdirSync(directory);
  });
  writeFileSync(source, '[]');
  const target = createBackup(source, backupDir, new Date('2026-11-08T08:00:00Z'));
  assert.equal(readFileSync(target, 'utf8'), '[]');
  assert.equal(readFileSync(source, 'utf8'), '[]');
});
