import { loadEnv } from "@convergia/config";
import { runMigrations } from "./migrate";

/** Testes de integração rodam contra o schema atual: aplica as migrações antes. */
export default async function setup(): Promise<void> {
	await runMigrations(loadEnv().DATABASE_URL);
}
