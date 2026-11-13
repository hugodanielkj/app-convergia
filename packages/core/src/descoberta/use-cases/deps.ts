import type { QuotaRepository } from "../../cotas/ports/quota-repository";
import type { DiscoveryQueue } from "../ports/discovery-queue";
import type { DiscoveryRepository } from "../ports/discovery-repository";
import type { QueryExpander } from "../ports/query-expander";
import type { VideoProvider } from "../ports/video-provider";
import type { DiscoverySettings } from "../settings";

export type DiscoveryDeps = {
	discovery: DiscoveryRepository;
	videoProvider: VideoProvider;
	discoveryQueue: DiscoveryQueue;
	/** `null` quando a expansão por IA está desligada. */
	queryExpander: QueryExpander | null;
	quotas: QuotaRepository;
	discoverySettings: DiscoverySettings;
	now: () => Date;
};
