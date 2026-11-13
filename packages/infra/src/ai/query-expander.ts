import type { QueryExpander } from "@convergia/core";
import { z } from "zod";
import type { LlmGateway } from "./llm-gateway";

/** Teto fixo: o modelo devolve no máximo isto, e o caso de uso ainda corta pelo limite pedido. */
const MAX_VARIATIONS = 3;

const variations = z.object({
	variations: z
		.array(z.string())
		.max(MAX_VARIATIONS)
		.describe("Variações curtas da pesquisa, para usar como termos de busca"),
});

// Fixo, para aproveitar o cache de prompt.
const SYSTEM = `Você ajuda a pesquisar vídeos curtos no Instagram Reels e no TikTok.
Receba uma pesquisa e devolva até 3 variações curtas que ajudem a encontrar vídeos sobre o MESMO assunto: sinônimos, a forma mais comum de dizer, ou uma hashtag (com #, sem espaços).
Regras:
- Mantenha a intenção e o idioma da pesquisa original.
- Não repita a pesquisa original.
- Devolva só termos de busca. Nunca cite vídeos, perfis, links, números ou métricas.
- Se a pesquisa já for clara e não houver variação útil, devolva uma lista vazia.`;

/** ✅ RN-111: variações da pesquisa pela IA, só como termos de busca. */
export function createQueryExpander(llm: LlmGateway): QueryExpander {
	return {
		async expand(meta, query, max) {
			const { output } = await llm(
				{ companyId: meta.companyId, tool: "discover_videos" },
				{
					task: "expand_query",
					system: SYSTEM,
					messages: [{ role: "user", content: `Pesquisa: ${query}` }],
					schema: variations,
				},
			);
			return output.variations.slice(0, Math.min(max, MAX_VARIATIONS));
		},
	};
}
