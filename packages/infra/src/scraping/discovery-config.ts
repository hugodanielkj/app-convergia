import type { Env } from "@convergia/config";
import {
	DEFAULT_DISCOVERY_SETTINGS,
	type DiscoverySettings,
	type VideoProvider,
} from "@convergia/core";
import {
	createScrapeCreatorsProvider,
	type ProviderCall,
} from "./scrapecreators-provider";

type DiscoveryEnv = Pick<
	Env,
	| "SCRAPECREATORS_API_KEY"
	| "VIDEO_SEARCH_CACHE_TTL_HOURS"
	| "VIDEO_SEARCH_DAILY_LIMIT_PER_USER"
	| "VIDEO_SEARCH_PER_MINUTE_LIMIT"
	| "VIDEO_SEARCH_MAX_CALLS"
	| "VIDEO_SEARCH_METRIC_REFRESH"
	| "VIDEO_SEARCH_TIMEOUT_MS"
	| "VIDEO_SEARCH_AI_EXPANSION"
>;

/** Limites da descoberta de vídeos: os padrões do core com o que o ambiente configurou. */
export function discoverySettingsFromEnv(env: DiscoveryEnv): DiscoverySettings {
	return {
		...DEFAULT_DISCOVERY_SETTINGS,
		cacheTtlHours: env.VIDEO_SEARCH_CACHE_TTL_HOURS,
		dailySearchesPerUser: env.VIDEO_SEARCH_DAILY_LIMIT_PER_USER,
		searchesPerMinutePerUser: env.VIDEO_SEARCH_PER_MINUTE_LIMIT,
		maxCallsPerSearch: env.VIDEO_SEARCH_MAX_CALLS,
		metricRefreshesPerSearch: env.VIDEO_SEARCH_METRIC_REFRESH,
		aiExpansion: env.VIDEO_SEARCH_AI_EXPANSION,
	};
}

/**
 * Provedor de vídeos do servidor. Hoje só o ScrapeCreators (✅ RN-111); trocar de fornecedor é
 * trocar esta função. Nunca há provedor simulado: sem chave, a busca avisa que falta configurar.
 */
export function createVideoProvider(
	env: DiscoveryEnv,
	onCall: (call: ProviderCall) => void,
): VideoProvider {
	return createScrapeCreatorsProvider({
		apiKey: env.SCRAPECREATORS_API_KEY,
		timeoutMs: env.VIDEO_SEARCH_TIMEOUT_MS,
		onCall,
	});
}
