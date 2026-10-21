# Publishing StackPulse

StackPulse publishes as a static `dist/` artifact. The publishing foundation separates reusable build/verification functions from the host upload step. No hosting SDK or deployment dependency is added to the browser bundle.

## GitHub Pages setup

1. Put the **application source** (`package.json`, `src/`, `public/`, `scripts/`, `tests/`, `.github/`, configuration files, and `index.html`) at the root of the repository you push to GitHub.
2. In that repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Commit and push the source and `.github/workflows/pages.yml` to the default branch. The workflow builds, tests, verifies, uploads `dist/`, and deploys it. It can also be run manually from Actions on the default branch.
4. Use the URL reported by the `deploy` job. For `zuhairi-git/StackPulse` without a custom domain, this is `https://zuhairi-git.github.io/StackPulse/`.

**Local checkout mismatch discovered during setup:** the application lives in `C:/Users/zohai/Documents/GitHub/StackPulse`, but the connected GitHub checkout is `C:/Users/zohai/Documents/GitHub/StackPulse/StackPulse` and currently contains only `.gitattributes`. Publishing that nested checkout does not publish this application. Open/publish the application root as your repository, or relocate the application source into the connected checkout before committing. Keep one authoritative source tree; do not maintain two copies. The implementation does not move Git metadata, change remotes, commit, or push on your behalf.

Do not publish the unbuilt Vite source directly using “Deploy from a branch.” `index.html` in the deployed artifact must reference compiled JavaScript. No provider API keys or other application secrets belong in repository settings: all provider connections remain device-local.

## Commands

| Command | Result |
| --- | --- |
| `npm run build` | Build for the default target in `publishing.config.json` (initially root-hosted static). |
| `npm run build:pages` | Build for the GitHub repository path from `publishing.config.json`. |
| `node scripts/publish.mjs build --target github-pages --repository owner/new-name` | Build for another Pages repository, including root-hosted `owner.github.io` repositories. |
| `node scripts/publish.mjs build --target static --base /tools/pulse/` | Build for an arbitrary host subdirectory. |
| `node scripts/publish.mjs build --target github-pages --base /` | Build for Pages with a custom domain at its root. |
| `npm run publish:verify` | Verify the existing artifact's asset links, manifest scope, and offline precache file paths. Does not upload. |
| `npm run preview` | Serve the last artifact locally. Open the base path recorded in `dist/publishing.json`. |

Builds overwrite `dist/`, so build for the intended target immediately before uploading. `publishing.json` records the chosen target/base; `.nojekyll` prevents Jekyll processing if the artifact is used with branch-based hosting later. `dist/` remains ignored by Git.

## How the foundation works

- `publishing.config.json` declares the default target and per-target settings. For a future host, add a target such as `"cloudflare-pages": { "basePath": "/" }`, then build with `--target cloudflare-pages` and upload the same `dist/` artifact using that host's tooling.
- `scripts/publishing.mjs` exports `normalizeBasePath`, `resolvePublishing`, `readPublishing`, `buildSite`, and `verifySite`. Import these functions for another publishing pipeline. `buildSite` runs TypeScript, invokes Vite, writes artifact metadata, and verifies the result. It does not upload or require credentials.
- `scripts/publish.mjs` is the thin CLI. Explicit `--base` takes precedence over target settings; repository naming is used only when the target has no explicit base. Paths are validated and normalized before the build.
- `.github/workflows/pages.yml` contains only GitHub orchestration. `configure-pages` supplies the actual `base_path`, so a Pages custom domain or repository rename does not require editing application code. The workflow executes only on the default branch; the deploy job alone has Pages write and OIDC permissions.
- Vite's `base` is the single application path source. HTML assets, the logo, manifest location, and service-worker registration all honor it. Manifest entries resolve relative to the manifest. The service worker precaches and serves only its base path and uses a separate cache namespace for each base, preserving other apps on the same origin.

## Diagnosing 404s

- **The site URL itself returns GitHub's 404:** confirm Pages is enabled, Source is GitHub Actions, the latest deployment succeeded, and the source was pushed from the correct local checkout. App code cannot fix an unpublished Pages site.
- **HTML loads but assets 404:** confirm the artifact base matches the live URL, including capitalization. Project Pages needs `/StackPulse/`; a root custom domain needs `/`. Inspect `dist/publishing.json` and rerun `publish:verify`.
- **Old content remains:** close all StackPulse tabs to allow a waiting service worker to activate, then reopen. For migration troubleshooting, remove only the old StackPulse service worker/cache in browser developer tools. Clearing site storage also erases local credentials and snapshots.
- **A deep path 404s:** the app currently navigates in local React state, so only its base URL is supported as an entry point. If URL routing is introduced, use hash routing or add a host-specific fallback; GitHub Pages does not provide configurable SPA rewrites.

Changing host changes origin and therefore the local IndexedDB store. Users must reconnect providers on the new origin. CORS capabilities must also be rechecked there.

References: [Vite static deployment](https://vite.dev/guide/static-deploy.html), [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
