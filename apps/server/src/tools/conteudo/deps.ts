import type {
	AuthenticatedUser,
	CompanyRepository,
	ContentRepository,
} from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ContentToolDeps = {
	companies: CompanyRepository;
	contents: ContentRepository;
	now: () => Date;
};

export type RegisterContentTool = (
	server: McpServer,
	user: AuthenticatedUser,
	deps: ContentToolDeps,
) => void;
