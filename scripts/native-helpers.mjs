// Shared by native-smoke.mjs and native-scenarios.mjs. Fixture-only: never point at a personal vault.
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const root = join(homedir(), 'scratch/obsidian-dnn');
export const vault = join(root, 'DNN Fixture');

export function cli(...args) {
  const output = execFileSync('/usr/local/bin/obsidian', ['vault=DNN Fixture', ...args], { encoding: 'utf8', timeout: 30_000 }).trim();
  if (/^Error:/m.test(output)) throw new Error(output);
  return output;
}

export async function hashes(dir = vault) {
  const data = {};
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) Object.assign(data, await hashes(path));
    else if (item.name.endsWith('.md')) data[path.slice(vault.length + 1)] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  return data;
}
