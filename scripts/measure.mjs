import { transform } from 'esbuild';
import moment from 'moment';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir, cpus, platform, arch } from 'node:os';
import { join } from 'node:path';

const source = await readFile(new URL('../src/daily-notes.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
// The only input is this repository's fixed TypeScript module, not user data.
// eslint-disable-next-line no-unsanitized/method -- Compile only the fixed local source module for this benchmark.
const { buildIndex, recognizer, neighbor } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const day = moment('1990-01-01');
const paths = Array.from({ length: 10_000 }, () => { const path = `Journal/${day.format('YYYY-MM-DD')}.md`; day.add(1, 'day'); return path; });
const recognize = recognizer({ folder: 'Journal', format: 'YYYY-MM-DD', locale: 'en' }, moment);
const samples = [];
let index;
for (let i = 0; i < 6; i++) {
  const start = performance.now();
  index = buildIndex(paths, recognize);
  samples.push(performance.now() - start);
}
const start = performance.now();
for (let i = 0; i < 10_000; i++) neighbor(index, index.dates[i], -1);
const output = { timestamp: new Date().toISOString(), node: process.version, os: `${platform()} ${arch()}`, cpu: cpus()[0]?.model, notes: index.dates.length, indexMs: samples, tenThousandNeighborLookupsMs: performance.now() - start };
const root = join(homedir(), 'scratch/obsidian-dnn');
await mkdir(root, { recursive: true });
await writeFile(join(root, 'performance.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
