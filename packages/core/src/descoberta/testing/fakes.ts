import type { DiscoveryQueue } from "../ports/discovery-queue";
import type { QueryExpander } from "../ports/query-expander";
import {
	type ProviderSearchPage,
	type ProviderSearchRequest,
	type VideoProvider,
	VideoProviderError,
} from "../ports/video-provider";
import { DEFAULT_DISCOVERY_SETTINGS } from "../settings";
import type { CollectedVideo, VideoMetrics, VideoPlatform } from "../video";
import { InMemoryDiscoveryRepository } from "./in-memory-discovery-repository";

/** Vídeo de teste, com tudo vazio menos o que o teste informar. Nunca vai para a tela real. */
export function testVideo(
	overrides: Partial<Omit<CollectedVideo, "metrics">> &
		Pick<CollectedVideo, "externalId"> & { metrics?: Partial<VideoMetrics> },
): CollectedVideo {
	const platform = overrides.platform ?? "tiktok";
	return {
		platform,
		url: `https://example.com/${platform}/${overrides.externalId}`,
		caption: null,
		creatorHandle: null,
		creatorName: null,
		thumbnailUrl: null,
		publishedAt: null,
		durationSeconds: null,
		language: null,
		...overrides,
		metrics: {
			views: null,
			likes: null,
			comments: null,
			shares: null,
			...overrides.metrics,
		},
	};
}

/** Dublê do provedor: páginas fixas por plataforma e termo, e registro das chamadas. */
export class FakeVideoProvider implements VideoProvider {
	readonly name = "teste";
	configured = true;
	readonly calls: ProviderSearchRequest[] = [];
	readonly metricCalls: { platform: VideoPlatform; externalId: string }[] = [];
	/** Páginas por plataforma; cada chamada devolve a próxima. */
	pages: Partial<Record<VideoPlatform, ProviderSearchPage[]>> = {};
	failures: Partial<Record<VideoPlatform, VideoProviderError>> = {};
	metrics = new Map<string, VideoMetrics>();
	/** Enquanto houver trava, as buscas esperam: serve para medir o paralelismo. */
	gate: Promise<void> | null = null;
	inFlight = 0;
	maxInFlight = 0;

	async search(request: ProviderSearchRequest): Promise<ProviderSearchPage> {
		this.calls.push(request);
		const index =
			this.calls.filter((c) => c.platform === request.platform).length - 1;
		this.inFlight++;
		this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
		try {
			if (this.gate) await this.gate;
			const failure = this.failures[request.platform];
			if (failure) throw failure;
			return (
				this.pages[request.platform]?.[index] ?? {
					videos: [],
					nextCursor: null,
				}
			);
		} finally {
			this.inFlight--;
		}
	}

	async fetchMetrics(
		platform: VideoPlatform,
		video: { externalId: string; url: string },
	): Promise<VideoMetrics> {
		this.metricCalls.push({ platform, externalId: video.externalId });
		const metrics = this.metrics.get(video.externalId);
		if (!metrics) throw new VideoProviderError("not_found", "Sem métricas.");
		return metrics;
	}
}

export class FakeDiscoveryQueue implements DiscoveryQueue {
	readonly enqueued: string[] = [];
	failWith: Error | null = null;

	async enqueue(queryId: string): Promise<void> {
		if (this.failWith) throw this.failWith;
		this.enqueued.push(queryId);
	}
}

export class FakeQueryExpander implements QueryExpander {
	readonly calls: { companyId: string; query: string; max: number }[] = [];
	suggestions: string[] = [];
	failWith: Error | null = null;
	/** Enquanto houver trava, a sugestão de termos não chega. */
	gate: Promise<void> | null = null;

	async expand(
		meta: { companyId: string },
		query: string,
		max: number,
	): Promise<string[]> {
		this.calls.push({ companyId: meta.companyId, query, max });
		if (this.gate) await this.gate;
		if (this.failWith) throw this.failWith;
		return this.suggestions;
	}
}

/** Dependências da descoberta com dublês, para testes de outros pacotes. */
export function testDiscoveryDeps() {
	return {
		discovery: new InMemoryDiscoveryRepository(),
		videoProvider: new FakeVideoProvider(),
		discoveryQueue: new FakeDiscoveryQueue(),
		queryExpander: null,
		discoverySettings: DEFAULT_DISCOVERY_SETTINGS,
	};
}
