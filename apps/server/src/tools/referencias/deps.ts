import type {
	AuthenticatedUser,
	CompanyRepository,
	KnowledgeDeps,
	ReferenceProcessingDeps,
	SourceDeps,
} from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export type RegisterKnowledgeTool = (
	server: McpServer,
	user: AuthenticatedUser,
	deps: ReferenceProcessingDeps &
		KnowledgeDeps &
		SourceDeps & { companies: CompanyRepository },
) => void;
