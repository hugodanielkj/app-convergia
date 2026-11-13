import { describe, expect, it } from "vitest";
import {
	cacheKey,
	cleanQuery,
	keywords,
	matchScore,
	normalizeQuery,
	queryLanguage,
	STRATEGY_VERSION,
} from "./query";

describe("pesquisa normalizada (RN-113, RN-114)", () => {
	it("tira espaços sobrando sem mudar o que a pessoa escreveu", () => {
		expect(cleanQuery("  como   criar vídeos  com AI ")).toBe(
			"como criar vídeos com AI",
		);
	});

	it("RN-114: a chave ignora acento, maiúscula e espaço, e muda com filtros e versão", () => {
		const base = {
			platforms: ["tiktok", "instagram"] as const,
			period: "30d" as const,
		};
		const a = cacheKey({
			...base,
			platforms: [...base.platforms],
			query: "Como criar  VÍDEOS com AI",
		});
		const b = cacheKey({
			...base,
			platforms: ["instagram", "tiktok"],
			query: "como criar videos com ai",
		});
		expect(a).toBe(b);
		expect(a).toContain(`v${STRATEGY_VERSION}|`);
		expect(
			cacheKey({ query: "x y", platforms: ["tiktok"], period: "30d" }),
		).not.toBe(cacheKey({ query: "x y", platforms: ["tiktok"], period: "7d" }));
		expect(normalizeQuery("Vídeos")).toBe("videos");
	});

	it("RN-113: reconhece pesquisa em português pelo acento ou pelas palavras", () => {
		expect(queryLanguage("como criar vídeos com AI")).toBe("pt");
		expect(queryLanguage("receita de bolo para iniciantes")).toBe("pt");
		expect(queryLanguage("how to make videos with AI")).toBeNull();
	});
});

describe("relação com o assunto (RN-115)", () => {
	it("usa só as palavras que carregam o assunto", () => {
		expect(keywords("como criar vídeos com AI")).toEqual([
			"criar",
			"videos",
			"ai",
		]);
	});

	it("conta as palavras da pesquisa presentes na legenda, com plural e IA/AI", () => {
		const terms = ["como criar vídeos com AI"];
		expect(
			matchScore("Criando vídeo com IA em 5 minutos #ia #video", terms),
		).toBeCloseTo(1);
		expect(matchScore("Meu vídeo de viagem", terms)).toBeCloseTo(1 / 3);
		expect(matchScore("Receita de bolo", terms)).toBe(0);
	});

	it("vale a melhor variação, e legenda vazia não casa com nada", () => {
		expect(
			matchScore("tutorial #inteligenciaartificial", [
				"como criar vídeos com AI",
				"inteligencia artificial tutorial",
			]),
		).toBeCloseTo(2 / 3);
		expect(matchScore(null, ["qualquer coisa"])).toBe(0);
	});
});
