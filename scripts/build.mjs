import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { options } from '../esbuild.config.mjs';

const version = (await readFile('VERSION', 'utf8')).trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('VERSION must contain x.y.z');
for (const path of ['package.json', 'manifest.json']) {
  const data = JSON.parse(await readFile(path, 'utf8'));
  if (data.version !== version) throw new Error(`${path} must match VERSION (${version})`);
}
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { stdio: 'inherit' });
const result = await build(options);
const forbidden = Object.keys(result.metafile.inputs).filter(path => /(?:node_modules\/moment\/|tests\/)/.test(path));
if (forbidden.length) throw new Error(`Development code bundled: ${forbidden.join(', ')}`);
