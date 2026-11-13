/**
 * Limites e pesos da descoberta de vídeos. Os valores padrão valem para o protótipo; o servidor
 * troca os principais pelas variáveis de ambiente (ver `.env.example`).
 */
export type DiscoverySettings = {
	/** Validade do cache de uma pesquisa (✅ RN-114). */
	cacheTtlHours: number;
	/** Pesquisas que coletam dados novos, por usuário e por dia (✅ RN-118). */
	dailySearchesPerUser: number;
	/** Pesquisas que coletam dados novos, por usuário e por minuto (✅ RN-118). */
	searchesPerMinutePerUser: number;
	/** Termos por pesquisa, contando a frase original (✅ RN-111). */
	maxTerms: number;
	/** Páginas do provedor por termo e plataforma. */
	maxPagesPerTerm: number;
	/** Vídeos guardados por plataforma em cada pesquisa. */
	maxResultsPerPlatform: number;
	/** Chamadas ao provedor por pesquisa, somando busca e métricas. */
	maxCallsPerSearch: number;
	/** Vídeos do Instagram cujas visualizações são buscadas uma a uma, por pesquisa. */
	metricRefreshesPerSearch: number;
	/** Usar a IA para sugerir variações da pesquisa (✅ RN-111). */
	aiExpansion: boolean;
	/** Tempo máximo da sugestão de variações; depois disso, segue só com a frase original. */
	aiExpansionTimeoutMs: number;
	/** Fração mínima das palavras da pesquisa que precisa aparecer na legenda (✅ RN-115). */
	minMatchScore: number;
	/** Pesos da ordenação por relevância (✅ RN-115). */
	weights: { match: number; recency: number; popularity: number };
	/** Bônus para vídeos no idioma da pesquisa (✅ RN-113). */
	languageBoost: number;
	/** Meia-vida da recência, em dias. */
	recencyHalfLifeDays: number;
	/** Coleta "em andamento" há mais que isso é considerada perdida e pode recomeçar. */
	stuckAfterMinutes: number;
	/** ✅ RN-117: intervalo mínimo entre duas leituras e alta mínima para "Em crescimento". */
	growth: { minGapHours: number; minIncrease: number };
	/** Resultados por página na tela (✅ RN-119). */
	pageSize: number;
};

export const DEFAULT_DISCOVERY_SETTINGS: DiscoverySettings = {
	cacheTtlHours: 6,
	dailySearchesPerUser: 20,
	searchesPerMinutePerUser: 5,
	maxTerms: 3,
	maxPagesPerTerm: 2,
	maxResultsPerPlatform: 40,
	maxCallsPerSearch: 8,
	metricRefreshesPerSearch: 5,
	aiExpansion: true,
	aiExpansionTimeoutMs: 15_000,
	minMatchScore: 0.34,
	weights: { match: 0.5, recency: 0.2, popularity: 0.3 },
	languageBoost: 0.05,
	recencyHalfLifeDays: 14,
	stuckAfterMinutes: 10,
	growth: { minGapHours: 6, minIncrease: 0.1 },
	pageSize: 20,
};
