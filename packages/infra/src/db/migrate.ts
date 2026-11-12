import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";

const migrationsFolder = fileURLToPath(
	new URL("./migrations", import.meta.url),
);

/** Aplica as migrações pendentes. Só no banco local; outros ambientes exigem permissão. */
export async function runMigrations(databaseUrl: string): Promise<void> {
	const db = createDb(databaseUrl);
	try {
		await migrate(db, { migrationsFolder });
	} finally {
		await db.$client.end();
	}
}
