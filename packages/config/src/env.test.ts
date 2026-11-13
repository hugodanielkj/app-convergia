import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const DATABASE_URL = "postgres://user:secret-password@localhost:5432/db";

describe("loadEnv", () => {
	it("aplica os valores padrão", () => {
		expect(loadEnv({ DATABASE_URL })).toEqual({
			NODE_ENV: "development",
			PORT: 3000,
			DATABASE_URL,
			VIDEO_SEARCH_CACHE_TTL_HOURS: 6,
			VIDEO_SEARCH_DAILY_LIMIT_PER_USER: 20,
			VIDEO_SEARCH_PER_MINUTE_LIMIT: 5,
			VIDEO_SEARCH_MAX_CALLS: 8,
			VIDEO_SEARCH_METRIC_REFRESH: 5,
			VIDEO_SEARCH_TIMEOUT_MS: 20_000,
			VIDEO_SEARCH_AI_EXPANSION: true,
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

describe("descoberta de vídeos (RN-114, RN-118)", () => {
	const DATABASE_URL = "postgres://u:p@localhost:5432/db";

	it("usa os padrões quando as variáveis estão vazias ou ausentes", () => {
		const env = loadEnv({
			DATABASE_URL,
			VIDEO_SEARCH_CACHE_TTL_HOURS: "",
			VIDEO_SEARCH_AI_EXPANSION: "",
		});
		expect(env.SCRAPECREATORS_API_KEY).toBeUndefined();
		expect(env).toMatchObject({
			VIDEO_SEARCH_CACHE_TTL_HOURS: 6,
			VIDEO_SEARCH_DAILY_LIMIT_PER_USER: 20,
			VIDEO_SEARCH_PER_MINUTE_LIMIT: 5,
			VIDEO_SEARCH_MAX_CALLS: 8,
			VIDEO_SEARCH_METRIC_REFRESH: 5,
			VIDEO_SEARCH_TIMEOUT_MS: 20_000,
			VIDEO_SEARCH_AI_EXPANSION: true,
		});
	});

	it("aceita valores configurados e recusa limites fora da faixa", () => {
		expect(
			loadEnv({
				DATABASE_URL,
				VIDEO_SEARCH_CACHE_TTL_HOURS: "12",
				VIDEO_SEARCH_AI_EXPANSION: "false",
			}),
		).toMatchObject({
			VIDEO_SEARCH_CACHE_TTL_HOURS: 12,
			VIDEO_SEARCH_AI_EXPANSION: false,
		});
		expect(() =>
			loadEnv({ DATABASE_URL, VIDEO_SEARCH_MAX_CALLS: "0" }),
		).toThrow(/VIDEO_SEARCH_MAX_CALLS/);
	});
});
