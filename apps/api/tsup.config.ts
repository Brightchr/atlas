import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // Workspace code (@arcadia/shared) is bundled; npm dependencies stay external
  // and are installed in the runtime image — required for native modules like
  // @node-rs/argon2, which cannot be bundled.
  noExternal: ['@arcadia/shared'],
});
