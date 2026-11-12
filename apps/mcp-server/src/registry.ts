import type { ActorContext } from "@convergia/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWhoami } from "./tools/acesso/whoami";

/** Monta um servidor MCP para uma requisição, já com o contexto do ator. */
export function buildMcpServer(actor: ActorContext): McpServer {
	const server = new McpServer({ name: "convergia", version: "0.0.0" });

	registerWhoami(server, actor);

	return server;
}
