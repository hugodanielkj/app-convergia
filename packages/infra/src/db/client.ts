import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string) {
	return drizzle({
		client: postgres(databaseUrl, { onnotice: () => {} }),
		schema,
	});
}

export type Db = ReturnType<typeof createDb>;
