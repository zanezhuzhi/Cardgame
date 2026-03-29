import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    /** 同目录下既有 .ts 又有 tsc 产物的 .js 时，优先源码 .ts，避免加载 CJS .js 与 shared 的 type:module 冲突 */
    extensions: ['.ts', '.tsx', '.mts', '.js', '.mjs', '.jsx', '.json'],
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
