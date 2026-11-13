import type {
	CacheStatus,
	CompletedRun,
	DiscoveryRepository,
	SearchRequest,
	VideoQuery,
} from "../ports/discovery-repository";
import type { QueryResult } from "../ranking";
import type {
	CatalogVideo,
	CollectedVideo,
	MetricObservation,
	SearchPeriod,
	VideoMetrics,
	VideoPlatform,
} from "../video";

const METRIC_KEYS = ["views", "likes", "comments", "shares"] as const;

function hasMetric(metrics: VideoMetrics): boolean {
	return METRIC_KEYS.some((key) => metrics[key] !== null);
}

/** Dublê do catálogo e do cache de pesquisas para testes unitários. */
export class InMemoryDiscoveryRepository implements DiscoveryRepository {
	readonly queries: VideoQuery[] = [];
	readonly videos: CatalogVideo[] = [];
	readonly observations: MetricObservation[] = [];
	readonly requests: SearchRequest[] = [];
	readonly results = new Map<
		string,
		{ videoId: string; matchScore: number; providerRank: number }[]
	>();
	private sequence = 0;

	constructor(private readonly now: () => Date = () => new Date()) {}

	private id(prefix: string): string {
		this.sequence += 1;
		return `${prefix}-${this.sequence}`;
	}

	async findQueryByKey(cacheKey: string): Promise<VideoQuery | null> {
		const query = this.queries.find((q) => q.cacheKey === cacheKey);
		return query ? structuredClone(query) : null;
	}

	async findQuery(id: string): Promise<VideoQuery | null> {
		const query = this.queries.find((q) => q.id === id);
		return query ? structuredClone(query) : null;
	}

	async createQuery(input: {
		cacheKey: string;
		queryText: string;
		platforms: VideoPlatform[];
		period: SearchPeriod;
		requestedByCompanyId: string;
	}): Promise<{ query: VideoQuery; created: boolean }> {
		const existing = this.queries.find((q) => q.cacheKey === input.cacheKey);
		if (existing) return { query: structuredClone(existing), created: false };
		const now = this.now();
		const query: VideoQuery = {
			id: this.id("query"),
			...input,
			status: "queued",
			progress: null,
			platformOutcomes: {},
			terms: [],
			completedAt: null,
			startedAt: null,
			error: null,
			createdAt: now,
			updatedAt: now,
		};
		this.queries.push(query);
		return { query: structuredClone(query), created: true };
	}

	async requeue(
		id: string,
		requestedByCompanyId: string,
		stuckBefore: Date,
	): Promise<boolean> {
		const query = this.queries.find((q) => q.id === id);
		if (!query) return false;
		const active =
			(query.status === "queued" || query.status === "running") &&
			(query.status === "running"
				? (query.startedAt ?? query.updatedAt)
				: query.updatedAt
			).getTime() >= stuckBefore.getTime();
		if (active) return false;
		Object.assign(query, {
			status: "queued",
			progress: null,
			requestedByCompanyId,
			error: null,
			updatedAt: this.now(),
		});
		return true;
	}

	async claimQuery(id: string, now: Date): Promise<VideoQuery | null> {
		const query = this.queries.find((q) => q.id === id);
		if (query?.status !== "queued") return null;
		Object.assign(query, { status: "running", startedAt: now, updatedAt: now });
		return structuredClone(query);
	}

	async updateProgress(
		id: string,
		progress: { done: number; total: number },
	): Promise<void> {
		const query = this.queries.find((q) => q.id === id);
		if (query) Object.assign(query, { progress, updatedAt: this.now() });
	}

	async completeQuery(id: string, run: CompletedRun): Promise<void> {
		const query = this.queries.find((q) => q.id === id);
		if (!query) return;
		Object.assign(query, {
			status: run.status,
			terms: run.terms,
			platformOutcomes: run.platformOutcomes,
			progress: null,
			updatedAt: this.now(),
			error: run.status === "failed" ? run.error : null,
		});
		if (run.status === "ready") {
			query.completedAt = run.completedAt;
			this.results.set(id, run.results);
		}
	}

