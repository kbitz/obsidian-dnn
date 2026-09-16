import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

const root = resolve(process.argv[2] ?? `${homedir()}/scratch/obsidian-dnn/DNN Fixture`);
try {
  await access(root);
  throw new Error(`Fixture already exists; refusing to overwrite: ${root}`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const files = {
  '.obsidian/core-plugins.json': JSON.stringify(['file-explorer', 'global-search', 'switcher', 'command-palette', 'daily-notes']),
  '.obsidian/daily-notes.json': JSON.stringify({ folder: 'Journal', format: 'YYYY-MM-DD' }),
  '.obsidian/community-plugins.json': JSON.stringify(['daily-note-navigation']),
  'Journal/2020-02-29.md': '# Leap day\n\nThe blue notebook is on the top shelf.\n',
  'Journal/2024-02-28.md': '# Before leap day\n',
  'Journal/2024-02-29.md': '# Leap day\n',
  'Journal/2024-03-02.md': '# After a missing day\n',
  'Journal/2026-09-14.md': '# Monday\n',
  'Journal/2026-09-16.md': '# Wednesday\n',
  'Journal/2026-09-18.md': '# Friday\n',
  'Journal/2026-02-30.md': '# Invalid date\n',
  'Journal Archive/2026-09-15.md': '# Outside configured folder\n',
  'Ordinary.md': '# Ordinary note\n\nKeep the normal breadcrumb.\n',
  '2026-09-15.md': '# Date outside the configured folder\n',
};
const today = new Date();
const todayKey = [String(today.getFullYear()).padStart(4, '0'), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
files[`Journal/${todayKey}.md`] ??= '# Today\n\nExisting note for the Today command test.\n';
for (const [path, text] of Object.entries(files)) {
  const dest = resolve(root, path);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, text);
}
console.log(root);
