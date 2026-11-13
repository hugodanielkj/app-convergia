import type { LlmClient, LlmRequest } from "./llm-gateway";

/**
 * IA simulada, só para desenvolvimento local sem `ANTHROPIC_API_KEY`: devolve um roteiro de
 * exemplo sem chamar nenhuma API paga. Nunca é usada em produção (ver `apps/server/src/main.ts`).
 */
export function createFakeLlm(): LlmClient {
	return {
		model: "simulado-local",
		async complete<T>(request: LlmRequest<T>) {
			const brief = request.messages[0]?.content ?? "";
			const title = /Título: (.+)/.exec(brief)?.[1] ?? "o seu post";
			const script = {
				hook: `Você sabia que ${title.toLowerCase()} pode mudar o seu dia?`,
				body: `Mostre ${title.toLowerCase()} em três passos curtos, com um exemplo real em cada um.\n\n(Roteiro simulado: configure ANTHROPIC_API_KEY para usar a IA de verdade.)`,
				cta: "Salve este post para ver depois e mande para quem precisa.",
				caption: `${title} ✨\n\nConta nos comentários o que você achou!`,
			};
			if (request.task === "write_script") {
				return { output: script, inputTokens: null, outputTokens: null };
			}
			const ask = request.messages.at(-1)?.content ?? "";
			return {
				output: {
					reply: `Pronto, ajustei o roteiro: "${ask}". (Resposta simulada.)`,
					script: { ...script, hook: `${script.hook} (ajustado)` },
				},
				inputTokens: null,
				outputTokens: null,
			};
		},
	};
}
