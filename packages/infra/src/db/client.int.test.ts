import { loadEnv } from "@convergia/config";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "./client";

describe("conexão com o Postgres", () => {
	const db = createDb(loadEnv().DATABASE_URL);

	afterAll(async () => {
		await db.end();
	});

	it("executa uma consulta", async () => {
		const rows = await db`select 1 as ok`;

		expect(rows[0]?.ok).toBe(1);
	});
});
