import type {
	PlatformOutcome,
	VideoQuery,
} from "../ports/discovery-repository";
import { VideoProviderError } from "../ports/video-provider";
import {
	cleanQuery,
	matchScore,
	normalizeQuery,
	queryLanguage,
} from "../query";
import type {
	CatalogVideo,
	CollectedVideo,
	SearchPeriod,
	VideoPlatform,
} from "../video";
import type { DiscoveryDeps } from "./deps";
import { releaseReservations } from "./discover-videos";

const PERIOD_DAYS: Record<SearchPeriod, number | null> = {
	"7d": 7,
	"30d": 30,
	any: null,
};

/**
 * ✅ RN-111: a frase original e até `maxTerms - 1` variações sugeridas pela IA. Se a IA falhar
 * ou demorar, segue só com a frase original.
 */
async function searchTerms(
	deps: DiscoveryDeps,
	query: VideoQuery,
): Promise<string[]> {
	const settings = deps.discoverySettings;
	const terms = [query.queryText];
	if (!settings.aiExpansion || !deps.queryExpander || settings.maxTerms < 2) {
		return terms;
	}
	let suggestions: string[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		suggestions = await Promise.race([
			deps.queryExpander.expand(
				{ companyId: query.requestedByCompanyId },
				query.queryText,
				settings.maxTerms - 1,
			),
			new Promise<string[]>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error("Sugestão de termos demorou demais.")),
					settings.aiExpansionTimeoutMs,
				);
			}),
		]);
	} catch (error) {
		console.warn("Seguindo só com a frase original da pesquisa", error);
	} finally {
		clearTimeout(timer);
	}
	const seen = new Set(terms.map(normalizeQuery));
	for (const suggestion of suggestions) {
		const term = cleanQuery(suggestion);
		if (terms.length >= settings.maxTerms) break;
		if (
			term.length < 2 ||
			term.length > 100 ||
			seen.has(normalizeQuery(term))
		) {
			continue;
		}
		seen.add(normalizeQuery(term));
		terms.push(term);
	}
	return terms;
}

function withinPeriod(
	video: CollectedVideo,
	period: SearchPeriod,
	now: Date,
): boolean {
	const days = PERIOD_DAYS[period];
	if (days === null) return true;
	// Sem data não dá para saber se está no período pedido.
	if (!video.publishedAt) return false;
	return now.getTime() - video.publishedAt.getTime() <= days * 86_400_000;
}

/**
 * Coleta de uma pesquisa, rodada pela fila (design §8.3). Pesquisa cada plataforma, junta e
 * tira repetidos, filtra pelo assunto e grava no catálogo. Uma plataforma que falha não
 * derruba a outra (✅ RN-119).
 */
