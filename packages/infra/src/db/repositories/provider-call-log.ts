import type { ProviderCall } from "../../scraping/scrapecreators-provider";
import type { Db } from "../client";
import { videoProviderCalls } from "../schema";

/**
 * ✅ RN-118: grava cada chamada ao provedor de vídeos. O registro não pode derrubar a pesquisa,
 * então roda sem esperar e só avisa no log se falhar.
 */
export function createProviderCallLog(db: Db): (call: ProviderCall) => void {
	return (call) => {
		db.insert(videoProviderCalls)
			.values(call)
			.catch((error: unknown) =>
				console.error("Falha ao gravar video_provider_calls", error),
			);
	};
}
