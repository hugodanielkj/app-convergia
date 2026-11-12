import { NotDecidedYet } from "@convergia/core";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import {
	type Authenticate,
	InvalidCredentialError,
	MissingCredentialError,
} from "./auth/authenticate";
import { buildMcpServer, type ToolDeps } from "./registry";

export type AppDeps = ToolDeps & {
	authenticate: Authenticate;
};

export function createApp({ authenticate, ...toolDeps }: AppDeps): Hono {
	const app = new Hono();

	app.get("/health", (c) => c.json({ status: "ok" }));

	app.all("/api/mcp", async (c) => {
		let user: Awaited<ReturnType<Authenticate>>;
		try {
			user = await authenticate(c.req.raw);
		} catch (error) {
			if (error instanceof MissingCredentialError) {
				c.header("WWW-Authenticate", "Bearer");
				return c.json(
					{ error: "unauthorized", message: "Credencial ausente." },
					401,
				);
			}
			if (error instanceof InvalidCredentialError) {
				c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
				return c.json({ error: "invalid_token", message: error.message }, 401);
			}
			if (error instanceof NotDecidedYet) {
				return c.json(
					{
						error: "not_decided_yet",
						message: `Esta forma de acesso depende de uma regra ainda não definida (${error.questionId}).`,
						questionId: error.questionId,
					},
					501,
				);
			}
			throw error;
		}

		// Sem estado entre requisições: servidor e transporte novos a cada chamada, sem sessão MCP.
		const server = buildMcpServer(user, toolDeps);
		const transport = new WebStandardStreamableHTTPServerTransport({
			enableJsonResponse: true,
		});
		await server.connect(transport);
		return transport.handleRequest(c.req.raw);
	});

	return app;
}
