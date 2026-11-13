import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Citation } from "@convergia/core";
import type { LlmClient } from "./llm-gateway";

/** stack §4: Claude Opus 5.5 para tudo, até medir a qualidade com exemplos reais. */
export const DEFAULT_MODEL = "claude-opus-5-5";

/** Buscas por refino: o bastante para checar um dado, sem estourar o custo da chamada. */
const MAX_WEB_SEARCHES = 5;
/**
 * Com ferramentas do servidor, a API pausa o turno (`pause_turn`) depois de muitas iterações;
 * reenviar a resposta retoma de onde parou. Limite para não ficar em laço.
 */
const MAX_RESUMES = 3;

/** Páginas que a busca devolveu ao modelo. Erro da busca não lança: vem como bloco. */
function webResults(content: Anthropic.Beta.BetaContentBlock[]): Citation[] {
	const pages: Citation[] = [];
	for (const block of content) {
		if (
			block.type !== "web_search_tool_result" ||
			!Array.isArray(block.content)
		) {
			continue;
		}
		for (const result of block.content) {
			pages.push({ title: result.title, url: result.url });
		}
	}
	return pages;
}

/** Claude pela API da Anthropic, com saída estruturada validada contra o schema. */
export function createAnthropicLlm(apiKey: string): LlmClient {
	const client = new Anthropic({ apiKey });
	return {
		model: DEFAULT_MODEL,
		async complete(request) {
			const messages: Anthropic.Beta.BetaMessageParam[] = [...request.messages];
			const pages: Citation[] = [];
			let inputTokens = 0;
			let outputTokens = 0;

			for (let resumes = 0; ; resumes++) {
				const response = await client.beta.messages.parse({
					model: DEFAULT_MODEL,
					max_tokens: 16_000,
					system: request.system,
					messages,
					// 📎 RN-075: busca na web do próprio servidor da Anthropic (stack §4).
					...(request.webSearch && {
						tools: [
							{
								type: "web_search_20260209",
								name: "web_search",
								max_uses: MAX_WEB_SEARCHES,
							},
						],
					}),
					output_config: {
						// Roteiro curto e criativo: o padrão do modelo basta.
						effort: "medium",
						format: betaZodOutputFormat(request.schema),
					},
					// Se o modelo recusar por engano, o próprio servidor tenta outro modelo.
					betas: ["server-side-fallback-2026-07-01"],
					fallbacks: "default",
				});
				inputTokens += response.usage.input_tokens;
				outputTokens += response.usage.output_tokens;
				pages.push(...webResults(response.content));

				if (response.stop_reason === "pause_turn") {
					if (resumes >= MAX_RESUMES) {
						throw new Error("A busca na web não terminou (pause_turn).");
					}
					messages.push({ role: "assistant", content: response.content });
					continue;
				}
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
					inputTokens,
					outputTokens,
					webResults: pages,
				};
			}
		},
	};
}
