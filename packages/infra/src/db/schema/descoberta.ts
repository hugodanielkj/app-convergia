import {
	type PlatformOutcome,
	type SearchPeriod,
	VIDEO_PLATFORMS,
	type VideoPlatform,
} from "@convergia/core";
import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./acesso";
import { companyIsolation } from "./company-scope";

const at = (name: string) => timestamp(name, { withTimezone: true });
const count = (name: string) => bigint(name, { mode: "number" });

export const videoPlatform = pgEnum("video_platform", VIDEO_PLATFORMS);

/**
 * ✅ RN-112: catálogo de vídeos públicos, compartilhado entre as empresas (não é dado de
 * nenhuma delas). Plataforma + ID original identificam o vídeo. Métrica ausente fica `null`.
 */
export const discoveredVideos = pgTable(
	"discovered_videos",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		platform: videoPlatform("platform").notNull(),
		externalId: text("external_id").notNull(),
		url: text("url").notNull(),
		caption: text("caption"),
		creatorHandle: text("creator_handle"),
		creatorName: text("creator_name"),
		thumbnailUrl: text("thumbnail_url"),
		publishedAt: at("published_at"),
		durationSeconds: real("duration_seconds"),
		language: text("language"),
		views: count("views"),
		likes: count("likes"),
		comments: count("comments"),
		shares: count("shares"),
		metricsObservedAt: at("metrics_observed_at"),
		source: text("source").notNull(),
		firstCollectedAt: at("first_collected_at").notNull(),
		lastCollectedAt: at("last_collected_at").notNull(),
	},
	(table) => [
		uniqueIndex("discovered_videos_platform_external_idx").on(
			table.platform,
			table.externalId,
		),
	],
);

/** ✅ RN-117: cada leitura das métricas, para saber se o vídeo cresceu entre duas leituras. */
export const videoMetricObservations = pgTable(
	"video_metric_observations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		videoId: uuid("video_id")
			.notNull()
			.references(() => discoveredVideos.id),
		observedAt: at("observed_at").notNull(),
		views: count("views"),
		likes: count("likes"),
		comments: count("comments"),
		shares: count("shares"),
		source: text("source").notNull(),
	},
	(table) => [
		index("video_metric_observations_video_idx").on(
			table.videoId,
			table.observedAt,
		),
	],
);

export const videoQueryStatus = pgEnum("video_query_status", [
	"queued",
	"running",
	"ready",
	"failed",
]);

export type QuotaReservation = {
	companyId: string;
	userId: string;
	day: string;
};

/**
 * ✅ RN-114: pesquisa normalizada e o cache dela, compartilhados entre as empresas. Quem
 * pesquisou fica em `video_search_requests`, isolado por empresa.
 */
export const videoQueries = pgTable("video_queries", {
	id: uuid("id").primaryKey().defaultRandom(),
	cacheKey: text("cache_key").notNull().unique(),
	queryText: text("query_text").notNull(),
	platforms: jsonb("platforms").$type<VideoPlatform[]>().notNull(),
	period: text("period").$type<SearchPeriod>().notNull(),
	status: videoQueryStatus("status").notNull().default("queued"),
	progress: jsonb("progress").$type<{ done: number; total: number }>(),
	platformOutcomes: jsonb("platform_outcomes")
		.$type<Partial<Record<VideoPlatform, PlatformOutcome>>>()
		.notNull()
		.default({}),
	terms: jsonb("terms").$type<string[]>().notNull().default([]),
	requestedByCompanyId: uuid("requested_by_company_id")
		.notNull()
		.references(() => companies.id),
	/**
	 * Cotas reservadas para a coleta atual, devolvidas se ela falhar (RN-305). Fica aqui, e não
	 * em cada pesquisa da empresa, porque a coleta roda sem empresa no contexto do RLS.
	 */
	pendingReservations: jsonb("pending_reservations")
		.$type<QuotaReservation[]>()
		.notNull()
		.default([]),
	completedAt: at("completed_at"),
	startedAt: at("started_at"),
	error: text("error"),
	createdAt: at("created_at").notNull().defaultNow(),
	updatedAt: at("updated_at").notNull().defaultNow(),
});

/** Vídeos que passaram no filtro de assunto da última coleta bem-sucedida. */
export const videoQueryResults = pgTable(
	"video_query_results",
	{
		queryId: uuid("query_id")
			.notNull()
			.references(() => videoQueries.id),
		videoId: uuid("video_id")
			.notNull()
			.references(() => discoveredVideos.id),
		matchScore: real("match_score").notNull(),
		providerRank: integer("provider_rank").notNull(),
	},
	(table) => [primaryKey({ columns: [table.queryId, table.videoId] })],
);

/** Cada pesquisa feita por alguém de uma empresa (RN-015), com o acerto de cache (RN-118). */
export const videoSearchRequests = pgTable(
	"video_search_requests",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		queryId: uuid("query_id")
			.notNull()
			.references(() => videoQueries.id),
		cacheStatus: text("cache_status").notNull(),
		quotaDay: text("quota_day"),
		createdAt: at("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("video_search_requests_user_idx").on(
			table.companyId,
			table.userId,
			table.createdAt,
		),
		companyIsolation(
			"video_search_requests_company_isolation",
			table.companyId,
		),
	],
).enableRLS();

/** ✅ RN-118: cada chamada ao provedor, para medir latência, erros e consumo. */
export const videoProviderCalls = pgTable(
	"video_provider_calls",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		provider: text("provider").notNull(),
		platform: videoPlatform("platform").notNull(),
		operation: text("operation").notNull(),
		durationMs: integer("duration_ms").notNull(),
		attempts: integer("attempts").notNull(),
		success: boolean("success").notNull(),
		errorKind: text("error_kind"),
		credits: integer("credits"),
		createdAt: at("created_at").notNull().defaultNow(),
	},
	(table) => [index("video_provider_calls_created_idx").on(table.createdAt)],
);
