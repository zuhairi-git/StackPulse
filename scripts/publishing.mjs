import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function normalizeBasePath(value = '/') {
  if (value === '') return '/';
  if (typeof value !== 'string' || !/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]*\/?$/.test(value) || value.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new Error('Base path must be an absolute URL path such as / or /StackPulse/, without a domain, query, or dot segments.');
  }
  return value.endsWith('/') ? value : `${value}/`;
}

// Host-specific decisions live here. The app only consumes Vite's BASE_URL.
export function resolvePublishing(config, { target = config.defaultTarget, basePath, repository } = {}) {
  const settings = config.targets[target];
  if (!settings) throw new Error(`Unknown publishing target: ${target}`);
  if (basePath !== undefined) return { target, basePath: normalizeBasePath(basePath) };
  if (settings.basePath !== undefined) return { target, basePath: normalizeBasePath(settings.basePath) };
  const repo = repository || settings.repository;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '')) throw new Error('Publishing target needs an owner/repository value.');
  const [owner, name] = repo.split('/');
  return { target, basePath: name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : normalizeBasePath(`/${name}/`) };
}

export async function readPublishing(options = {}) {
  const config = JSON.parse(await readFile(resolve(projectRoot, 'publishing.config.json'), 'utf8'));
  return resolvePublishing(config, options);
}

export async function verifySite(directory = resolve(projectRoot, 'dist')) {
  const metadata = JSON.parse(await readFile(resolve(directory, 'publishing.json'), 'utf8'));
  const base = normalizeBasePath(metadata.basePath);
  const html = await readFile(resolve(directory, 'index.html'), 'utf8');
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.webmanifest'), 'utf8'));
  const sw = await readFile(resolve(directory, 'sw.js'), 'utf8');
  const files = JSON.parse(sw.match(/const FILES = (\[.*\]);/)?.[1] || 'null');
  if (!Array.isArray(files) || !files.includes(`${base}index.html`)) throw new Error('Offline shell is missing its base-scoped entry point.');
  const origin = 'https://stackpulse.invalid';
  const localPaths = [
    ...[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => new URL(match[1], origin + base).pathname),
    ...manifest.icons.map(icon => new URL(icon.src, origin + base + 'manifest.webmanifest').pathname),
    ...files,
  ];
  for (const path of localPaths) {
    if (!path.startsWith(base)) throw new Error(`Asset escapes the publishing base: ${path}`);
    const file = resolve(directory, path.slice(base.length) || 'index.html');
    const rel = relative(directory, file);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Asset escapes the output directory.');
    await access(file);
  }
  for (const key of ['id', 'scope', 'start_url']) {
    if (new URL(manifest[key], origin + base + 'manifest.webmanifest').pathname !== base) throw new Error(`Manifest ${key} does not match the publishing base.`);
  }
  return metadata;
}

export async function buildSite(options = {}) {
  const settings = await readPublishing(options);
  const check = spawnSync(process.execPath, [resolve(projectRoot, 'node_modules/typescript/bin/tsc'), '-b'], { cwd: projectRoot, stdio: 'inherit' });
  if (check.status !== 0) throw new Error('TypeScript check failed.');
  const { build } = await import('vite');
  await build({ root: projectRoot, base: settings.basePath });
  await writeFile(resolve(projectRoot, 'dist/publishing.json'), JSON.stringify(settings, null, 2) + '\n');
  await writeFile(resolve(projectRoot, 'dist/.nojekyll'), '');
  await verifySite();
  return settings;
}
