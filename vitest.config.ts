import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Integration tests run against a real local Postgres (TEST_DATABASE_URL), so
// row locking, unique constraints and concurrent updates behave as in production.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'server-only': resolve(__dirname, 'tests/support/empty.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/support/env.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
