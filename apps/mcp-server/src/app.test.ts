import type { ActorContext } from "@convergia/core";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { resolveActor } from "./auth/resolve-actor";

const actor: ActorContext = {
	userId: "user-1",
	kind: "client_user",
	agencyId: "agency-1",
	companyId: "company-1",
	scopes: ["read", "write"],
};

const MCP_HEADERS = {
	"content-type": "application/json",
	accept: "application/json, text/event-stream",
};

function callTool(name: string) {
	return JSON.stringify({
		jsonrpc: "2.0",
		id: 1,
		method: "tools/call",
		params: { name, arguments: {} },
	});
}

describe("servidor HTTP", () => {
	it("responde ao health check", async () => {
		const response = await createApp({ resolveActor }).request("/health");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	it("RN-020: sem credencial devolve HTTP 401", async () => {
		const response = await createApp({ resolveActor }).request("/api/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: callTool("whoami"),
		});

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe("Bearer");
	});

	it("Q-31: enquanto o fornecedor do OAuth não for definido, nenhum token é aceito", async () => {
		const response = await createApp({ resolveActor }).request("/api/mcp", {
			method: "POST",
			headers: { ...MCP_HEADERS, authorization: "Bearer qualquer-token" },
			body: callTool("whoami"),
		});

		expect(response.status).toBe(501);
		expect(await response.json()).toMatchObject({ error: "not_decided_yet" });
	});

	it("atende uma chamada de ferramenta por Streamable HTTP, sem sessão", async () => {
		const app = createApp({ resolveActor: async () => actor });

		const response = await app.request("/api/mcp", {
			method: "POST",
			headers: MCP_HEADERS,
			body: callTool("whoami"),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("mcp-session-id")).toBeNull();
		expect(await response.json()).toMatchObject({
			id: 1,
			result: {
				structuredContent: { userId: "user-1", companyId: "company-1" },
			},
		});
	});
});
