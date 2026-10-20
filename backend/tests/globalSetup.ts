import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSafeTestDatabaseEnvironment } from './helpers/testDatabaseEnvironment.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default function setup() {
  const { databaseUrl, directUrl } = getSafeTestDatabaseEnvironment();
  // Only the migrate child gets the test URLs. Writing them into process.env
  // here would leak into the test workers, whose setupEnv then sees
  // TEST_DATABASE_URL === DATABASE_URL and refuses to run.
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    DIRECT_URL: directUrl,
    JWT_SECRET: 'wastebank-test-only-jwt-secret-not-for-production',
    SUPABASE_STORAGE_REMOTE: 'false',
  };
  const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: backendRoot, env, stdio: 'inherit' });
}
