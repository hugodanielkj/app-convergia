import type { AuthenticatedUser } from "@convergia/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListCompanies } from "./tools/acesso/list-companies";
import { registerWhoami } from "./tools/acesso/whoami";
import { registerContentTools } from "./tools/conteudo";
import type { ContentToolDeps } from "./tools/conteudo/deps";

export type ToolDeps = ContentToolDeps;

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
	registerContentTools(server, user, deps);

	return server;
}
