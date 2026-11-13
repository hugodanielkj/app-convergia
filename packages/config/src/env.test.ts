import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const DATABASE_URL = "postgres://user:secret-password@localhost:5432/db";

describe("loadEnv", () => {
	it("aplica os valores padrão", () => {
		expect(loadEnv({ DATABASE_URL })).toEqual({
			NODE_ENV: "development",
			PORT: 3000,
			DATABASE_URL,
		});
	});

	it("converte PORT para número", () => {
		expect(loadEnv({ DATABASE_URL, PORT: "8080" }).PORT).toBe(8080);
	});

	it("falha citando a variável ausente", () => {
		expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
	});

	it("recusa URL de banco que não é Postgres", () => {
		expect(() => loadEnv({ DATABASE_URL: "mysql://localhost/db" })).toThrow(
			/DATABASE_URL/,
		);
	});

	it("não vaza valores na mensagem de erro", () => {
		expect(() => loadEnv({ DATABASE_URL, PORT: "secret-password" })).toThrow(
			expect.not.stringContaining("secret-password"),
		);
	});

	it("exige ANTHROPIC_API_KEY só em produção", () => {
		expect(loadEnv({ DATABASE_URL }).ANTHROPIC_API_KEY).toBeUndefined();
		expect(
			loadEnv({ DATABASE_URL, ANTHROPIC_API_KEY: "" }).ANTHROPIC_API_KEY,
		).toBeUndefined();
		expect(() => loadEnv({ DATABASE_URL, NODE_ENV: "production" })).toThrow(
			/ANTHROPIC_API_KEY/,
		);
		expect(
			loadEnv({ DATABASE_URL, NODE_ENV: "production", ANTHROPIC_API_KEY: "k" })
				.ANTHROPIC_API_KEY,
		).toBe("k");
	});
});
