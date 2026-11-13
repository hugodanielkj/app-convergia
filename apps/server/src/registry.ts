import type {
	AuthenticatedUser,
	DiscoveryDeps,
	IdeaDeps,
	KnowledgeDeps,
	ReferenceProcessingDeps,
	ScriptDeps,
	SourceDeps,
} from "@convergia/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListCompanies } from "./tools/acesso/list-companies";
import { registerWhoami } from "./tools/acesso/whoami";
import { registerApprovalTools } from "./tools/aprovacao";
import type { ApprovalToolDeps } from "./tools/aprovacao/deps";
import { registerContentTools } from "./tools/conteudo";
import type { ContentToolDeps } from "./tools/conteudo/deps";
import { registerDiscoveryTools } from "./tools/descoberta";
import { registerIdeaTools } from "./tools/ideias";
import { registerKnowledgeTools } from "./tools/referencias";
import { registerScriptTools } from "./tools/roteiros";

export type ToolDeps = ContentToolDeps &
	ApprovalToolDeps &
	ScriptDeps &
	DiscoveryDeps &
	ReferenceProcessingDeps &
	KnowledgeDeps &
	SourceDeps &
	IdeaDeps;

/** Monta um servidor MCP para uma requisição, já com o usuário autenticado. */
export function buildMcpServer(
	user: AuthenticatedUser,
	deps: ToolDeps,
): McpServer {
	const server = new McpServer({ name: "convergia", version: "0.0.0" });

	registerWhoami(server, user);
	// Catálogo §6: list_companies é da agência.
	if (user.kind === "agency_member") {
		registerListCompanies(server, user, deps);
	}
	registerKnowledgeTools(server, user, deps);
	registerIdeaTools(server, user, deps);
	registerContentTools(server, user, deps);
	registerApprovalTools(server, user, deps);
	registerScriptTools(server, user, deps);
	registerDiscoveryTools(server, user, deps);

	return server;
}
