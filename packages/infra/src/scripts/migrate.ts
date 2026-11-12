import { loadEnv } from "@convergia/config";
import { runMigrations } from "../db/migrate";

await runMigrations(loadEnv().DATABASE_URL);
console.log("Migrações aplicadas.");
