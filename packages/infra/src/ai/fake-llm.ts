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
			if (request.task === "suggest_options") {
				return {
					output: {
						options: [1, 2, 3].map(
							(n) => `Opção ${n} simulada para ${title.toLowerCase()}`,
						),
					},
					inputTokens: null,
					outputTokens: null,
				};
			}
			if (request.task === "write_script") {
				return { output: script, inputTokens: null, outputTokens: null };
			}
			// O pedido vem antes da instrução de busca, que fica entre parênteses no fim.
			const ask = (request.messages.at(-1)?.content ?? "").split("\n\n(")[0];
			// 📎 RN-075: sem busca de verdade, uma página de exemplo faz o papel do resultado.
			const pages = request.webSearch
				? [
						{
							title: "Fonte simulada",
							url: "https://example.com/fonte-simulada",
						},
					]
				: [];
			return {
				output: {
					reply: `Pronto, ajustei o roteiro: "${ask}". (Resposta simulada.)`,
					script: { ...script, hook: `${script.hook} (ajustado)` },
					sources: pages,
				},
				inputTokens: null,
				outputTokens: null,
				webResults: pages,
			};
		},
	};
}
