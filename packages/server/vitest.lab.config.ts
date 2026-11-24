import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Laboratory tests: need Docker; not part of `pnpm test`.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { include: ['test-lab/**/*.e2e.test.ts'], environment: 'node', testTimeout: 60_000, hookTimeout: 300_000, fileParallelism: false },
});
