import { z } from "zod";

/** ✅ RN-110: a descoberta busca vídeos curtos no Instagram (Reels) e no TikTok. */
export const VIDEO_PLATFORMS = ["instagram", "tiktok"] as const;
export type VideoPlatform = (typeof VIDEO_PLATFORMS)[number];

/** Filtro de período da pesquisa (✅ RN-113). */
export const SEARCH_PERIODS = ["7d", "30d", "any"] as const;
export type SearchPeriod = (typeof SEARCH_PERIODS)[number];

/** Ordenação dos resultados (✅ RN-115). */
export const SEARCH_SORTS = ["relevance", "popularity", "recent"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const PLATFORM_FILTERS = ["all", ...VIDEO_PLATFORMS] as const;
export type PlatformFilter = (typeof PLATFORM_FILTERS)[number];

/** Rótulo da lista na primeira versão (✅ RN-116). */
export const POPULAR_LABEL = "Populares sobre este assunto";

/**
 * Métricas públicas que o provedor devolveu. Campo que o provedor não trouxe fica `null`,
 * nunca zero (✅ RN-112).
 */
export type VideoMetrics = {
	views: number | null;
	likes: number | null;
	comments: number | null;
	shares: number | null;
};

/** Vídeo como o provedor devolveu, já normalizado. Só dados reais, nunca inventados (RN-111). */
export type CollectedVideo = {
	platform: VideoPlatform;
	/** ID original na plataforma: `aweme_id` no TikTok, shortcode no Instagram. */
	externalId: string;
	url: string;
	caption: string | null;
	creatorHandle: string | null;
	creatorName: string | null;
	thumbnailUrl: string | null;
	publishedAt: Date | null;
	durationSeconds: number | null;
	/** Idioma da legenda, quando o provedor informa. Não diz de que país é o vídeo. */
	language: string | null;
	metrics: VideoMetrics;
};

/** Vídeo no catálogo, com a origem e o horário da coleta (✅ RN-112). */
export type CatalogVideo = CollectedVideo & {
	id: string;
	source: string;
	firstCollectedAt: Date;
	lastCollectedAt: Date;
	metricsObservedAt: Date | null;
};

/** Uma leitura das métricas num momento, para saber se o vídeo está crescendo (✅ RN-117). */
export type MetricObservation = VideoMetrics & {
	videoId: string;
	observedAt: Date;
};

const MAX_QUERY_LENGTH = 200;

/** Pedido de pesquisa. Validado nas bordas: API do app e MCP. */
export const videoSearchInput = z.object({
	query: z
		.string()
		.trim()
		.min(2)
		.max(MAX_QUERY_LENGTH)
		.describe(
			'O assunto em linguagem natural, ex.: "como criar vídeos com IA"',
		),
	platform: z
		.enum(PLATFORM_FILTERS)
		.default("all")
		.describe("all, instagram ou tiktok"),
	period: z
		.enum(SEARCH_PERIODS)
		.default("30d")
		.describe("Publicados nos últimos 7d, 30d ou em qualquer data (any)"),
	sort: z
		.enum(SEARCH_SORTS)
		.default("relevance")
		.describe("relevance, popularity ou recent"),
});
export type VideoSearchInput = z.infer<typeof videoSearchInput>;

/** Resultados de uma pesquisa já feita, na ordenação escolhida. */
export const videoSearchPageInput = z.object({
	sort: z.enum(SEARCH_SORTS).default("relevance"),
});

export function platformsFor(filter: PlatformFilter): VideoPlatform[] {
	return filter === "all" ? [...VIDEO_PLATFORMS] : [filter];
}
