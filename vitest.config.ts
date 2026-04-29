import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
