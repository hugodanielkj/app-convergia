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

/** Executa no máximo `max` tarefas ao mesmo tempo; as outras esperam a vez. */
function limiter(max: number) {
	let active = 0;
	const waiting: (() => void)[] = [];
	return async <T>(task: () => Promise<T>): Promise<T> => {
		while (active >= max) {
			await new Promise<void>((resolve) => waiting.push(resolve));
		}
		active++;
		try {
			return await task();
		} finally {
			active--;
			waiting.shift()?.();
		}
	};
}

/** Posição de um vídeo na coleta: termo, plataforma, página e lugar na página. */
type Collected = { video: CollectedVideo; order: number[] };

function byOrder(a: Collected, b: Collected): number {
	for (let i = 0; i < a.order.length; i++) {
		const diff = (a.order[i] ?? 0) - (b.order[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

/**
 * Coleta de uma pesquisa, rodada pela fila (design §8.3). Pesquisa cada plataforma e termo ao
 * mesmo tempo (a frase original já começa enquanto a IA sugere variações), junta e tira
 * repetidos, filtra pelo assunto e grava no catálogo. Uma plataforma que falha não derruba a
 * outra (✅ RN-119).
 */
export async function runVideoQuery(
	deps: DiscoveryDeps,
	queryId: string,
): Promise<void> {
	const settings = deps.discoverySettings;
	const query = await deps.discovery.claimQuery(queryId, deps.now());
	if (!query) return;

	const language = queryLanguage(query.queryText);
	const run = limiter(Math.max(1, settings.parallelCalls));
	const outcomes: Partial<Record<VideoPlatform, PlatformOutcome>> = {};
	const perPlatform = new Map(
		query.platforms.map((platform) => [
			platform,
			{ count: 0, error: null as VideoProviderError["kind"] | null },
		]),
	);
	const collected: Collected[] = [];
	let terms = [query.queryText];
	let calls = 0;
	let done = 0;
	let total =
		query.platforms.length * (settings.aiExpansion ? settings.maxTerms : 1);

	const searchTerm = async (
		platform: VideoPlatform,
		term: string,
		termIndex: number,
	): Promise<void> => {
		const own = perPlatform.get(platform);
		if (!own) return;
		let cursor: string | null = null;
		try {
			for (let page = 0; page < settings.maxPagesPerTerm; page++) {
				if (
					calls >= settings.maxCallsPerSearch ||
					own.count >= settings.maxResultsPerPlatform
				) {
					break;
				}
				calls++;
				const result = await run(() =>
					deps.videoProvider.search({
						platform,
						term,
						period: query.period,
						cursor,
						language,
					}),
				);
				const platformIndex = query.platforms.indexOf(platform);
				result.videos.forEach((video, position) => {
					collected.push({
						video,
						order: [termIndex, platformIndex, page, position],
					});
				});
				own.count += result.videos.length;
				cursor = result.nextCursor;
				if (!cursor) break;
			}
		} catch (error) {
			if (!(error instanceof VideoProviderError)) throw error;
			console.warn(`Busca de vídeos falhou no ${platform}: ${error.kind}`);
			own.error ??= error.kind;
		} finally {
			done++;
			await deps.discovery.updateProgress(query.id, {
				done,
				total: Math.max(total, done),
			});
		}
	};

	try {
		// A frase original não espera a IA; as variações entram assim que chegam.
		const original = query.platforms.map((platform) =>
			searchTerm(platform, query.queryText, 0),
		);
		terms = await searchTerms(deps, query);
		total = query.platforms.length * terms.length;
		const variations = terms
			.slice(1)
			.flatMap((term, index) =>
				query.platforms.map((platform) =>
					searchTerm(platform, term, index + 1),
				),
			);
		const settled = await Promise.allSettled([...original, ...variations]);
		const unexpected = settled.find((item) => item.status === "rejected");
		if (unexpected?.status === "rejected") throw unexpected.reason;

		for (const [platform, { count, error }] of perPlatform) {
			outcomes[platform] = error
				? { status: count > 0 ? "partial" : "failed", count, error }
				: { status: "ok", count, error: null };
		}
		collected.sort(byOrder);

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
		for (const [rank, { video }] of collected.entries()) {
			const key = `${video.platform}:${video.externalId}`;
			if (!unique.has(key)) unique.set(key, { video, rank });
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
 * as métricas ao mesmo tempo, dentro do orçamento de chamadas (✅ RN-118). Falha aqui não
 * derruba a pesquisa: o campo continua vazio.
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
	const run = limiter(Math.max(1, deps.discoverySettings.parallelCalls));
	// Sem crédito ou sem acesso, as próximas também falhariam.
	let stop = false;
	await Promise.all(
		missing.map((video) =>
			run(async () => {
				if (stop) return;
				try {
					const metrics = await deps.videoProvider.fetchMetrics(
						video.platform,
						{ externalId: video.externalId, url: video.url },
					);
					await deps.discovery.recordMetrics(
						video.id,
						metrics,
						deps.videoProvider.name,
						deps.now(),
					);
				} catch (error) {
					if (!(error instanceof VideoProviderError)) throw error;
					if (error.kind === "out_of_credits" || error.kind === "unauthorized")
						stop = true;
				}
			}),
		),
	);
}
