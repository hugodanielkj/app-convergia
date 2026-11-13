import { assertCanWrite } from "../../policies/permission.policy";
import {
	quotaDay,
	userQuotaExhausted,
	userQuotaKey,
} from "../../policies/quota.policy";
import type { ActorContext } from "../../shared/actor-context";
import { searchNotFound, tooManySearches } from "../errors";
import type { CacheStatus, VideoQuery } from "../ports/discovery-repository";
import { cacheKey, cleanQuery } from "../query";
import { platformsFor, type SearchSort, type VideoSearchInput } from "../video";
import type { DiscoveryDeps } from "./deps";
import {
	buildView,
	inProgress,
	isFresh,
	notConfiguredView,
	type VideoSearchView,
} from "./view";

/**
 * ✅ RN-110 a RN-119: pesquisa vídeos por assunto. Devolve na hora o que já está no cache; se
 * não há nada ou está velho, põe a coleta na fila e a tela acompanha com `getVideoSearch`.
 * Pesquisas iguais em andamento são reaproveitadas, sem coletar de novo.
 */
export async function discoverVideos(
	deps: DiscoveryDeps,
	actor: ActorContext,
	input: VideoSearchInput,
): Promise<VideoSearchView> {
	// Coletar gasta créditos do provedor: conexão só de leitura não pesquisa (RN-024).
	assertCanWrite(actor);
	const settings = deps.discoverySettings;
	const now = deps.now();
	const queryText = cleanQuery(input.query);
	const platforms = platformsFor(input.platform);
	const key = cacheKey({ query: queryText, platforms, period: input.period });
	const page = { sort: input.sort };

	const existing = await deps.discovery.findQueryByKey(key);
	const record = (
		query: VideoQuery,
		cacheStatus: CacheStatus,
		day: string | null = null,
	) =>
		deps.discovery.createRequest({
			companyId: actor.companyId,
			userId: actor.userId,
			queryId: query.id,
			cacheStatus,
			quotaDay: day,
		});

	if (existing && isFresh(existing, now, settings.cacheTtlHours)) {
		return buildView(deps, await record(existing, "hit"), existing, page);
	}
	if (existing && inProgress(existing, now, settings.stuckAfterMinutes)) {
		return buildView(deps, await record(existing, "joined"), existing, page);
	}
	// Daqui em diante seria preciso coletar.
	const hasPrevious = existing?.completedAt != null;
	if (!deps.videoProvider.configured) {
		if (existing && hasPrevious) {
			return buildView(
				deps,
				await record(existing, "not_configured"),
				existing,
				page,
			);
		}
		return notConfiguredView({
			query: queryText,
			platforms,
			period: input.period,
			sort: input.sort,
		});
	}

	// ✅ RN-118: limite por minuto e por dia, contado só para pesquisas que coletam.
	const recent = await deps.discovery.countCollections(
		actor.companyId,
		actor.userId,
		new Date(now.getTime() - 60_000),
	);
	if (recent >= settings.searchesPerMinutePerUser) {
		if (existing && hasPrevious) {
			return buildView(deps, await record(existing, "hit"), existing, page);
		}
		throw tooManySearches();
	}
	const day = quotaDay(now);
	const quotaKey = userQuotaKey("discover_videos", actor.userId);
	const reserved = await deps.quotas.reserve(
		actor.companyId,
		quotaKey,
		day,
		settings.dailySearchesPerUser,
	);
	if (!reserved) {
		// Sem cota para atualizar, os resultados antigos ainda servem.
		if (existing && hasPrevious) {
			return buildView(deps, await record(existing, "hit"), existing, page);
		}
		throw userQuotaExhausted(settings.dailySearchesPerUser);
	}

	try {
		let query: VideoQuery;
		let started: boolean;
		if (existing) {
			started = await deps.discovery.requeue(
				existing.id,
				actor.companyId,
				new Date(now.getTime() - settings.stuckAfterMinutes * 60_000),
			);
			// ✅ RN-305: a coleta anterior caiu no meio sem devolver as cotas reservadas para ela.
			if (started) await releaseReservations(deps, existing.id);
			query = (await deps.discovery.findQuery(existing.id)) ?? existing;
		} else {
			const created = await deps.discovery.createQuery({
				cacheKey: key,
				queryText,
				platforms,
				period: input.period,
				requestedByCompanyId: actor.companyId,
			});
			query = created.query;
			started = created.created;
		}
		if (!started) {
			// Outra pessoa começou a mesma coleta agora: aproveita a dela.
			await deps.quotas.release(actor.companyId, quotaKey, day);
			return buildView(deps, await record(query, "joined"), query, page);
		}
		const request = await record(query, hasPrevious ? "stale" : "miss", day);
		try {
			await deps.discoveryQueue.enqueue(query.id);
		} catch (error) {
			// A coleta não vai acontecer: fecha e devolve a cota de quem esperava (RN-305).
			await deps.discovery.completeQuery(query.id, {
				status: "failed",
				terms: [],
				platformOutcomes: {},
				error: "A fila de coletas não aceitou a pesquisa.",
			});
			await releaseReservations(deps, query.id);
			throw new EnqueueFailed(error);
		}
		return buildView(deps, request, query, page);
	} catch (error) {
		if (error instanceof EnqueueFailed) throw error.original;
		await deps.quotas.release(actor.companyId, quotaKey, day);
		throw error;
	}
}

/** A cota já voltou por `releaseReservations`; não devolver de novo. */
class EnqueueFailed extends Error {
	constructor(readonly original: unknown) {
		super("Falha ao enfileirar a coleta de vídeos");
	}
}

export async function releaseReservations(
	deps: Pick<DiscoveryDeps, "discovery" | "quotas">,
	queryId: string,
): Promise<void> {
	const reservations = await deps.discovery.settleReservations(queryId);
	for (const { companyId, userId, day } of reservations) {
		await deps.quotas.release(
			companyId,
			userQuotaKey("discover_videos", userId),
			day,
		);
	}
}

/** Andamento e resultados de uma pesquisa feita nesta empresa (RN-015). */
export async function getVideoSearch(
	deps: DiscoveryDeps,
	actor: ActorContext,
	requestId: string,
	page: { sort: SearchSort },
): Promise<VideoSearchView> {
	const request = await deps.discovery.findRequest(actor.companyId, requestId);
	if (!request) throw searchNotFound();
	const query = await deps.discovery.findQuery(request.queryId);
	if (!query) throw searchNotFound();
	return buildView(deps, request, query, page);
}
