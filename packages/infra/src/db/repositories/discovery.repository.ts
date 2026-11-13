import type {
	CatalogVideo,
	CollectedVideo,
	DiscoveryRepository,
	MetricObservation,
	SearchRequest,
	VideoMetrics,
	VideoQuery,
} from "@convergia/core";
import { and, eq, gte, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
	discoveredVideos,
	type QuotaReservation,
	videoMetricObservations,
	videoQueries,
	videoQueryResults,
	videoSearchRequests,
} from "../schema";
import { withCompany } from "../with-company";

type VideoRow = typeof discoveredVideos.$inferSelect;
type QueryRow = typeof videoQueries.$inferSelect;
type RequestRow = typeof videoSearchRequests.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METRIC_KEYS = ["views", "likes", "comments", "shares"] as const;

function hasMetric(metrics: VideoMetrics): boolean {
	return METRIC_KEYS.some((key) => metrics[key] !== null);
}

function toVideo(row: VideoRow): CatalogVideo {
	return {
		id: row.id,
		platform: row.platform,
		externalId: row.externalId,
		url: row.url,
		caption: row.caption,
		creatorHandle: row.creatorHandle,
		creatorName: row.creatorName,
		thumbnailUrl: row.thumbnailUrl,
		publishedAt: row.publishedAt,
		durationSeconds: row.durationSeconds,
		language: row.language,
		metrics: {
			views: row.views,
			likes: row.likes,
			comments: row.comments,
			shares: row.shares,
		},
		source: row.source,
		firstCollectedAt: row.firstCollectedAt,
		lastCollectedAt: row.lastCollectedAt,
		metricsObservedAt: row.metricsObservedAt,
	};
}

function toQuery(row: QueryRow): VideoQuery {
	const { pendingReservations: _, ...query } = row;
	return query;
}

function toRequest(row: RequestRow): SearchRequest {
	return {
		...row,
		cacheStatus: row.cacheStatus as SearchRequest["cacheStatus"],
	};
}

/** Valor novo quando veio; senão, o que já estava gravado (✅ RN-112). */
const keep = (column: string) =>
	sql.raw(`coalesce(excluded."${column}", "discovered_videos"."${column}")`);

/** Pesquisa parada: pronta, com falha, ou na fila/em andamento há tempo demais. */
function idle(stuckBefore: Date): SQL | undefined {
	return or(
		inArray(videoQueries.status, ["ready", "failed"]),
		and(
			eq(videoQueries.status, "queued"),
			lt(videoQueries.updatedAt, stuckBefore),
		),
		and(
			eq(videoQueries.status, "running"),
			// Em SQL puro o driver não converte Date: vai como texto ISO.
			sql`coalesce(${videoQueries.startedAt}, ${videoQueries.updatedAt}) < ${stuckBefore.toISOString()}::timestamptz`,
		),
	);
}

