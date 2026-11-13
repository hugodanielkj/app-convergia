import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { LlmClient } from "./llm-gateway";

/** stack §4: Claude Opus 5.5 para tudo, até medir a qualidade com exemplos reais. */
export const DEFAULT_MODEL = "claude-opus-5-5";

/** Claude pela API da Anthropic, com saída estruturada validada contra o schema. */
export function createAnthropicLlm(apiKey: string): LlmClient {
	const client = new Anthropic({ apiKey });
	return {
		model: DEFAULT_MODEL,
		async complete(request) {
			const response = await client.beta.messages.parse({
				model: DEFAULT_MODEL,
				max_tokens: 16_000,
				system: request.system,
				messages: request.messages,
				output_config: {
					// Roteiro curto e criativo: o padrão do modelo basta.
					effort: "medium",
					format: betaZodOutputFormat(request.schema),
				},
				// Se o modelo recusar por engano, o próprio servidor tenta outro modelo.
				betas: ["server-side-fallback-2026-07-01"],
				fallbacks: "default",
			});
			if (response.stop_reason === "refusal") {
				throw new Error(
					`O modelo recusou a tarefa (${response.stop_details?.category ?? "sem categoria"}).`,
				);
			}
			if (response.stop_reason === "max_tokens") {
				throw new Error("A resposta do modelo foi cortada (max_tokens).");
			}
			return {
				output: response.parsed_output,
				inputTokens: response.usage.input_tokens,
				outputTokens: response.usage.output_tokens,
			};
		},
	};
}
