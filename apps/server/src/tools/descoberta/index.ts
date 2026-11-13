import type { AuthenticatedUser } from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type DiscoveryToolDeps,
	registerDiscoverVideos,
} from "./discover-videos";
import { registerGetDiscoveredVideos } from "./get-discovered-videos";

/** Descoberta de vídeos (✅ RN-110 a RN-119). */
export function registerDiscoveryTools(
	server: McpServer,
	user: AuthenticatedUser,
	deps: DiscoveryToolDeps,
): void {
	registerDiscoverVideos(server, user, deps);
	registerGetDiscoveredVideos(server, user, deps);
}
