import { mkdtemp, readdir, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSite, projectRoot } from './publishing.mjs';

function run(command, args, cwd = projectRoot, allowFailure = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0 && !allowFailure) throw new Error(`${command} failed: ${result.stderr || result.error?.message || result.stdout}`);
  return result;
}

// Explicit manual publisher for environments where custom Actions cannot run.
// Only the dedicated gh-pages branch contains generated files; main stays source-only.
export async function publishPagesBranch() {
  const config = JSON.parse(await readFile(join(projectRoot, 'publishing.config.json'), 'utf8'));
  const repository = config.targets['github-pages'].repository;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Configure the GitHub repository before publishing.');
  const remote = `https://github.com/${repository}.git`;
  run('gh', ['api', `repos/${repository}`, '--jq', '.full_name']);
  const pages = run('gh', ['api', `repos/${repository}/pages`], projectRoot, true);
  const cname = pages.status === 0 ? JSON.parse(pages.stdout).cname : null;
  await buildSite({ target: 'github-pages', ...(cname ? { basePath: '/' } : {}) });
  const directory = await mkdtemp(join(tmpdir(), 'stackpulse-pages-'));
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Temporary checkout escaped the temporary directory.');
  try {
    const checkout = join(directory, 'site');
    const exists = run('git', ['ls-remote', '--exit-code', '--heads', remote, 'gh-pages'], projectRoot, true);
    if (exists.status !== 0 && exists.status !== 2) throw new Error('Could not inspect the remote Pages branch.');
    if (exists.status === 0) {
      run('git', ['clone', '--depth', '1', '--branch', 'gh-pages', remote, checkout]);
      // Refuse to overwrite an unrelated branch that was not created by this publisher.
      const prior = JSON.parse(await readFile(join(checkout, 'publishing.json'), 'utf8'));
      if (prior.target !== 'github-pages') throw new Error('Existing gh-pages branch is not a StackPulse Pages artifact.');
      for (const entry of await readdir(checkout)) {
        if (entry !== '.git') await rm(join(checkout, entry), { recursive: true, force: true });
      }
    } else {
      run('git', ['init', '--initial-branch=gh-pages', checkout]);
      run('git', ['remote', 'add', 'origin', remote], checkout);
    }
    await cp(join(projectRoot, 'dist'), checkout, { recursive: true });
    if (cname) await writeFile(join(checkout, 'CNAME'), cname + '\n');
    for (const key of ['user.name', 'user.email']) {
      const identity = run('git', ['config', key], projectRoot, true).stdout.trim();
      if (identity) run('git', ['config', key, identity], checkout);
    }
    run('git', ['add', '--all'], checkout);
    if (run('git', ['status', '--porcelain'], checkout).stdout.trim()) {
      run('git', ['commit', '-m', 'Publish verified StackPulse production artifact'], checkout);
      run('git', ['push', 'origin', 'gh-pages'], checkout);
    }
    run('gh', ['api', '--method', 'PUT', `repos/${repository}/pages`, '-f', 'build_type=legacy', '-f', 'source[branch]=gh-pages', '-f', 'source[path]=/']);
    run('gh', ['api', '--method', 'POST', `repos/${repository}/pages/builds`]);
    console.log(`Production artifact pushed. Pages build requested for ${repository}; check GitHub's deployment result before claiming it is live.`);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

try { await publishPagesBranch(); } catch (error) { console.error(error.message); process.exitCode = 1; }
