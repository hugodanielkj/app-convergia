import type { AuthenticatedUser } from "@convergia/core";
import {
	FakeInstagramGateway,
	FakeScriptAi,
	InMemoryCompanyRepository,
	InMemoryInstagramRepository,
	InMemoryQuotaRepository,
	InMemoryScriptRepository,
	inMemoryContentDeps,
	testDiscoveryDeps,
} from "@convergia/core/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { buildMcpServer, type ToolDeps } from "../../registry";

const clientA: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-a",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: ["read", "write"],
};
const clientB: AuthenticatedUser = {
	...clientA,
	userId: "user-b",
	companyId: "company-b",
};
const agency: AuthenticatedUser = {
	kind: "agency_member",
	userId: "user-agency",
	agencyId: "agency-1",
	scopes: ["read", "write"],
};

describe("contrato MCP: Instagram", () => {
	let deps: ToolDeps;

	async function connect(as: AuthenticatedUser) {
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		const client = new Client({ name: "contract-test", version: "0.0.0" });
		await Promise.all([
			buildMcpServer(as, deps).connect(serverTransport),
			client.connect(clientTransport),
		]);
		return {
			names: async () => (await client.listTools()).tools.map((t) => t.name),
			call: async (name: string, args: Record<string, unknown>) => {
				const result = await client.callTool({ name, arguments: args });
				return {
					isError: result.isError === true,
					text: JSON.stringify(result.content),
					data: result.structuredContent as { authorizeUrl?: string },
				};
			},
		};
	}

	beforeEach(() => {
		deps = {
			companies: new InMemoryCompanyRepository([
				{ id: "company-a", agencyId: "agency-1", name: "A" },
				{ id: "company-b", agencyId: "agency-1", name: "B" },
			]),
			...inMemoryContentDeps(),
			scripts: new InMemoryScriptRepository(),
			instagram: new InMemoryInstagramRepository(),
			instagramGateway: new FakeInstagramGateway(),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			...testDiscoveryDeps(),
			now: () => new Date("2026-11-13T12:00:00Z"),
		};
	});

	it("RN-034: connect_instagram é só do cliente; os dois veem a conexão", async () => {
		expect(await (await connect(clientA)).names()).toEqual(
			expect.arrayContaining(["connect_instagram", "get_instagram_connection"]),
		);
		const agencyTools = await (await connect(agency)).names();
		expect(agencyTools).toContain("get_instagram_connection");
		expect(agencyTools).not.toContain("connect_instagram");
	});

	it("o cliente recebe o link; a agência vê o aviso enquanto não conecta", async () => {
		const link = await (await connect(clientA)).call("connect_instagram", {
			username: "padariadoze",
		});
		expect(link.isError).toBe(false);
		expect(link.data.authorizeUrl).toContain("instagram.com/oauth/authorize");
		expect(link.text).toContain("vale por 15 minutos");

		const seen = await (await connect(agency)).call(
			"get_instagram_connection",
			{
				company_id: "company-a",
			},
		);
		expect(seen.text).toContain(
			"O cliente ainda não conectou o Instagram desta empresa.",
		);
	});

	it("RN-039: depois de conectar, mostra o @ e o que a IA usa", async () => {
		await deps.instagram.saveConnection("company-a", {
			igUserId: "ig-1",
			username: "padariadoze",
			connectedByUserId: "user-a",
			connectedAt: new Date("2026-11-13T12:00:00Z"),
			tokenExpiresAt: new Date("2027-01-12T12:00:00Z"),
			simulated: false,
			accessToken: "token-secreto",
			snapshot: null,
		});
		const seen = await (await connect(clientA)).call(
			"get_instagram_connection",
			{},
		);
		expect(seen.text).toContain("Instagram conectado: @padariadoze");
		expect(seen.text).toContain("curtidas e comentários");
		expect(seen.text).not.toContain("token-secreto");

		const other = await (await connect(clientB)).call(
			"get_instagram_connection",
			{},
		);
		expect(other.text).not.toContain("padariadoze");
	});
});
