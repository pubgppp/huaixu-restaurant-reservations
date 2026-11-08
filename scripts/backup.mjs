import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackup } from '../backup.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = process.env.DATA_FILE || join(root, 'data', 'reservations.json');
const backupDir = process.env.BACKUP_DIR || join(root, 'data', 'backups');

try {
  const target = createBackup(dataFile, backupDir);
  console.log(`预约数据已备份到：${target}`);
} catch (error) {
  console.error(`备份失败：${error.message}`);
  process.exitCode = 1;
}
