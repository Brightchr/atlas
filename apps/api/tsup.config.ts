import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // Bundle every dependency into dist so the Docker runtime image needs no node_modules.
  noExternal: [/.*/],
});
