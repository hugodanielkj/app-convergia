import type { AuthenticatedUser, IdeaDeps } from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export type RegisterIdeaTool = (
	server: McpServer,
	user: AuthenticatedUser,
	deps: IdeaDeps,
) => void;