	async upsertVideos(
		videos: CollectedVideo[],
		source: string,
		collectedAt: Date,
	): Promise<CatalogVideo[]> {
		return videos.map((incoming) => {
			let video = this.videos.find(
				(v) =>
					v.platform === incoming.platform &&
					v.externalId === incoming.externalId,
			);
			if (!video) {
				video = {
					...structuredClone(incoming),
					id: this.id("video"),
					source,
					firstCollectedAt: collectedAt,
					lastCollectedAt: collectedAt,
					metricsObservedAt: hasMetric(incoming.metrics) ? collectedAt : null,
				};
				this.videos.push(video);
			} else {
				for (const key of [
					"url",
					"caption",
					"creatorHandle",
					"creatorName",
					"thumbnailUrl",
					"publishedAt",
					"durationSeconds",
					"language",
				] as const) {
					if (incoming[key] !== null)
						Object.assign(video, { [key]: incoming[key] });
				}
				for (const key of METRIC_KEYS) {
					if (incoming.metrics[key] !== null)
						video.metrics[key] = incoming.metrics[key];
				}
				video.source = source;
				video.lastCollectedAt = collectedAt;
				if (hasMetric(incoming.metrics)) video.metricsObservedAt = collectedAt;
			}
			if (hasMetric(incoming.metrics)) {
				this.observations.push({
					videoId: video.id,
					observedAt: collectedAt,
					...incoming.metrics,
				});
			}
			return structuredClone(video);
		});
	}

	async recordMetrics(
		videoId: string,
		metrics: VideoMetrics,
		source: string,
		observedAt: Date,
	): Promise<CatalogVideo> {
		const video = this.videos.find((v) => v.id === videoId);
		if (!video) throw new Error(`Vídeo ${videoId} não existe.`);
		for (const key of METRIC_KEYS) {
			if (metrics[key] !== null) video.metrics[key] = metrics[key];
		}
		if (hasMetric(metrics)) {
			video.metricsObservedAt = observedAt;
			video.source = source;
			this.observations.push({ videoId, observedAt, ...metrics });
		}
		return structuredClone(video);
	}

	async listResults(queryId: string): Promise<QueryResult[]> {
		return (this.results.get(queryId) ?? []).flatMap((result) => {
			const video = this.videos.find((v) => v.id === result.videoId);
			return video
				? [
						{
							video: structuredClone(video),
							matchScore: result.matchScore,
							providerRank: result.providerRank,
						},
					]
				: [];
		});
	}

	async listObservations(
		videoIds: string[],
		since: Date,
	): Promise<MetricObservation[]> {
		return this.observations
			.filter((o) => videoIds.includes(o.videoId) && o.observedAt >= since)
			.map((o) => structuredClone(o));
	}

	async createRequest(input: {
		companyId: string;
		userId: string;
		queryId: string;
		cacheStatus: CacheStatus;
		quotaDay: string | null;
	}): Promise<SearchRequest> {
		const request = { id: this.id("request"), ...input, createdAt: this.now() };
		this.requests.push(request);
		return structuredClone(request);
	}

	async findRequest(
		companyId: string,
		id: string,
	): Promise<SearchRequest | null> {
		const request = this.requests.find(
			(r) => r.companyId === companyId && r.id === id,
		);
		return request ? structuredClone(request) : null;
	}

	async countCollections(
		companyId: string,
		userId: string,
		since: Date,
	): Promise<number> {
		return this.requests.filter(
			(r) =>
				r.companyId === companyId &&
				r.userId === userId &&
				(r.cacheStatus === "miss" || r.cacheStatus === "stale") &&
				r.createdAt >= since,
		).length;
	}

	async settleReservations(
		queryId: string,
	): Promise<{ companyId: string; userId: string; day: string }[]> {
		const settled: { companyId: string; userId: string; day: string }[] = [];
		for (const request of this.requests) {
			if (request.queryId === queryId && request.quotaDay) {
				settled.push({
					companyId: request.companyId,
					userId: request.userId,
					day: request.quotaDay,
				});
				request.quotaDay = null;
			}
		}
		return settled;
	}
}
