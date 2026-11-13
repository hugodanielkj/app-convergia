import type {
	AuthenticatedUser,
	CompanyRepository,
	InstagramDeps,
} from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type InstagramToolDeps = InstagramDeps & {
	companies: CompanyRepository;
};

export type RegisterInstagramTool = (
	server: McpServer,
	user: AuthenticatedUser,
	deps: InstagramToolDeps,
) => void;
