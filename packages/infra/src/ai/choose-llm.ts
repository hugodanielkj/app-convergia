import type { Env } from "@convergia/config";
import { createAnthropicLlm } from "./anthropic-llm";
import { createFakeLlm } from "./fake-llm";
import { createGeminiLlm } from "./gemini-llm";
import type { LlmClient } from "./llm-gateway";

type AiEnv = Pick<Env, "NODE_ENV"> &
	Partial<Pick<Env, "ANTHROPIC_API_KEY" | "GEMINI_API_KEY" | "GEMINI_MODEL">>;

/**
 * Qual IA o servidor usa. Claude quando há `ANTHROPIC_API_KEY` (sempre em produção, que exige
 * a chave). Fora de produção: Gemini gratuito se houver `GEMINI_API_KEY`; senão, a simulada.
 */
export function chooseLlm(env: AiEnv): LlmClient {
	if (env.ANTHROPIC_API_KEY) return createAnthropicLlm(env.ANTHROPIC_API_KEY);
	if (env.NODE_ENV === "production") {
		throw new Error("ANTHROPIC_API_KEY é obrigatória em produção.");
	}
	if (env.GEMINI_API_KEY) {
		return createGeminiLlm(env.GEMINI_API_KEY, env.GEMINI_MODEL);
	}
	return createFakeLlm();
}
