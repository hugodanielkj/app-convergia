/**
 * Sugere variações de uma pesquisa (sinônimos, hashtags) com a IA (✅ RN-111). Devolve só
 * texto de busca: nunca vídeos, links ou métricas.
 */
export interface QueryExpander {
	expand(
		meta: { companyId: string },
		query: string,
		max: number,
	): Promise<string[]>;
}
