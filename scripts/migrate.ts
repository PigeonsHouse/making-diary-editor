import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://diary:diary@localhost:5432/diary";
  const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle");
  const client = postgres(databaseUrl, { max: 1, onnotice: () => undefined });

  try {
    await client`SELECT pg_advisory_lock(18473, 92641)`;
    await migrate(drizzle(client), { migrationsFolder });
    console.log("Database migrations completed.");
  } finally {
    await client`SELECT pg_advisory_unlock(18473, 92641)`.catch(() => undefined);
    await client.end();
  }
}

void main();
