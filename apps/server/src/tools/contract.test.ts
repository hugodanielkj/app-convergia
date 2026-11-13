import type { AuthenticatedUser } from "@convergia/core";
import {
	FakeScriptAi,
	InMemoryCompanyRepository,
	InMemoryQuotaRepository,
	InMemoryScriptRepository,
	inMemoryContentDeps,
	testDiscoveryDeps,
} from "@convergia/core/testing";
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
		buildMcpServer(as, {
			companies,
			...inMemoryContentDeps(),
			scripts: new InMemoryScriptRepository(),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			...testDiscoveryDeps(),
			now: () => new Date(),
		}).connect(serverTransport),
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

	it("RN-022: create_content pede company_id só ao membro da agência", async () => {
		const schemaOf = async (user: AuthenticatedUser) =>
			(await (await connect(user)).listTools()).tools.find(
				(t) => t.name === "create_content",
			)?.inputSchema;

		expect((await schemaOf(agencyMember))?.required).toContain("company_id");
		expect((await schemaOf(clientUser))?.properties).not.toHaveProperty(
			"company_id",
		);
	});

	it("cria e lista cards pelo MCP, com o ID no texto", async () => {
		const client = await connect(clientUser);

		const created = await client.callTool({
			name: "create_content",
			arguments: { content: { title: "Reel de teste" } },
		});
		const listed = await client.callTool({
			name: "list_contents",
			arguments: {},
		});

		expect(created.isError).toBeFalsy();
		expect(JSON.stringify(listed.content)).toMatch(
			/Reel de teste \(ID: content-1\) · Ideia/,
		);
	});

	it("erro de negócio sai como isError com a mensagem da regra", async () => {
		const result = await (await connect(clientUser)).callTool({
			name: "get_content",
			arguments: { content_id: "nao-existe" },
		});

		expect(result.isError).toBe(true);
		expect(result.content).toEqual([
			{ type: "text", text: "Card não encontrado." },
		]);
	});

	it("a agência sem company_id recebe o pedido de informar a empresa", async () => {
		const result = await (await connect(agencyMember)).callTool({
			name: "list_contents",
			arguments: {},
		});

		expect(result.isError).toBe(true);
	});
});

describe("Passo 8 pelo MCP", () => {
	it("RN-080, RN-082: gera, lista e converte sugestão sem nova IA", async () => {
		const c = await connect(clientUser);
		const generated = await c.callTool({
			name: "regenerate_brainstorm",
			arguments: { brief: "Bastidores" },
		});
		expect(generated.isError).toBeFalsy();
		const listed = await c.callTool({
			name: "list_brainstorm_suggestions",
			arguments: {},
		});
		const payload = listed.structuredContent as { result: { id: string }[] };
		const id = payload.result[0]?.id;
		expect(id).toBeTruthy();
		expect(
			(
				await c.callTool({
					name: "accept_brainstorm_suggestion",
					arguments: { suggestion_id: id },
				})
			).isError,
		).toBeFalsy();
		expect(
			JSON.stringify(
				(await c.callTool({ name: "list_contents", arguments: {} })).content,
			),
		).toContain("Bastidores");
		await c.close();
	});
	it("RN-015: as ferramentas novas recusam empresa de outra agência", async () => {
		const c = await connect({ ...agencyMember, scopes: ["read", "write"] });
		for (const name of [
			"list_brainstorm_suggestions",
			"list_saved_references",
		]) {
			expect(
				(await c.callTool({ name, arguments: { company_id: "company-x" } }))
					.isError,
			).toBe(true);
		}
		await c.close();
	});
	it("Q-21: salvar post devolve regra pendente com isError", async () => {
		const c = await connect(clientUser);
		const r = await c.callTool({
			name: "save_reference_by_url",
			arguments: { url: "https://www.instagram.com/p/abc/" },
		});
		expect(r.isError).toBe(true);
		expect(JSON.stringify(r.content)).toContain("Q-21");
		await c.close();
	});
	it("RN-024: conexão de leitura não gera ideias", async () => {
		const c = await connect(agencyMember);
		const r = await c.callTool({
			name: "regenerate_brainstorm",
			arguments: { company_id: "company-a", brief: "Tema" },
		});
		expect(r.isError).toBe(true);
		await c.close();
	});
});
