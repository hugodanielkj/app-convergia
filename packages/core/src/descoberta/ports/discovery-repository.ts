import type { QueryResult } from "../ranking";
import type {
	CatalogVideo,
	CollectedVideo,
	MetricObservation,
	SearchPeriod,
	VideoMetrics,
	VideoPlatform,
} from "../video";
import type { ProviderErrorKind } from "./video-provider";

export type QueryStatus = "queued" | "running" | "ready" | "failed";

/** Como foi a coleta em cada plataforma (✅ RN-119: falha em uma não esconde a outra). */
export type PlatformOutcome = {
	status: "ok" | "partial" | "failed";
	count: number;
	error: ProviderErrorKind | null;
};

/**
 * Pesquisa normalizada e o cache dela (✅ RN-114). É compartilhada: duas empresas que pesquisam
 * a mesma coisa reaproveitam a mesma coleta de dados públicos. Quem pesquisou fica em
 * `SearchRequest`, isolado por empresa.
 */
export type VideoQuery = {
	id: string;
	cacheKey: string;
	queryText: string;
	platforms: VideoPlatform[];
	period: SearchPeriod;
	status: QueryStatus;
	progress: { done: number; total: number } | null;
	platformOutcomes: Partial<Record<VideoPlatform, PlatformOutcome>>;
	terms: string[];
	/** Empresa que disparou a coleta atual: paga a chamada de IA em `ai_call_log`. */
	requestedByCompanyId: string;
	/** Fim da última coleta que deu certo. `null` se nenhuma deu certo ainda. */
	completedAt: Date | null;
	startedAt: Date | null;
	error: string | null;
	createdAt: Date;
	updatedAt: Date;
};

/** Como a pesquisa foi atendida, para medir acertos de cache (✅ RN-118). */
export type CacheStatus =
	| "hit"
	| "stale"
	| "miss"
	| "joined"
	| "not_configured";

/** Uma pesquisa feita por alguém de uma empresa (RN-015). */
export type SearchRequest = {
	id: string;
	companyId: string;
	userId: string;
	queryId: string;
	cacheStatus: CacheStatus;
	/** Dia da cota reservada por esta pesquisa, até a coleta terminar (✅ RN-305). */
	quotaDay: string | null;
	createdAt: Date;
};

export type CompletedRun =
	| {
			status: "ready";
			terms: string[];
			platformOutcomes: VideoQuery["platformOutcomes"];
			results: { videoId: string; matchScore: number; providerRank: number }[];
			completedAt: Date;
	  }
	| {
			status: "failed";
			terms: string[];
			platformOutcomes: VideoQuery["platformOutcomes"];
			error: string;
	  };

export interface DiscoveryRepository {
	findQueryByKey(cacheKey: string): Promise<VideoQuery | null>;
	findQuery(id: string): Promise<VideoQuery | null>;
	/** Cria a pesquisa na fila. Se outra igual foi criada ao mesmo tempo, devolve a existente. */
	createQuery(query: {
		cacheKey: string;
		queryText: string;
		platforms: VideoPlatform[];
		period: SearchPeriod;
		requestedByCompanyId: string;
	}): Promise<{ query: VideoQuery; created: boolean }>;
	/**
	 * Põe de novo na fila uma pesquisa parada (pronta, com falha ou presa em andamento desde
	 * antes de `stuckBefore`). Devolve `false` se outra chamada já fez isso.
	 */
	requeue(
		id: string,
		requestedByCompanyId: string,
		stuckBefore: Date,
	): Promise<boolean>;
	/** Passa de `queued` para `running`. `null` se outro processo já pegou. */
	claimQuery(id: string, now: Date): Promise<VideoQuery | null>;
	updateProgress(
		id: string,
		progress: { done: number; total: number },
	): Promise<void>;
	/** Fecha a coleta. Se falhou, os resultados da coleta anterior continuam valendo. */
	completeQuery(id: string, run: CompletedRun): Promise<void>;

	/**
	 * Grava os vídeos pelo par plataforma + ID original (✅ RN-112). Campo que veio vazio não
	 * apaga o que já se sabia, e cada métrica nova vira uma leitura no histórico.
	 */
	upsertVideos(
		videos: CollectedVideo[],
		source: string,
		collectedAt: Date,
	): Promise<CatalogVideo[]>;
	recordMetrics(
		videoId: string,
		metrics: VideoMetrics,
		source: string,
		observedAt: Date,
	): Promise<CatalogVideo>;
	listResults(queryId: string): Promise<QueryResult[]>;
	listObservations(
		videoIds: string[],
		since: Date,
	): Promise<MetricObservation[]>;

	createRequest(request: {
		companyId: string;
		userId: string;
		queryId: string;
		cacheStatus: CacheStatus;
		quotaDay: string | null;
	}): Promise<SearchRequest>;
	findRequest(companyId: string, id: string): Promise<SearchRequest | null>;
	/** Pesquisas do usuário que pediram coleta nova desde `since` (✅ RN-118). */
	countCollections(
		companyId: string,
		userId: string,
		since: Date,
	): Promise<number>;
	/**
	 * Encerra as reservas de cota das pesquisas ligadas a esta coleta e devolve quem reservou,
	 * para a cota voltar se a coleta falhou (✅ RN-305).
	 */
	settleReservations(
		queryId: string,
	): Promise<{ companyId: string; userId: string; day: string }[]>;
}
