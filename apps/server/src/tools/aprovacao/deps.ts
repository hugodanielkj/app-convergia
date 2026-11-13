import type {
	ApprovalDeps,
	AuthenticatedUser,
	CompanyRepository,
} from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ApprovalToolDeps = ApprovalDeps & { companies: CompanyRepository };

export type RegisterApprovalTool = (
	server: McpServer,
	user: AuthenticatedUser,
	deps: ApprovalToolDeps,
) => void;
