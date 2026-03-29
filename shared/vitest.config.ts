
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules']
    },
    // Red/Green TDD 友好配置
    reporters: ['verbose'],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      '@': '/shared',
    },
    // 源码旁遗留的 tsc 产物 *.js（CommonJS）会与 *.ts 并存；须先解析 .ts，否则 ESM 下报 exports is not defined
    extensions: ['.ts', '.mts', '.cts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
  },
});
