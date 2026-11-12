import { NotDecidedYet } from "@convergia/core";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import {
	MissingCredentialError,
	type ResolveActor,
} from "./auth/resolve-actor";
import { buildMcpServer } from "./registry";

export type AppDeps = {
	resolveActor: ResolveActor;
};

export function createApp({ resolveActor }: AppDeps): Hono {
	const app = new Hono();

	app.get("/health", (c) => c.json({ status: "ok" }));

	app.all("/api/mcp", async (c) => {
		let actor: Awaited<ReturnType<ResolveActor>>;
		try {
			actor = await resolveActor(c.req.raw);
		} catch (error) {
			if (error instanceof MissingCredentialError) {
				c.header("WWW-Authenticate", "Bearer");
				return c.json(
					{ error: "unauthorized", message: "Credencial ausente." },
					401,
				);
			}
			if (error instanceof NotDecidedYet) {
				return c.json(
					{
						error: "not_decided_yet",
						message: `Autenticação ainda não definida (${error.questionId}).`,
					},
					501,
				);
			}
			throw error;
		}

		// Sem estado entre requisições: servidor e transporte novos a cada chamada, sem sessão MCP.
		const server = buildMcpServer(actor);
		const transport = new WebStandardStreamableHTTPServerTransport({
			enableJsonResponse: true,
		});
		await server.connect(transport);
		return transport.handleRequest(c.req.raw);
	});

	return app;
}
