import type { AuthenticatedUser, ScriptDeps } from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type RegisterScriptTool = (
	server: McpServer,
	user: AuthenticatedUser,
	deps: ScriptDeps,
) => void;
