import {
	type ActorContext,
	type AuthenticatedUser,
	issueApiKey,
} from "@convergia/core";
import {
	InMemoryApiKeyRepository,
	InMemoryCompanyRepository,
	InMemoryContentRepository,
} from "@convergia/core/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createAuthenticate } from "./auth/authenticate";

const clientUser: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-1",
	agencyId: "agency-1",
	companyId: "company-1",
	scopes: [],
};

const agencyMember: AuthenticatedUser = {
	kind: "agency_member",
	userId: "user-2",
	agencyId: "agency-1",
	scopes: [],
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
	let apiKeys: InMemoryApiKeyRepository;
	let app: ReturnType<typeof createApp>;

	function callWhoami(authorization?: string) {
		return app.request("/api/mcp", {
			method: "POST",
			headers: authorization ? { ...MCP_HEADERS, authorization } : MCP_HEADERS,
			body: callTool("whoami"),
		});
	}

	async function keyFor(userId: string, scopes: ActorContext["scopes"]) {
		const { token } = await issueApiKey(
			{ apiKeys },
			{ userId, name: "teste", scopes },
		);
		return token;
	}

	beforeEach(() => {
		apiKeys = new InMemoryApiKeyRepository(
			new Map<string, AuthenticatedUser>([
				[clientUser.userId, clientUser],
				[agencyMember.userId, agencyMember],
			]),
		);
		app = createApp({
			authenticate: createAuthenticate({ apiKeys }),
			contents: new InMemoryContentRepository(),
			now: () => new Date(),
			companies: new InMemoryCompanyRepository([
				{ id: "company-1", agencyId: "agency-1", name: "Empresa 1" },
			]),
		});
	});

	it("responde ao health check", async () => {
		const response = await app.request("/health");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	it("RN-020: sem credencial devolve HTTP 401", async () => {
		const response = await callWhoami();

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe("Bearer");
	});

	it("RN-020: cabeçalho que não é Bearer conta como sem credencial", async () => {
		const response = await callWhoami("Basic dXNlcjpzZW5oYQ==");

		expect(response.status).toBe(401);
	});

	it("RN-023: chave de API válida atende a chamada, sem sessão", async () => {
		const token = await keyFor("user-1", ["read", "write"]);

		const response = await callWhoami(`Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(response.headers.get("mcp-session-id")).toBeNull();
		expect(await response.json()).toMatchObject({
			id: 1,
			result: {
				structuredContent: {
					userId: "user-1",
					kind: "client_user",
					companyId: "company-1",
					scopes: ["read", "write"],
				},
			},
		});
	});

	it("RN-024: a conexão carrega as permissões da chave", async () => {
		const token = await keyFor("user-1", ["read"]);

		const response = await callWhoami(`Bearer ${token}`);

		expect(await response.json()).toMatchObject({
			result: { structuredContent: { scopes: ["read"] } },
		});
	});

	it("chave de API desconhecida devolve HTTP 401 invalid_token", async () => {
		const response = await callWhoami(`Bearer ag_mcp_${"0".repeat(64)}`);

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe(
			'Bearer error="invalid_token"',
		);
		expect(await response.json()).toMatchObject({ error: "invalid_token" });
	});

	it("RN-025: chave revogada devolve HTTP 401", async () => {
		const token = await keyFor("user-1", ["read"]);
		const stored = apiKeys.keys[0];
		if (stored) stored.revoked = true;

		const response = await callWhoami(`Bearer ${token}`);

		expect(response.status).toBe(401);
	});

	it("Q-31: token OAuth depende do fornecedor ainda não escolhido", async () => {
		const response = await callWhoami("Bearer token-oauth-qualquer");

		expect(response.status).toBe(501);
		expect(await response.json()).toMatchObject({
			error: "not_decided_yet",
			questionId: "Q-31",
		});
	});

	it("RN-022: membro da agência conecta sem empresa fixa", async () => {
		const token = await keyFor("user-2", ["read"]);

		const response = await callWhoami(`Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			result: {
				structuredContent: {
					userId: "user-2",
					kind: "agency_member",
					companyId: null,
				},
			},
		});
	});
});
