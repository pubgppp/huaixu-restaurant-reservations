import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readJson, securityHeaders } from '../http-utils.js';

function request(body, contentType = 'application/json') {
  const stream = Readable.from([Buffer.from(body)]);
  stream.headers = { 'content-type': contentType };
  return stream;
}

test('JSON reader accepts valid bodies and rejects other content types', async () => {
  assert.deepEqual(await readJson(request('{"ok":true}')), { ok: true });
  await assert.rejects(readJson(request('{}', 'text/plain')), (error) => error.status === 415);
  await assert.rejects(readJson(request('{broken')), (error) => error.status === 400);
});

test('JSON body limit counts UTF-8 bytes', async () => {
  await assert.rejects(readJson(request(JSON.stringify({ note: '羊'.repeat(20) })), 30), (error) => error.status === 413);
});

test('responses deny framing and external script execution', () => {
  assert.equal(securityHeaders['X-Frame-Options'], 'DENY');
  assert.match(securityHeaders['Content-Security-Policy'], /script-src 'self'/);
});
