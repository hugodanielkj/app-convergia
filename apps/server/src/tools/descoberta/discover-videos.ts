import type {
	AuthenticatedUser,
	CompanyRepository,
	DiscoveryDeps,
} from "@convergia/core";
import { discoverVideos, videoSearchInput } from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCompanyTool } from "../company-tool";
import { videoSearchResult } from "./format";

export type DiscoveryToolDeps = DiscoveryDeps & {
	companies: CompanyRepository;
};

export function registerDiscoverVideos(
	server: McpServer,
	user: AuthenticatedUser,
	deps: DiscoveryToolDeps,
): void {
	registerCompanyTool(
		server,
		user,
		deps,
		"discover_videos",
		{
			title: "Descobrir vídeos populares",
			description:
				'Pesquisa vídeos reais e populares do Instagram Reels e do TikTok sobre um assunto em linguagem natural (ex.: "como criar vídeos com IA"). Devolve na hora o que já estiver em cache; se não houver, a coleta roda em segundo plano e você acompanha com get_discovered_videos. A busca é parcial (no Instagram, usa resultados indexados pelo Google), a relevância vem da legenda e as métricas são as públicas no momento da coleta. Pesquisas que coletam dados novos contam no limite diário do usuário.',
			input: videoSearchInput.shape,
		},
		async (actor, input) =>
			videoSearchResult(await discoverVideos(deps, actor, input)),
	);
}
