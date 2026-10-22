# StackPulse

**Your infrastructure. One pulse.**

A lightweight, local-first React + TypeScript + Vite PWA for independent Vercel, Neon, and Cloudflare connections. No application backend, analytics, cloud credential storage, or provider SDKs. The initial screen is an honest empty workspace; there is no mock account data.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

The production output is `dist/`. Root hosting and subdirectory hosting (including GitHub project Pages) are supported through `publishing.config.json`. Use `npm run build:pages` for the configured GitHub repository, or `npm run build` for the default root-hosted target. No provider secrets or server functions are needed. The offline shell is generated only for production builds. The dev server intentionally does not install a service worker.

See [Publishing StackPulse](docs/publishing.md) for reusable publishing functions, host migration, and 404 troubleshooting. `npm run deploy:pages` builds and publishes compiled output to a dedicated `gh-pages` branch using authenticated Git and GitHub CLI. A GitHub Actions workflow is also included for automated deployment when available. Never publish the unbuilt `main` branch directly.

## What the MVP monitors

| Provider | Read endpoint | Displayed data | Browser findings, October 21, 2026 |
| --- | --- | --- | --- |
| Vercel | `GET https://api.vercel.com/v7/deployments?limit=20` | Latest 20 deployments and their reported state; optional team scope | Localhost OPTIONS and invalid-token GET responses returned `Access-Control-Allow-Origin: *` and allowed Authorization. Authenticated reads are not yet account-tested. |
| Neon | `GET https://console.neon.tech/api/v2/projects?limit=20` | First 20 projects and regions; optional organization scope | OPTIONS returned 204 without an allow-origin header for localhost. Direct browser access was unavailable in this check. |
| Cloudflare | `GET https://api.cloudflare.com/client/v4/zones?per_page=20` | First 20 zones and reported zone status; optional account scope | OPTIONS returned 400 without an allow-origin header for localhost. Direct browser access was unavailable in this check. |

Neon and Cloudflare require a browser capability check before accepting a new credential. This uses a deliberately invalid sentinel token, not a user secret. A readable response establishes browser reachability, not authentication. CORS varies by endpoint and origin and may change. Fetch errors cannot distinguish CORS, DNS, connectivity, and extension blocking. There is no proxy, `no-cors` workaround, or browser-security bypass. A backend-free app cannot force a provider to permit browser requests.

These are snapshots, not uptime probes. A READY deployment does not establish application health, an active zone does not establish edge health, and a listed Neon project does not establish compute health. Pagination is deliberately bounded to 20 items and disclosed in each provider card. The MVP does not include billing, runtime logs, traffic, SQL access, notifications, historical charts, or complete resource inventory.

## Credentials and local data

- Memory-only is the default. Connection metadata and snapshots persist, but the token is lost on reload or session lock. Re-enter it to reconnect.
- Optional encrypted storage uses AES-256-GCM, a random 96-bit IV and 128-bit salt per save, and PBKDF2-SHA-256 with 310,000 iterations. Passphrases require 12 characters and are never persisted. Unlocking keeps the token in memory until lock/reload. There is no passphrase recovery.
- Unencrypted IndexedDB token storage is an explicit third choice with an in-app disclosure. Locking the session cannot protect tokens saved in this mode.
- Resource names, IDs, regions, states, timestamps, and account scope are cached **unencrypted**, including when token encryption is selected. Disconnect erases both the provider credential record and its snapshot in one transaction. It does not revoke a token at the provider.
- Same-origin scripts and browser extensions with sufficient access can read an unlocked token. Encryption is protection at rest, not protection from XSS or a compromised device. No third-party scripts, fonts, images, or analytics load in production. React escapes resource text; provider links use fixed official dashboard URLs.
- Tokens are sent only as Authorization headers to the selected official API, with cookies omitted, caching disabled, and no referrer. Provider errors are mapped to safe app messages rather than displaying response bodies.
- All adapters issue GET only. **A read-only app does not make a broad token read-only.** Use least-privilege provider permissions. Cloudflare: Zone → Zone → Read on selected zones. Neon project-scoped keys have Editor access; prefer a personal key associated with a Viewer account. Vercel: select the smallest appropriate account/team scope and check its effective permissions.

Browser storage can be cleared or evicted by the browser and is scoped to this origin and profile. Use a stable origin. Storage failures are reported; a failed write never becomes a successful refresh.

## Freshness and offline behavior

Successful fetch completion sets the snapshot timestamp. Failed refreshes preserve the last successful snapshot and timestamp. Data is marked stale after five minutes, while offline, or after a failed refresh. Each resource displays snapshot freshness; no single timestamp implies all providers were refreshed. Requests time out after 15 seconds. Manual refresh is the default. App-wide Auto/Manual controls are available on every page, with optional 1- or 5-minute polling only while the tab is visible, online, and credentials are available. Refresh preferences are saved on this device across reloads; Auto defaults to five minutes when enabled. Refresh all and individual provider Refresh buttons work in either mode. Connecting or unlocking also refreshes that provider. Exact local date/time timestamps show each provider’s last successful refresh; the app-wide timestamp identifies the latest successful refresh of any provider, not a complete refresh of all providers. Failed requests preserve the previous timestamp. No closed-app/background monitoring is implied.

The service worker precaches only the built app shell and branded assets. It never intercepts cross-origin APIs or caches Authorization requests. A successful online production visit is required before offline use. New service-worker versions activate after existing tabs close, avoiding a forced reload of an unlocked session. Install through the browser menu; on iOS use Share → Add to Home Screen.

## Structure and verification

- `src/providers/`: isolated provider adapters plus a shared GET-only request boundary and runtime response validation.
- `src/storage.ts`: native IndexedDB transactions and Web Crypto encryption.
- `src/model.ts`: shared types and freshness rules.
- `src/App.tsx`: responsive overview, searchable snapshots, connections, settings, and accessible native dialogs.
- `vite.config.ts`: content-versioned app-shell service-worker generation without a PWA runtime dependency.
- `tests/`: encryption round-trip/wrong-passphrase checks, independent transactional deletion, stale-data behavior, request constraints, malformed/error response handling, offline module caching with Vary: Origin, and exclusion of credential/API requests. Provider fixtures are test-only.

Validation: TypeScript production build, eight automated tests, and a dependency audit with zero reported vulnerabilities. Browser checks covered desktop rendering, a 390px mobile viewport, the Neon browser-access gate, and a successful offline reload with the production preview server stopped. Screenshots are in the ignored qa-artifacts directory. The built JavaScript is approximately 79.3 KB gzip, with 4.8 KB gzip of CSS. Account validation should additionally cover live scoped tokens, provider-specific permissions, reload/unlock with a real token, and native installation on the target mobile browser. No authenticated provider account was available during implementation.

## Official references

- [Vercel list deployments](https://vercel.com/docs/rest-api/deployments/list-deployments)
- [Vercel integration CORS guidance](https://vercel.com/docs/integrations/create-integration/vercel-api-integrations) recommends server-side integration access; the endpoint-specific header observations above are not a blanket browser-support guarantee.
- [Neon list projects](https://api-docs.neon.tech/reference/listprojects)
- [Neon API key types and privileges](https://neon.com/docs/manage/api-keys)
- [Cloudflare list zones and permissions](https://developers.cloudflare.com/api/resources/zones/methods/list/)

The PWA manifest, SVG logo, PNG install icons, page metadata, application, and documentation consistently use StackPulse.

