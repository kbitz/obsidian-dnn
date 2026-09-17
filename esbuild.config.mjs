import { build, context } from 'esbuild';

export const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian'],
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  outfile: 'main.js',
  logLevel: 'info',
  sourcemap: false,
  minify: true,
  metafile: true,
};

if (process.argv.includes('--watch')) {
  const ctx = await context({ ...options, minify: false, sourcemap: 'inline' });
  await ctx.watch();
} else if (process.argv[1]?.endsWith('esbuild.config.mjs')) {
  await build(options);
}
