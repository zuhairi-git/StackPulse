import { buildSite, verifySite } from './publishing.mjs';

const [command = 'build', ...args] = process.argv.slice(2);
const options = {};
try {
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--target': 'target', '--base': 'basePath', '--repository': 'repository' }[args[i]];
    if (!key || args[i + 1] === undefined) throw new Error('Usage: node scripts/publish.mjs build [--target name] [--base /path/] [--repository owner/repo] | verify');
    options[key] = args[i + 1];
  }
  const result = command === 'build' ? await buildSite(options) : command === 'verify' ? await verifySite() : (() => { throw new Error(`Unknown command: ${command}`); })();
  console.log(`StackPulse ${command === 'build' ? 'build' : 'artifact'} verified: target=${result.target}, base=${result.basePath}, output=dist/`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
