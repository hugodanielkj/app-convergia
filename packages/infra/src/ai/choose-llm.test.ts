import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL } from "./anthropic-llm";
import { chooseLlm } from "./choose-llm";
import { DEFAULT_GEMINI_MODEL } from "./gemini-llm";

describe("escolha da IA", () => {
	const dev = { NODE_ENV: "development" as const };

	it("usa o Claude quando há ANTHROPIC_API_KEY", () => {
		expect(
			chooseLlm({ ...dev, ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" }).model,
		).toBe(DEFAULT_MODEL);
	});

	it("em desenvolvimento, usa o Gemini gratuito quando só há GEMINI_API_KEY", () => {
		expect(chooseLlm({ ...dev, GEMINI_API_KEY: "g" }).model).toBe(
			DEFAULT_GEMINI_MODEL,
		);
		expect(
			chooseLlm({ ...dev, GEMINI_API_KEY: "g", GEMINI_MODEL: "outro" }).model,
		).toBe("outro");
	});

	it("sem chave nenhuma, usa a IA simulada", () => {
		expect(chooseLlm(dev).model).toBe("simulado-local");
	});

	it("em produção, nunca usa Gemini nem a simulada", () => {
		expect(() =>
			chooseLlm({ NODE_ENV: "production", GEMINI_API_KEY: "g" }),
		).toThrow("ANTHROPIC_API_KEY é obrigatória em produção.");
	});
});
