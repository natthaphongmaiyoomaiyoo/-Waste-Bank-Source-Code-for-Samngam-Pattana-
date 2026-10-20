import 'dotenv/config';

const TEST_SCHEMA = 'wastebank_test';

function required(name: 'TEST_DATABASE_URL'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required; tests delete data and must never use the production database`);
  }
  return value;
}

function assertTestSchema(name: string, value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use the PostgreSQL protocol`);
  }
  if (parsed.searchParams.get('schema') !== TEST_SCHEMA) {
    throw new Error(`${name} must explicitly set schema=${TEST_SCHEMA}`);
  }
}

export function getSafeTestDatabaseEnvironment() {
  const databaseUrl = required('TEST_DATABASE_URL');
  const directUrl = process.env.TEST_DIRECT_URL ?? databaseUrl;

  assertTestSchema('TEST_DATABASE_URL', databaseUrl);
  assertTestSchema('TEST_DIRECT_URL', directUrl);

  if (process.env.DATABASE_URL && databaseUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
  }
  if (process.env.DIRECT_URL && directUrl === process.env.DIRECT_URL) {
    throw new Error('TEST_DIRECT_URL must differ from DIRECT_URL');
  }

  return { databaseUrl, directUrl };
}
