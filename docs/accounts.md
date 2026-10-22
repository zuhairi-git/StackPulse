# Optional Google accounts

Guest use needs no server or database. To enable accounts, run the included Node 24 server with a Neon Postgres database using a pooled connection string in DATABASE_URL. GitHub Pages alone cannot host sign-in or the database. Serve the built app and `/api` on the same HTTPS origin through a reverse proxy. The server binds to localhost on port 3001. During development Vite proxies `/api` to this server.

1. Copy `.env.example` to `.env`. Generate `DATA_KEY` using the command in that file and keep it stable and private. Losing this key makes stored connection fields unreadable and invalidates sessions.
2. In Google Cloud create a Web OAuth client with redirect URI `https://YOUR-HOST/api/auth/callback` (development: `http://127.0.0.1:5173/api/auth/callback`). Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_ORIGIN`. Configure the OAuth consent screen and test users as required by Google.
3. Set a strong random `OWNER_SETUP_CODE`. Run `npm run server` and `npm run dev`, or build the app and serve it through the server and HTTPS reverse proxy in production.
4. Use **Sign in / Guest**, sign in with the Google account registered as `zohairi@live.com`, and enter the owner setup code. Ownership is then pinned to that Google subject, not future email matches. Remove the setup code from the server environment afterward.
5. The owner enables account sync and activates each requested account in the sign-in panel. Disabling sync or deactivating an account blocks subsequent server reads and writes. It cannot erase data already loaded into an open browser.

The database has only a singleton activation/owner setting, Google subject/email/activation per user, and current connection form fields per user. No history, resource snapshots, refresh timestamps, workspace names, Google access tokens, refresh tokens, or session rows are stored. Sessions are encrypted HttpOnly cookies lasting one day; Google authorization uses state, PKCE, and a direct server-side token exchange with signature, issuer, audience, expiry, and nonce verification of Google's ID token. Provider tokens are never put in URLs or logs. Saved connection fields are encrypted at rest with AES-256-GCM. HTTPS is required outside localhost.

Memory-only mode syncs connection metadata but never its token. Passphrase mode syncs the existing encrypted credential; its passphrase stays on the device. The device-storage mode saves a token on the device and also syncs it inside server encryption when signed in. Snapshots and workspace assignments remain in a separate local database for each signed-in account. New devices start with all cloud connections in Personal. Guest records are never uploaded or merged automatically. Sign-out returns to the original guest database. Sync loads connections on page load and writes on explicit save/delete, with at most 100 connections per account and no background database polling. Concurrent saves use last-write-wins.

Keep Neon backups and the encryption key secure. The server initializes the three small tables in server/schema.sql automatically; use a dedicated database for StackPulse. Configure request limits and rate limiting at the reverse proxy, including sign-in and account creation. The owner list is bounded to 201 users for this initial small deployment.

This account service does not proxy provider requests. Neon/Cloudflare browser connectivity limitations remain separate.

Google reference: https://developers.google.com/identity/openid-connect/openid-connect

## Where secrets go

Locally, keep the variables in .env, which Git ignores. In production, set them in the backend hosting dashboard. GitHub Pages cannot execute this server or read runtime secrets. GitHub Actions secrets are for deployment jobs only; never inject DATABASE_URL, GOOGLE_CLIENT_SECRET, DATA_KEY, or OWNER_SETUP_CODE into the browser bundle or prefix them with VITE_. This implementation expects the app and API on the same origin. To keep Pages as the frontend with a separate API would require an additional cross-origin authentication deployment design.
