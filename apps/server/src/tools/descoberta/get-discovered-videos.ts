import type { AuthenticatedUser } from "@convergia/core";
import { getVideoSearch, SEARCH_SORTS } from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { DiscoveryToolDeps } from "./discover-videos";
import { videoSearchResult } from "./format";

export function registerGetDiscoveredVideos(
	server: McpServer,
	user: AuthenticatedUser,
	deps: DiscoveryToolDeps,
): void {
	registerCompanyTool(
		server,
		user,
		deps,
		"get_discovered_videos",
		{
			title: "Ver vídeos descobertos",
			description:
				"Mostra o andamento e os resultados de uma pesquisa feita com discover_videos. Não consome o limite de pesquisas.",
			input: {
				request_id: z.string().describe("ID devolvido por discover_videos"),
				sort: z
					.enum(SEARCH_SORTS)
					.default("relevance")
					.describe("relevance, popularity ou recent"),
				offset: z
					.number()
					.int()
					.min(0)
					.max(1_000)
					.default(0)
					.describe("Para ver os próximos resultados"),
			},
			readOnly: true,
		},
		async (actor, input) =>
			videoSearchResult(
				await getVideoSearch(deps, actor, input.request_id, {
					sort: input.sort,
					offset: input.offset,
				}),
				input.offset,
			),
	);
}
