import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

test('HTTP booking, lookup, staff view and cancellation flow', async () => {
  const root = process.cwd();
  const workDir = join(root, 'work');
  mkdirSync(workDir, { recursive: true });
  const dataFile = join(workDir, `http-flow-${process.pid}.json`);
  const staffKey = 'test-staff-key-2026';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: '0', DATA_FILE: dataFile, STAFF_KEY: staffKey },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000);
      child.stdout.on('data', (chunk) => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
      child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    });
    const base = `http://127.0.0.1:${port}`;
    const call = async (path, options = {}) => {
      const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(5000) });
      return { status: response.status, body: await response.json() };
    };
    const post = (path, body, headers = {}) => call(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
    });

    const health = await call('/api/health');
    const config = await call('/api/config');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');
    const date = config.body.max;
    const input = { date, time: '18:00', partySize: 2, lambQty: 1, name: '测试顾客', phone: '13800112233', note: '' };
    const before = await call(`/api/availability?date=${date}`);
    const created = await post('/api/reservations', input);
    assert.equal(created.status, 201);
    const credentials = { code: created.body.code, phone: input.phone };
    assert.equal((await post('/api/reservations/lookup', { ...credentials, phone: '13900112233' })).status, 404);
    assert.equal((await post('/api/reservations/lookup', credentials)).body.status, 'confirmed');
    assert.equal((await call(`/api/staff/bookings?date=${date}`, { headers: { 'X-Staff-Key': 'wrong-key' } })).status, 401);
    const staff = await call(`/api/staff/bookings?date=${date}`, { headers: { 'X-Staff-Key': staffKey } });
    assert.equal(staff.body.bookings.length, 1);
    const cancelled = await post('/api/reservations/cancel', credentials);
    assert.equal(cancelled.body.status, 'cancelled');
    const after = await call(`/api/availability?date=${date}`);
    assert.equal(after.body.lambRemaining, before.body.lambRemaining);
    assert.equal(after.body.slots['18:00'], before.body.slots['18:00']);
  } finally {
    child.kill();
    if (existsSync(dataFile)) unlinkSync(dataFile);
  }
});
