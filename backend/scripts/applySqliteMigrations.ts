import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');

interface MigrationRow {
  migration_name: string;
}

function splitSqlStatements(sql: string): string[] {
  const withoutBom = sql.replace(/^\uFEFF/, '');
  const statements: string[] = [];
  let current = '';
  let quote: '"' | "'" | '`' | null = null;
  let lineComment = false;

  for (let index = 0; index < withoutBom.length; index += 1) {
    const char = withoutBom[index];
    const next = withoutBom[index + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
      }
      continue;
    }

    if (!quote && char === '-' && next === '-') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

async function ensureMigrationTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function appliedMigrationNames(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<MigrationRow[]>(
    'SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL',
  );
  return new Set(rows.map((row) => row.migration_name));
}

async function applyMigration(migrationName: string, sql: string) {
  const statements = splitSqlStatements(sql);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  const checksum = createHash('sha256').update(sql).digest('hex');
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, NULL, NULL, CURRENT_TIMESTAMP, ?)`,
    randomUUID(),
    checksum,
    migrationName,
    statements.length,
  );
}

async function main() {
  const datasourceUrl = process.env.DATABASE_URL ?? '';
  if (datasourceUrl && !datasourceUrl.startsWith('file:')) {
    throw new Error('db:migrate:sqlite only supports SQLite file: DATABASE_URL values');
  }

  await ensureMigrationTable();
  const applied = await appliedMigrationNames();
  const entries = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of entries) {
    if (applied.has(migrationName)) {
      console.log(`Skipping ${migrationName}`);
      continue;
    }

    const sqlPath = path.join(migrationsDir, migrationName, 'migration.sql');
    const sql = await readFile(sqlPath, 'utf8');
    console.log(`Applying ${migrationName}`);
    await applyMigration(migrationName, sql);
  }

  console.log('SQLite migrations applied');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
