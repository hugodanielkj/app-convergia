import { NOT_CONFIGURED_MESSAGE, platformFailureMessage } from "../errors";
import type { SearchRequest, VideoQuery } from "../ports/discovery-repository";
import { queryLanguage } from "../query";
import { type RankedVideo, rankVideos } from "../ranking";
import {
	POPULAR_LABEL,
	type SearchPeriod,
	type SearchSort,
	type VideoPlatform,
} from "../video";
import type { DiscoveryDeps } from "./deps";

export type SearchStatus =
	| "not_configured"
	| "collecting"
	| "refreshing"
	| "ready"
	| "failed";

export type PlatformStatus = {
	platform: VideoPlatform;
	status: "pending" | "ok" | "failed";
	message: string | null;
};

/** O que a tela e o MCP mostram de uma pesquisa (✅ RN-119). */
export type VideoSearchView = {
	requestId: string | null;
	query: string;
	platforms: VideoPlatform[];
	period: SearchPeriod;
	sort: SearchSort;
	status: SearchStatus;
	/** Aviso geral, quando há um (integração não configurada, coleta falhou). */
	message: string | null;
	progress: { done: number; total: number } | null;
	/** Fim da coleta que gerou os resultados mostrados. */
	updatedAt: Date | null;
	/** Os resultados vêm de uma atualização anterior, mais velha que a validade do cache. */
	stale: boolean;
	platformStatus: PlatformStatus[];
	label: string;
	/** ✅ RN-119: só os mais bem colocados na ordenação escolhida. */
	results: RankedVideo[];
	/** Quantos vídeos sobre o assunto a coleta encontrou, antes do corte. */
	total: number;
};

const OBSERVATION_WINDOW_MS = 7 * 86_400_000;

/** Na fila ou coletando, e não parada há mais que o limite (processo que caiu no meio). */
export function inProgress(
	query: VideoQuery,
	now: Date,
	stuckAfterMinutes: number,
): boolean {
	if (query.status !== "queued" && query.status !== "running") return false;
	const since =
		query.status === "running"
			? (query.startedAt ?? query.updatedAt)
			: query.updatedAt;
	return now.getTime() - since.getTime() < stuckAfterMinutes * 60_000;
}

export function isFresh(
	query: VideoQuery,
	now: Date,
	ttlHours: number,
): boolean {
	return (
		query.completedAt !== null &&
		now.getTime() - query.completedAt.getTime() < ttlHours * 3_600_000
	);
}

function statusOf(
	query: VideoQuery,
	running: boolean,
	configured: boolean,
): SearchStatus {
	if (running) return query.completedAt ? "refreshing" : "collecting";
	if (query.completedAt) return "ready";
	if (!configured) return "not_configured";
	return query.status === "failed" ? "failed" : "collecting";
}

function platformStatus(query: VideoQuery, running: boolean): PlatformStatus[] {
	return query.platforms.map((platform) => {
		const outcome = query.platformOutcomes[platform];
		if (!outcome) {
			return { platform, status: running ? "pending" : "ok", message: null };
		}
		if (outcome.status === "failed") {
			return {
				platform,
				status: "failed",
				message: platformFailureMessage(platform, outcome.error),
			};
		}
		return { platform, status: "ok", message: null };
	});
}

/** Monta a resposta de uma pesquisa, com os resultados já ordenados e paginados. */
export async function buildView(
	deps: DiscoveryDeps,
	request: SearchRequest | null,
	query: VideoQuery,
	page: { sort: SearchSort },
): Promise<VideoSearchView> {
	const settings = deps.discoverySettings;
	const now = deps.now();
	const running = inProgress(query, now, settings.stuckAfterMinutes);
	const status = statusOf(query, running, deps.videoProvider.configured);

	const results = query.completedAt
		? await deps.discovery.listResults(query.id)
		: [];
	const observations = new Map<
		string,
		Awaited<ReturnType<DiscoveryDeps["discovery"]["listObservations"]>>
	>();
	if (results.length > 0) {
		const list = await deps.discovery.listObservations(
			results.map((result) => result.video.id),
			new Date(now.getTime() - OBSERVATION_WINDOW_MS),
		);
		for (const observation of list) {
			const own = observations.get(observation.videoId) ?? [];
			own.push(observation);
			observations.set(observation.videoId, own);
		}
	}
	const ranked = rankVideos(results, {
		sort: page.sort,
		now,
		language: queryLanguage(query.queryText),
		observations,
		settings,
	});

	let message: string | null = null;
	if (status === "not_configured") message = NOT_CONFIGURED_MESSAGE;
	else if (status === "failed") {
		message =
			"Não foi possível buscar vídeos agora. Tente de novo em alguns minutos.";
	} else if (
		!deps.videoProvider.configured &&
		!isFresh(query, now, settings.cacheTtlHours)
	) {
		message = `${NOT_CONFIGURED_MESSAGE} Mostrando a última atualização disponível.`;
	}

	return {
		requestId: request?.id ?? null,
		query: query.queryText,
		platforms: query.platforms,
		period: query.period,
		sort: page.sort,
		status,
		message,
		progress: running ? query.progress : null,
		updatedAt: query.completedAt,
		stale:
			query.completedAt !== null &&
			!isFresh(query, now, settings.cacheTtlHours),
		platformStatus: platformStatus(query, running),
		label: POPULAR_LABEL,
		results: ranked.slice(0, settings.shownResults),
		total: ranked.length,
	};
}

/** Resposta quando nem há pesquisa guardada nem integração configurada. */
export function notConfiguredView(input: {
	query: string;
	platforms: VideoPlatform[];
	period: SearchPeriod;
	sort: SearchSort;
}): VideoSearchView {
	return {
		requestId: null,
		...input,
		status: "not_configured",
		message: NOT_CONFIGURED_MESSAGE,
		progress: null,
		updatedAt: null,
		stale: false,
		// O aviso geral já explica; repetir por plataforma não ajuda.
		platformStatus: input.platforms.map((platform) => ({
			platform,
			status: "failed",
			message: null,
		})),
		label: POPULAR_LABEL,
		results: [],
		total: 0,
	};
}
