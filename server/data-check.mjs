import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { vault, connectionFields } from './data.mjs';

test('only connection form fields can reach the database payload', () => {
  const input = { id: 'a', label: 'Work', provider: 'neon', scope: 'org-a', mode: 'session', token: 'never-save', resources: ['private'], snapshots: [{ at: 1 }], workspaceId: 'secret' };
  const row = connectionFields(input);
  assert.deepEqual(Object.keys(row).sort(), ['id', 'label', 'mode', 'provider', 'scope']);
  const crypt = vault(randomBytes(32).toString('base64'));
  const encrypted = crypt.seal(row);
  assert.ok(!encrypted.includes('org-a'));
  assert.deepEqual(crypt.open(encrypted), row);
});
test('vault detects tampering and rejects incorrect keys', () => {
  const crypt = vault(randomBytes(32).toString('base64')), other = vault(randomBytes(32).toString('base64'));
  const value = crypt.seal({ token: 'private' });
  assert.throws(() => other.open(value));
  const bytes = Buffer.from(value, 'base64url'); bytes[30] ^= 1;
  assert.throws(() => crypt.open(bytes.toString('base64url')));
  assert.throws(() => vault('bad'));
});
test('stored credential modes do not leak extra fields', () => {
  const base = { id: 'b', label: '', provider: 'vercel', scope: '', mode: 'plain', token: 'secret', snapshot: {} };
  assert.equal(connectionFields(base).token, 'secret');
  assert.throws(() => connectionFields({ ...base, provider: 'unknown' }));
  assert.throws(() => connectionFields({ ...base, token: 'x'.repeat(17000) }));
  const encrypted = connectionFields({ ...base, mode: 'encrypted', secret: { salt: 's', iv: 'i', data: 'd', extra: 'no' } });
  assert.equal(encrypted.token, undefined);
  assert.deepEqual(encrypted.secret, { salt: 's', iv: 'i', data: 'd' });
});
