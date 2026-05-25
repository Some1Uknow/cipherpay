import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(appRoot, ".env.local") });
dotenv.config({ path: path.join(appRoot, ".env") });

const migrationArg = process.argv[2];
if (!migrationArg) {
  console.error("Usage: node scripts/apply-db-migration.mjs <migration.sql>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Put it in web/.env.local or export it before running this script.");
  process.exit(1);
}

const migrationPath = path.resolve(appRoot, migrationArg);
const migrationName = path.relative(appRoot, migrationPath);
const sql = await readFile(migrationPath, "utf8");
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const existing = await client.query("select 1 from schema_migrations where name = $1", [migrationName]);
  if (existing.rowCount && existing.rowCount > 0) {
    await client.query("commit");
    console.log(`Already applied: ${migrationName}`);
    process.exit(0);
  }

  await client.query(sql);
  await client.query("insert into schema_migrations (name) values ($1)", [migrationName]);
  await client.query("commit");
  console.log(`Applied: ${migrationName}`);
} catch (error) {
  await client.query("rollback");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
