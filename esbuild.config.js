const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'dist/chess-game.js',
    loader: {
      '.glb': 'binary',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.mp3': 'file'
    },
    assetNames: 'assets/[name]-[hash]',
    external: [],
    platform: 'browser',
    target: ['es2020'],
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production'
  })
  .catch(() => process.exit(1));
