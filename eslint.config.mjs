import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
  { ignores: ['main.js', 'dist/**', 'node_modules/**', 'docs/**'] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: { parserOptions: { projectService: true } },
  },
  {
    files: ['tests/**', '*.config.ts', '*.mjs', 'scripts/**'],
    rules: Object.fromEntries(Object.keys(obsidianmd.rules).map(key => [`obsidianmd/${key}`, 'off'])),
  },
  // Test-only Moment deliberately matches the host; production must import from Obsidian.
  { files: ['package.json'], rules: { 'depend/ban-dependencies': ['error', { allowed: ['moment'] }] } },
  { files: ['tests/**'], rules: { '@typescript-eslint/no-restricted-imports': 'off' } },
  { files: ['scripts/measure.mjs'], rules: { '@typescript-eslint/no-restricted-imports': 'off' } },
];