export async function runVideoQuery(
	deps: DiscoveryDeps,
	queryId: string,
): Promise<void> {
	const settings = deps.discoverySettings;
	const query = await deps.discovery.claimQuery(queryId, deps.now());
	if (!query) return;

	const terms = await searchTerms(deps, query);
	const language = queryLanguage(query.queryText);
	const outcomes: Partial<Record<VideoPlatform, PlatformOutcome>> = {};
	const collected: { video: CollectedVideo; rank: number }[] = [];
	const total = query.platforms.length * terms.length;
	let calls = 0;
	let done = 0;

	try {
		for (const platform of query.platforms) {
			let count = 0;
			try {
				for (const term of terms) {
					let cursor: string | null = null;
					for (let page = 0; page < settings.maxPagesPerTerm; page++) {
						if (
							calls >= settings.maxCallsPerSearch ||
							count >= settings.maxResultsPerPlatform
						) {
							break;
						}
						calls++;
						const result = await deps.videoProvider.search({
							platform,
							term,
							period: query.period,
							cursor,
							language,
						});
						for (const video of result.videos) {
							collected.push({ video, rank: collected.length });
							count++;
						}
						cursor = result.nextCursor;
						if (!cursor) break;
					}
					done++;
					await deps.discovery.updateProgress(query.id, { done, total });
				}
				outcomes[platform] = { status: "ok", count, error: null };
			} catch (error) {
				if (!(error instanceof VideoProviderError)) throw error;
				console.warn(`Busca de vídeos falhou no ${platform}: ${error.kind}`);
				outcomes[platform] = {
					status: count > 0 ? "partial" : "failed",
					count,
					error: error.kind,
				};
			}
		}

		const succeeded = Object.values(outcomes).some(
			(outcome) => outcome.status !== "failed",
		);
		if (!succeeded) {
			await deps.discovery.completeQuery(query.id, {
				status: "failed",
				terms,
				platformOutcomes: outcomes,
				error: "Nenhuma plataforma respondeu.",
			});
			await releaseReservations(deps, query.id);
			return;
		}

		// ✅ RN-112: plataforma + ID original identificam o vídeo; fica a primeira aparição.
		const now = deps.now();
		const unique = new Map<string, { video: CollectedVideo; rank: number }>();
		for (const item of collected) {
			const key = `${item.video.platform}:${item.video.externalId}`;
			if (!unique.has(key)) unique.set(key, item);
		}
		// ✅ RN-115: primeiro o assunto, pelo texto disponível; depois o período.
		const relevant = [...unique.values()]
			.map((item) => ({
				...item,
				score: matchScore(item.video.caption, terms),
			}))
			.filter(
				(item) =>
					item.score >= settings.minMatchScore &&
					withinPeriod(item.video, query.period, now),
			);

		const saved = await deps.discovery.upsertVideos(
			relevant.map((item) => item.video),
			deps.videoProvider.name,
			now,
		);
		const byKey = new Map(
			saved.map((video) => [`${video.platform}:${video.externalId}`, video]),
		);
		const results = relevant.flatMap((item) => {
			const video = byKey.get(
				`${item.video.platform}:${item.video.externalId}`,
			);
			return video
				? [{ video, matchScore: item.score, providerRank: item.rank }]
				: [];
		});

		await refreshMissingViews(
			deps,
			[...results]
				.sort((a, b) => b.matchScore - a.matchScore)
				.map((result) => result.video),
			settings.maxCallsPerSearch - calls,
		);

		await deps.discovery.completeQuery(query.id, {
			status: "ready",
			terms,
			platformOutcomes: outcomes,
			results: results.map((result) => ({
				videoId: result.video.id,
				matchScore: result.matchScore,
				providerRank: result.providerRank,
			})),
			completedAt: deps.now(),
		});
		// A coleta deu certo: as reservas viram uso.
		await deps.discovery.settleReservations(query.id);
	} catch (error) {
		await deps.discovery.completeQuery(query.id, {
			status: "failed",
			terms,
			platformOutcomes: outcomes,
			error: error instanceof Error ? error.message : String(error),
		});
		await releaseReservations(deps, query.id);
		throw error;
	}
}

/**
 * A busca de Reels não traz visualizações. Para os vídeos mais relevantes sem esse dado, pede
 * as métricas uma a uma, dentro do orçamento de chamadas (✅ RN-118). Falha aqui não derruba a
 * pesquisa: o campo continua vazio.
 */
async function refreshMissingViews(
	deps: DiscoveryDeps,
	videos: CatalogVideo[],
	budget: number,
): Promise<void> {
	const limit = Math.min(
		budget,
		deps.discoverySettings.metricRefreshesPerSearch,
	);
	const missing = videos
		.filter((video) => video.metrics.views === null)
		.slice(0, Math.max(0, limit));
	for (const video of missing) {
		try {
			const metrics = await deps.videoProvider.fetchMetrics(video.platform, {
				externalId: video.externalId,
				url: video.url,
			});
			await deps.discovery.recordMetrics(
				video.id,
				metrics,
				deps.videoProvider.name,
				deps.now(),
			);
		} catch (error) {
			if (!(error instanceof VideoProviderError)) throw error;
			if (error.kind === "out_of_credits" || error.kind === "unauthorized")
				return;
		}
	}
}
