import { defineConfig } from 'vitest/config';

// Integration tests use a dedicated PostgreSQL database/schema configured by
// TEST_DATABASE_URL. They stay sequential because each test resets shared rows.
export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setupEnv.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
