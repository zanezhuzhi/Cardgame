
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
      '@': '/shared'
    }
  }
});