export function createDiscoveryRepository(db: Db): DiscoveryRepository {
	return {
		async findQueryByKey(cacheKey) {
			const [row] = await db
				.select()
				.from(videoQueries)
				.where(eq(videoQueries.cacheKey, cacheKey))
				.limit(1);
			return row ? toQuery(row) : null;
		},

		async findQuery(id) {
			if (!UUID.test(id)) return null;
			const [row] = await db
				.select()
				.from(videoQueries)
				.where(eq(videoQueries.id, id))
				.limit(1);
			return row ? toQuery(row) : null;
		},

		async createQuery(input) {
			const [created] = await db
				.insert(videoQueries)
				.values(input)
				.onConflictDoNothing({ target: videoQueries.cacheKey })
				.returning();
			if (created) return { query: toQuery(created), created: true };
			// Outra pesquisa igual chegou primeiro: aproveita a dela.
			const [existing] = await db
				.select()
				.from(videoQueries)
				.where(eq(videoQueries.cacheKey, input.cacheKey));
			if (!existing) throw new Error("Pesquisa sumiu logo depois de criada.");
			return { query: toQuery(existing), created: false };
		},

		async requeue(id, requestedByCompanyId, stuckBefore) {
			const rows = await db
				.update(videoQueries)
				.set({
					status: "queued",
					progress: null,
					error: null,
					requestedByCompanyId,
					updatedAt: new Date(),
				})
				.where(and(eq(videoQueries.id, id), idle(stuckBefore)))
				.returning({ id: videoQueries.id });
			return rows.length > 0;
		},

		async claimQuery(id, now) {
			const [row] = await db
				.update(videoQueries)
				.set({ status: "running", startedAt: now, updatedAt: now })
				.where(and(eq(videoQueries.id, id), eq(videoQueries.status, "queued")))
				.returning();
			return row ? toQuery(row) : null;
		},

		async updateProgress(id, progress) {
			await db
				.update(videoQueries)
				.set({ progress, updatedAt: new Date() })
				.where(eq(videoQueries.id, id));
		},

		async completeQuery(id, run) {
			await db.transaction(async (tx) => {
				const base = {
					status: run.status,
					terms: run.terms,
					platformOutcomes: run.platformOutcomes,
					progress: null,
					updatedAt: new Date(),
				};
				if (run.status === "failed") {
					await tx
						.update(videoQueries)
						.set({ ...base, error: run.error })
						.where(eq(videoQueries.id, id));
					return;
				}
				await tx
					.update(videoQueries)
					.set({ ...base, error: null, completedAt: run.completedAt })
					.where(eq(videoQueries.id, id));
				await tx
					.delete(videoQueryResults)
					.where(eq(videoQueryResults.queryId, id));
				if (run.results.length > 0) {
					await tx
						.insert(videoQueryResults)
						.values(run.results.map((result) => ({ queryId: id, ...result })));
				}
			});
		},

		async upsertVideos(videos, source, collectedAt) {
			if (videos.length === 0) return [];
			return db.transaction(async (tx) => {
				const rows = await tx
					.insert(discoveredVideos)
					.values(
						videos.map((video: CollectedVideo) => ({
							platform: video.platform,
							externalId: video.externalId,
							url: video.url,
							caption: video.caption,
							creatorHandle: video.creatorHandle,
							creatorName: video.creatorName,
							thumbnailUrl: video.thumbnailUrl,
							publishedAt: video.publishedAt,
							durationSeconds: video.durationSeconds,
							language: video.language,
							...video.metrics,
							metricsObservedAt: hasMetric(video.metrics) ? collectedAt : null,
							source,
							firstCollectedAt: collectedAt,
							lastCollectedAt: collectedAt,
						})),
					)
					.onConflictDoUpdate({
						target: [discoveredVideos.platform, discoveredVideos.externalId],
						set: {
							url: sql`excluded.url`,
							caption: keep("caption"),
							creatorHandle: keep("creator_handle"),
							creatorName: keep("creator_name"),
							thumbnailUrl: keep("thumbnail_url"),
							publishedAt: keep("published_at"),
							durationSeconds: keep("duration_seconds"),
							language: keep("language"),
							views: keep("views"),
							likes: keep("likes"),
							comments: keep("comments"),
							shares: keep("shares"),
							metricsObservedAt: keep("metrics_observed_at"),
							source: sql`excluded.source`,
							lastCollectedAt: sql`excluded.last_collected_at`,
						},
					})
					.returning();
				const saved = rows.map(toVideo);
				const byKey = new Map(
					saved.map((v) => [`${v.platform}:${v.externalId}`, v]),
				);
				const observations = videos.flatMap((video) => {
					const savedVideo = byKey.get(`${video.platform}:${video.externalId}`);
					return savedVideo && hasMetric(video.metrics)
						? [
								{
									videoId: savedVideo.id,
									observedAt: collectedAt,
									source,
									...video.metrics,
								},
							]
						: [];
				});
				if (observations.length > 0) {
					await tx.insert(videoMetricObservations).values(observations);
				}
				return saved;
			});
		},

		async recordMetrics(videoId, metrics, source, observedAt) {
			return db.transaction(async (tx) => {
				if (hasMetric(metrics)) {
					const known = Object.fromEntries(
						METRIC_KEYS.filter((key) => metrics[key] !== null).map((key) => [
							key,
							metrics[key],
						]),
					);
					await tx
						.update(discoveredVideos)
						.set({ ...known, metricsObservedAt: observedAt, source })
						.where(eq(discoveredVideos.id, videoId));
					await tx
						.insert(videoMetricObservations)
						.values({ videoId, observedAt, source, ...metrics });
				}
				const [row] = await tx
					.select()
					.from(discoveredVideos)
					.where(eq(discoveredVideos.id, videoId));
				if (!row) throw new Error(`Vídeo ${videoId} não existe.`);
				return toVideo(row);
			});
		},

		async listResults(queryId) {
			const rows = await db
				.select({
					video: discoveredVideos,
					matchScore: videoQueryResults.matchScore,
					providerRank: videoQueryResults.providerRank,
				})
				.from(videoQueryResults)
				.innerJoin(
					discoveredVideos,
					eq(discoveredVideos.id, videoQueryResults.videoId),
				)
				.where(eq(videoQueryResults.queryId, queryId));
			return rows.map((row) => ({
				video: toVideo(row.video),
				matchScore: row.matchScore,
				providerRank: row.providerRank,
			}));
		},

		async listObservations(videoIds, since) {
			if (videoIds.length === 0) return [];
			const rows = await db
				.select()
				.from(videoMetricObservations)
				.where(
					and(
						inArray(videoMetricObservations.videoId, videoIds),
						gte(videoMetricObservations.observedAt, since),
					),
				);
			return rows.map(
				({ id: _, source: __, ...observation }): MetricObservation =>
					observation,
			);
		},

		createRequest(input) {
			return withCompany(db, input.companyId, async (tx) => {
				const [row] = await tx
					.insert(videoSearchRequests)
					.values(input)
					.returning();
				if (!row) throw new Error("A pesquisa não foi gravada.");
				if (input.quotaDay) {
					const reservation: QuotaReservation = {
						companyId: input.companyId,
						userId: input.userId,
						day: input.quotaDay,
					};
					await tx
						.update(videoQueries)
						.set({
							pendingReservations: sql`${videoQueries.pendingReservations} || ${JSON.stringify([reservation])}::jsonb`,
						})
						.where(eq(videoQueries.id, input.queryId));
				}
				return toRequest(row);
			});
		},

		async findRequest(companyId, id) {
			if (!UUID.test(id)) return null;
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.select()
					.from(videoSearchRequests)
					.where(
						and(
							eq(videoSearchRequests.companyId, companyId),
							eq(videoSearchRequests.id, id),
						),
					)
					.limit(1);
				return row ? toRequest(row) : null;
			});
		},

		countCollections(companyId, userId, since) {
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.select({ total: sql<number>`count(*)::int` })
					.from(videoSearchRequests)
					.where(
						and(
							eq(videoSearchRequests.companyId, companyId),
							eq(videoSearchRequests.userId, userId),
							inArray(videoSearchRequests.cacheStatus, ["miss", "stale"]),
							gte(videoSearchRequests.createdAt, since),
						),
					);
				return row?.total ?? 0;
			});
		},

		async settleReservations(queryId) {
			// Lê e zera numa só operação: cada reserva é devolvida ou consumida uma vez.
			const rows = await db.execute<{ reservations: QuotaReservation[] }>(sql`
				update video_queries as target
				set pending_reservations = '[]'::jsonb
				from (
					select id, pending_reservations
					from video_queries
					where id = ${queryId}
					for update
				) as previous
				where target.id = previous.id
				returning previous.pending_reservations as reservations
			`);
			return [...rows].flatMap((row) => row.reservations ?? []);
		},
	};
}
