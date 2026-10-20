import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { getSafeTestDatabaseEnvironment } from './helpers/testDatabaseEnvironment.js';

const { databaseUrl, directUrl } = getSafeTestDatabaseEnvironment();
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = directUrl;
process.env.JWT_SECRET = 'wastebank-test-only-jwt-secret-not-for-production';
// Never let credentials loaded from a developer's .env send test fixtures to
// Supabase Storage. Local files live in an isolated temporary directory and
// are removed after each test file.
process.env.SUPABASE_STORAGE_REMOTE = 'false';
const testStorageRoot = path.resolve(os.tmpdir(), `wastebank-backend-tests-${process.pid}`);
process.env.STORAGE_LOCAL_ROOT = testStorageRoot;

afterAll(async () => {
  await fs.rm(testStorageRoot, { recursive: true, force: true });
});
