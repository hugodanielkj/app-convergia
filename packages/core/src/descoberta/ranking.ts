import type { DiscoverySettings } from "./settings";
import type {
	CatalogVideo,
	MetricObservation,
	SearchSort,
	VideoMetrics,
} from "./video";

/** Vídeo que passou no filtro de assunto de uma pesquisa. */
export type QueryResult = {
	video: CatalogVideo;
	matchScore: number;
	/** Posição em que o provedor devolveu o vídeo, só para desempate. */
	providerRank: number;
};

export type RankedVideo = CatalogVideo & {
	matchScore: number;
	/**
	 * Popularidade de 0 a 1 entre os resultados da MESMA plataforma (✅ RN-116). `null` quando
	 * o provedor não trouxe nenhuma métrica do vídeo.
	 */
	popularity: number | null;
	/** ✅ RN-117: só com duas leituras em momentos diferentes mostrando alta. */
	growing: boolean;
	score: number;
};

function engagement(metrics: VideoMetrics): number | null {
	const parts = [metrics.likes, metrics.comments, metrics.shares].filter(
		(value): value is number => value !== null,
	);
	return parts.length === 0 ? null : parts.reduce((sum, v) => sum + v, 0);
}

/** Posição média do valor entre os demais, de 0 a 1. Sozinho, fica no meio. */
function percentile(value: number, all: number[]): number {
	if (all.length < 2) return 0.5;
	const below = all.filter((other) => other < value).length;
	const equal = all.filter((other) => other === value).length;
	return (below + (equal - 1) / 2) / (all.length - 1);
}

/**
 * ✅ RN-116: popularidade calculada dentro de cada plataforma, para não comparar visualizações
 * do Instagram com as do TikTok. Junta o percentil das visualizações e o do engajamento,
 * usando só as métricas que existem.
 */
export function popularityByPlatform(
	videos: CatalogVideo[],
): Map<string, number | null> {
	const result = new Map<string, number | null>();
	const platforms = new Set(videos.map((video) => video.platform));
	for (const platform of platforms) {
		const group = videos.filter((video) => video.platform === platform);
		const views = group
			.map((video) => video.metrics.views)
			.filter((value): value is number => value !== null);
		const engagements = group
			.map((video) => engagement(video.metrics))
			.filter((value): value is number => value !== null);
		for (const video of group) {
			const parts: number[] = [];
			if (video.metrics.views !== null) {
				parts.push(percentile(video.metrics.views, views));
			}
			const own = engagement(video.metrics);
			if (own !== null) parts.push(percentile(own, engagements));
			result.set(
				video.id,
				parts.length === 0
					? null
					: parts.reduce((sum, v) => sum + v, 0) / parts.length,
			);
		}
	}
	return result;
}

/**
 * ✅ RN-117: "Em crescimento" exige pelo menos duas leituras com intervalo mínimo e alta real
 * entre a primeira e a última. Visualizações divididas pela idade do vídeo não contam.
 */
export function isGrowing(
	observations: MetricObservation[],
	growth: DiscoverySettings["growth"],
): boolean {
	if (observations.length < 2) return false;
	const sorted = [...observations].sort(
		(a, b) => a.observedAt.getTime() - b.observedAt.getTime(),
	);
	const first = sorted[0];
	const last = sorted.at(-1);
	if (!first || !last) return false;
	const gapHours =
		(last.observedAt.getTime() - first.observedAt.getTime()) / 3_600_000;
	if (gapHours < growth.minGapHours) return false;
	const metric: keyof VideoMetrics | null =
		first.views !== null && last.views !== null
			? "views"
			: first.likes !== null && last.likes !== null
				? "likes"
				: null;
	if (!metric) return false;
	const before = first[metric] ?? 0;
	const after = last[metric] ?? 0;
	return (
		after > before &&
		(after - before) / Math.max(before, 1) >= growth.minIncrease
	);
}

function recency(
	publishedAt: Date | null,
	now: Date,
	halfLifeDays: number,
): number {
	if (!publishedAt) return 0;
	const ageDays = Math.max(
		0,
		(now.getTime() - publishedAt.getTime()) / 86_400_000,
	);
	return 0.5 ** (ageDays / halfLifeDays);
}

const byDateDesc = (a: Date | null, b: Date | null) =>
	(b?.getTime() ?? Number.NEGATIVE_INFINITY) -
	(a?.getTime() ?? Number.NEGATIVE_INFINITY);

/**
 * ✅ RN-115: ordena os resultados relevantes. "relevance" combina assunto, recência e
 * popularidade com os pesos configurados; "popularity" e "recent" usam o critério pedido e
 * desempatam pela combinação.
 */
export function rankVideos(
	results: QueryResult[],
	options: {
		sort: SearchSort;
		now: Date;
		language: string | null;
		observations: Map<string, MetricObservation[]>;
		settings: DiscoverySettings;
	},
): RankedVideo[] {
	const { settings } = options;
	const popularity = popularityByPlatform(results.map((r) => r.video));
	const ranked = results.map((result) => {
		const pop = popularity.get(result.video.id) ?? null;
		const sameLanguage =
			options.language !== null &&
			result.video.language?.toLowerCase().startsWith(options.language);
		const score =
			settings.weights.match * result.matchScore +
			settings.weights.recency *
				recency(
					result.video.publishedAt,
					options.now,
					settings.recencyHalfLifeDays,
				) +
			settings.weights.popularity * (pop ?? 0) +
			(sameLanguage ? settings.languageBoost : 0);
		return {
			ranked: {
				...result.video,
				matchScore: result.matchScore,
				popularity: pop,
				growing: isGrowing(
					options.observations.get(result.video.id) ?? [],
					settings.growth,
				),
				score,
			},
			providerRank: result.providerRank,
		};
	});

	const compare = {
		relevance: () => 0,
		popularity: (a: RankedVideo, b: RankedVideo) =>
			(b.popularity ?? -1) - (a.popularity ?? -1),
		recent: (a: RankedVideo, b: RankedVideo) =>
			byDateDesc(a.publishedAt, b.publishedAt),
	}[options.sort];

	return ranked
		.sort(
			(a, b) =>
				compare(a.ranked, b.ranked) ||
				b.ranked.score - a.ranked.score ||
				a.providerRank - b.providerRank,
		)
		.map(({ ranked: video }) => video);
}
