import { defineConfig } from "drizzle-kit";

// Só gera migrações a partir do schema. Aplicar é com `pnpm db:migrate`, que lê a URL de packages/config.
export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema/index.ts",
	out: "./src/db/migrations",
});
