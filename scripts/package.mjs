import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const target = resolve('dist', manifest.id);
await mkdir(target, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(file, resolve(target, file));
console.log(`Package: ${target}`);
