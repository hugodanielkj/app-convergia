import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { LlmClient } from "./llm-gateway";

/** Modelo rápido do plano gratuito do Gemini (aistudio.google.com/docs/models). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * Gemini pela API do Google, só para testar em desenvolvimento sem gastar créditos (o plano
 * gratuito usa o conteúdo para melhorar os produtos do Google: nada de dado real de cliente).
 * Em produção a IA é o Claude (stack §4).
 */
export function createGeminiLlm(
	apiKey: string,
	model = DEFAULT_GEMINI_MODEL,
): LlmClient {
	const client = new GoogleGenAI({ apiKey });
	return {
		model,
		async complete(request) {
			const response = await client.models.generateContent({
				model,
				contents: request.messages.map((message) => ({
					role: message.role === "assistant" ? "model" : "user",
					parts: [{ text: message.content }],
				})),
				config: {
					systemInstruction: request.system,
					responseMimeType: "application/json",
					responseJsonSchema: z.toJSONSchema(request.schema),
				},
			});
			const text = response.text;
			if (!text) throw new Error("O Gemini não devolveu texto.");
			return {
				output: JSON.parse(text),
				inputTokens: response.usageMetadata?.promptTokenCount ?? null,
				outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
			};
		},
	};
}
