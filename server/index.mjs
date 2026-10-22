import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { vault, connectionFields } from './data.mjs';
import { openDatabase } from './postgres.mjs';
import { createRemoteJWKSet, jwtVerify } from 'jose';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const origin = new URL(process.env.APP_ORIGIN || 'http://127.0.0.1:5173').origin;
const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const ownerEmail = 'zohairi@live.com';
const crypt = vault(process.env.DATA_KEY);
const db = await openDatabase(process.env.DATABASE_URL);
const secure = origin.startsWith('https:');
if (!secure && !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('HTTPS is required.');

const user = sub => db.prepare('SELECT * FROM users WHERE sub=?').get(sub);
const equal = (a, b) => { const x = Buffer.from(a || ''), y = Buffer.from(b || ''); return x.length === y.length && timingSafeEqual(x, y); };
const cookie = (name, value, age) => `${name}=${value}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${age}${secure ? '; Secure' : ''}`;
const redirectURI = origin + '/api/auth/callback';
const configured = !!(clientId && clientSecret);

createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  const redirect = path => { res.writeHead(302, { Location: path }); res.end(); };
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')));
  const readCookie = name => { try { const data = crypt.open(cookies[name]); return data.exp > Date.now() ? data : undefined; } catch { return undefined; } };
  const session = readCookie('sp_session');
  let account, config, owner, allowed;


  const url = new URL(req.url, origin), path = url.pathname;
  try {
    if (path.startsWith('/api/')) {
      config = await db.prepare('SELECT * FROM settings WHERE id=1').get();
      account = session && await user(session.sub);
      owner = !!account && config.owner_sub === account.sub;
      allowed = !!account && (owner || !!(account.active && config.enabled));
    }
    if (req.method !== 'GET' && req.headers.origin !== origin) return send(403, { error: 'Origin rejected.' });
    const body = async () => {
      if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('JSON required.');
      let data = ''; for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 40000) throw new Error('Request too large.'); }
      return JSON.parse(data);
    };
    if (path === '/api/session' && req.method === 'GET') return send(200, { available: configured, enabled: !!config.enabled, user: account ? { email: account.email, active: allowed, owner, canClaim: !config.owner_sub && account.email.toLowerCase() === ownerEmail } : null });
    if (path === '/api/auth/start' && req.method === 'GET') {
      if (!configured) return send(503, { error: 'Google sign-in is not configured.' });
      const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
      res.setHeader('Set-Cookie', cookie('sp_oauth', crypt.seal({ state, verifier, exp: Date.now() + 600000 }), 600));
      const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      target.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectURI, response_type: 'code', scope: 'openid email', state, nonce: state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
      return redirect(target.href);
    }
    if (path === '/api/auth/callback' && req.method === 'GET') {
      const flow = readCookie('sp_oauth');
      res.setHeader('Set-Cookie', cookie('sp_oauth', '', 0));
      if (!flow || !equal(flow.state, url.searchParams.get('state')) || !url.searchParams.get('code')) return redirect('/?signin=failed');
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: clientId, client_secret: clientSecret, redirect_uri: redirectURI, grant_type: 'authorization_code', code_verifier: flow.verifier }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) return redirect('/?signin=failed');
      const token = await response.json();
      const { payload: profile } = await jwtVerify(token.id_token, googleKeys, { audience: clientId, issuer: ['https://accounts.google.com', 'accounts.google.com'], algorithms: ['RS256'] });
      if (!profile.sub || typeof profile.email !== 'string' || profile.email_verified !== true || profile.nonce !== flow.state) return redirect('/?signin=failed');
      // Google tokens are verified and discarded; only the subject and email persist.
      await db.prepare('INSERT INTO users(sub,email) VALUES(?,?) ON CONFLICT(sub) DO UPDATE SET email=excluded.email').run(profile.sub, profile.email);
      res.setHeader('Set-Cookie', [cookie('sp_oauth', '', 0), cookie('sp_session', crypt.seal({ sub: profile.sub, exp: Date.now() + 86400000 }), 86400)]);
      return redirect('/');
    }
    if (path === '/api/auth/logout' && req.method === 'POST') { res.setHeader('Set-Cookie', cookie('sp_session', '', 0)); return send(200, {}); }
    if (path === '/api/admin/claim' && req.method === 'POST') {
      const input = await body();
      if (!account || account.email.toLowerCase() !== ownerEmail || config.owner_sub || !process.env.OWNER_SETUP_CODE || !equal(input.code, process.env.OWNER_SETUP_CODE)) return send(403, { error: 'Owner setup denied.' });
      await db.prepare('UPDATE settings SET owner_sub=? WHERE id=1 AND owner_sub IS NULL').run(account.sub);
      return send(200, {});
    }
    if (path.startsWith('/api/admin')) {
      if (!owner) return send(403, { error: 'Owner access required.' });
      if (path === '/api/admin' && req.method === 'GET') return send(200, { enabled: !!config.enabled, users: await db.prepare('SELECT sub,email,active FROM users ORDER BY email LIMIT 201').all() });
      if (path === '/api/admin' && req.method === 'PUT') {
        const input = await body();
        if (typeof input.enabled === 'boolean') await db.prepare('UPDATE settings SET enabled=? WHERE id=1').run(Number(input.enabled));
        if (typeof input.sub === 'string' && typeof input.active === 'boolean' && input.sub !== account.sub) await db.prepare('UPDATE users SET active=? WHERE sub=?').run(Number(input.active), input.sub);
        return send(200, {});
      }
    }
    if (path === '/api/connections' || path.startsWith('/api/connections/')) {
      if (!allowed) return send(403, { error: 'Sign-in must be enabled and your account activated by the owner.' });
      if (path === '/api/connections' && req.method === 'GET') return send(200, (await db.prepare('SELECT fields FROM connections WHERE user_sub=?').all(account.sub)).map(row => ({ ...crypt.open(row.fields), workspaceId: 'personal' })));
      if (path === '/api/connections' && req.method === 'PUT') {
        const fields = connectionFields(await body());
        const count = (await db.prepare('SELECT COUNT(*) AS n FROM connections WHERE user_sub=?').get(account.sub)).n;
        if (count >= 100 && !(await db.prepare('SELECT 1 FROM connections WHERE user_sub=? AND id=?').get(account.sub, fields.id))) return send(400, { error: 'Maximum 100 saved connections.' });
        await db.prepare('INSERT INTO connections VALUES(?,?,?) ON CONFLICT(user_sub,id) DO UPDATE SET fields=excluded.fields').run(account.sub, fields.id, crypt.seal(fields));
        return send(200, {});
      }
      if (path.startsWith('/api/connections/') && req.method === 'DELETE') { await db.prepare('DELETE FROM connections WHERE user_sub=? AND id=?').run(account.sub, decodeURIComponent(path.slice('/api/connections/'.length))); return send(200, {}); }
    }
    if (path.startsWith('/api/')) return send(404, { error: 'Not found.' });
    if (req.method !== 'GET') return send(405, { error: 'Method not allowed.' });
    const root = resolve('dist'), file = resolve(root, '.' + decodeURIComponent(path));
    if (!file.startsWith(root + '/') && !file.startsWith(root + '\\') && file !== root) return send(404, { error: 'Not found.' });
    const actual = path === '/' ? resolve(root, 'index.html') : file;
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
    const data = await readFile(actual);
    res.writeHead(200, { 'Content-Type': types[extname(actual)] || 'application/octet-stream' }); res.end(data);
  } catch { send(400, { error: 'Request could not be completed. Check your input or server configuration.' }); }
}).listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('StackPulse server ready.'));
