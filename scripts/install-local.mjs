import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const vault = process.argv[2];
const configDir = process.argv[3] ?? '.obsidian';
if (!vault) throw new Error('Usage: npm run install:local -- /absolute/vault/path [config-dir]');
if (!(await stat(resolve(vault, configDir))).isDirectory()) throw new Error('Vault configuration directory missing');
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const target = resolve(vault, configDir, 'plugins', manifest.id);
await mkdir(target, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(resolve('dist', manifest.id, file), resolve(target, file));
console.log(`Installed local package at ${target}. Reload this plugin in Obsidian.`);
