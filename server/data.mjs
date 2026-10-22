import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function vault(key) {
  const bytes = Buffer.from(key || '', 'base64');
  if (bytes.length !== 32) throw new Error('DATA_KEY must be a base64 encoded 32-byte key.');
  return {
    seal(value) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', bytes, iv);
      const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
    },
    open(value) {
      const data = Buffer.from(value, 'base64url'), cipher = createDecipheriv('aes-256-gcm', bytes, data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString());
    },
  };
}

export function connectionFields(value) {
  if (!value || typeof value !== 'object' || !['vercel', 'neon', 'cloudflare'].includes(value.provider) || !['session', 'encrypted', 'plain'].includes(value.mode)) throw new Error('Invalid connection.');
  const text = (v, max) => { if (typeof v !== 'string' || v.length > max) throw new Error('Invalid connection field.'); return v; };
  const row = { id: text(value.id, 100), provider: value.provider, label: text(value.label || '', 100), scope: text(value.scope, 300), mode: value.mode };
  if (row.mode === 'plain') row.token = text(value.token, 16384);
  if (row.mode === 'encrypted') row.secret = { salt: text(value.secret?.salt, 100), iv: text(value.secret?.iv, 100), data: text(value.secret?.data, 24000) };
  return row; // Explicit allowlist: no snapshots, resources, timestamps, or workspace data.
}

