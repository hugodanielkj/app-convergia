import postgres from "postgres";

export type Db = postgres.Sql;

export function createDb(databaseUrl: string): Db {
	return postgres(databaseUrl, { onnotice: () => {} });
}
