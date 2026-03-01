import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  banner: {
    js: '// Ignore SIGPIPE to prevent crash when running as background process\nprocess.on("SIGPIPE", () => {});',
  },
});
