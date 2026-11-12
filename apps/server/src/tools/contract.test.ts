import type { AuthenticatedUser } from "@convergia/core";
import { InMemoryCompanyRepository } from "@convergia/core/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { buildMcpServer } from "../registry";

const agencyMember: AuthenticatedUser = {
	kind: "agency_member",
	userId: "user-1",
	agencyId: "agency-1",
	scopes: ["read"],
};

const clientUser: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-2",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: ["read", "write"],
};

const companies = new InMemoryCompanyRepository([
	{ id: "company-b", agencyId: "agency-1", name: "Padaria Beta" },
	{ id: "company-a", agencyId: "agency-1", name: "Loja Alfa" },
	{ id: "company-x", agencyId: "agency-2", name: "De outra agência" },
]);

async function connect(as: AuthenticatedUser) {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "contract-test", version: "0.0.0" });
	await Promise.all([
		buildMcpServer(as, { companies }).connect(serverTransport),
		client.connect(clientTransport),
	]);
	return client;
}

describe("contrato MCP", () => {
	it("toda ferramenta tem nome em snake_case, descrição e schema de entrada", async () => {
		for (const user of [agencyMember, clientUser]) {
			const { tools } = await (await connect(user)).listTools();

			expect(tools.length).toBeGreaterThan(0);
			for (const tool of tools) {
				expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
				expect(tool.description?.length ?? 0).toBeGreaterThan(20);
				expect(tool.inputSchema.type).toBe("object");
			}
		}
	});

	it("list_companies é oferecida só ao membro da agência", async () => {
		const names = async (user: AuthenticatedUser) =>
			(await (await connect(user)).listTools()).tools.map((t) => t.name);

		expect(await names(agencyMember)).toContain("list_companies");
		expect(await names(clientUser)).not.toContain("list_companies");
	});

	it("whoami do usuário do cliente mostra a empresa dele", async () => {
		const result = await (await connect(clientUser)).callTool({
			name: "whoami",
		});

		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toEqual({
			userId: "user-2",
			kind: "client_user",
			agencyId: "agency-1",
			companyId: "company-a",
			scopes: ["read", "write"],
		});
		expect(result.content).toEqual([
			{
				type: "text",
				text: "Você é usuário do cliente (usuário user-2), operando na empresa company-a. Permissões: leitura e escrita.",
			},
		]);
	});

	it("RN-022: whoami do membro da agência explica como informar a empresa", async () => {
		const result = await (await connect(agencyMember)).callTool({
			name: "whoami",
		});

		expect(result.structuredContent).toMatchObject({ companyId: null });
		expect(result.content).toEqual([
			{
				type: "text",
				text: "Você é membro da agência (usuário user-1). Informe a empresa cliente no parâmetro company_id de cada ferramenta; use list_companies para ver as empresas. Permissões: leitura.",
			},
		]);
	});

	it("RN-010: list_companies devolve só as empresas da agência, com o ID", async () => {
		const result = await (await connect(agencyMember)).callTool({
			name: "list_companies",
		});

		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toEqual({
			companies: [
				{ id: "company-b", name: "Padaria Beta" },
				{ id: "company-a", name: "Loja Alfa" },
			],
		});
		expect(result.content).toEqual([
			{
				type: "text",
				text: "- Padaria Beta (ID: company-b)\n- Loja Alfa (ID: company-a)",
			},
		]);
	});
});
