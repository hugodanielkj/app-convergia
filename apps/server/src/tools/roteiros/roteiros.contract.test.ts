import type { AuthenticatedUser } from "@convergia/core";
import {
	FakeScriptAi,
	InMemoryCompanyRepository,
	InMemoryContentRepository,
	InMemoryQuotaRepository,
	InMemoryScriptRepository,
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

type Structured = {
	content?: { id: string; script: { hook: string | null } };
	contents?: { id: string; approvalStatus: string }[];
	messages?: { id: string; role: string }[];
	entries?: { kind: string }[];
};

describe("contrato MCP: roteiros", () => {
	let deps: ToolDeps;

	async function connect(as: AuthenticatedUser) {
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		const client = new Client({ name: "contract-test", version: "0.0.0" });
		await Promise.all([
			buildMcpServer(as, deps).connect(serverTransport),
			client.connect(clientTransport),
		]);
		return async (name: string, args: Record<string, unknown>) => {
			const result = await client.callTool({ name, arguments: args });
			return {
				isError: result.isError === true,
				text: JSON.stringify(result.content),
				data: result.structuredContent as Structured,
			};
		};
	}

	const newCard = async () => {
		const call = await connect(clientA);
		const created = await call("create_content", {
			content: { title: "Mesa de jantar" },
		});
		return created.data.content?.id ?? "";
	};

	beforeEach(() => {
		deps = {
			companies: new InMemoryCompanyRepository([
				{ id: "company-a", agencyId: "agency-1", name: "A" },
				{ id: "company-b", agencyId: "agency-1", name: "B" },
			]),
			contents: new InMemoryContentRepository(),
			scripts: new InMemoryScriptRepository(),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			now: () => new Date("2026-11-12T12:00:00Z"),
		};
	});

	it("as ferramentas do catálogo estão registradas", async () => {
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		const client = new Client({ name: "t", version: "0" });
		await Promise.all([
			buildMcpServer(clientA, deps).connect(serverTransport),
			client.connect(clientTransport),
		]);
		const names = (await client.listTools()).tools.map((t) => t.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"generate_scripts",
				"generate_hook_options",
				"generate_body_options",
				"generate_cta_options",
				"generate_caption_options",
				"list_content_generations",
				"refine_content",
				"get_refine_chat",
				"review_content_refinement",
			]),
		);
	});

	it("gera, refina e aplica a prévia, com o ID no texto", async () => {
		const id = await newCard();
		const call = await connect(clientA);

		const generated = await call("generate_scripts", { content_ids: [id] });
		expect(generated.isError).toBe(false);
		expect(generated.text).toContain("Gancho: Gancho sobre Mesa de jantar");

		const refined = await call("refine_content", {
			content_id: id,
			message: "mais curto",
		});
		const previewId = refined.data.messages?.[1]?.id ?? "";
		expect(refined.text).toContain(`prévia pendente, ID: ${previewId}`);

		const applied = await call("review_content_refinement", {
			content_id: id,
			message_id: previewId,
			decision: "apply",
		});
		expect(applied.isError).toBe(false);
		expect(applied.data.content?.script.hook).toBe("Novo gancho (mais curto)");
	});

	it("RN-022: a agência informa a empresa e a geração fica em preparo", async () => {
		const id = await newCard();
		const call = await connect(agency);
		expect(
			(await call("generate_scripts", { content_ids: [id] })).isError,
		).toBe(true);
		const generated = await call("generate_scripts", {
			company_id: "company-a",
			content_ids: [id],
		});
		expect(generated.data.contents?.[0]?.approvalStatus).toBe("in_preparation");
	});

	it("RN-015: a empresa B não gera nem lê o refino da A, e o erro sai como isError", async () => {
		const id = await newCard();
		const call = await connect(clientB);
		for (const [name, args] of [
			["generate_scripts", { content_ids: [id] }],
			["refine_content", { content_id: id, message: "x" }],
			["get_refine_chat", { content_id: id }],
		] as const) {
			const result = await call(name, args);
			expect(result.isError).toBe(true);
			expect(result.text).toContain("Card não encontrado.");
		}
	});

	it("Q-21: as opções avulsas (RN-071) saem como isError até a cota ser decidida", async () => {
		const id = await newCard();
		const call = await connect(clientA);
		for (const field of ["hook", "body", "cta", "caption"]) {
			const result = await call(`generate_${field}_options`, {
				content_id: id,
			});
			expect(result.isError).toBe(true);
			expect(result.text).toContain(
				"Esta funcionalidade depende de uma regra ainda não definida (Q-21).",
			);
		}
	});

	it("RN-015: a empresa B não pede opções de um card da A", async () => {
		const id = await newCard();
		const call = await connect(clientB);
		const result = await call("generate_hook_options", { content_id: id });
		expect(result.isError).toBe(true);
		expect(result.text).toContain("Card não encontrado.");
	});

	it("RN-072: list_content_generations mostra o histórico, das mais novas primeiro", async () => {
		const id = await newCard();
		const call = await connect(clientA);
		const empty = await call("list_content_generations", { content_id: id });
		expect(empty.text).toContain("Este card ainda não tem gerações de IA.");

		await call("generate_scripts", { content_ids: [id] });
		const history = await call("list_content_generations", { content_id: id });
		expect(history.isError).toBe(false);
		expect(history.text).toContain("Roteiro completo (cliente,");
		expect(history.text).toContain("Gancho: Gancho sobre Mesa de jantar");
		expect(history.data.entries).toHaveLength(1);
	});

	it("RN-015: a empresa B não lê o histórico da A", async () => {
		const id = await newCard();
		const call = await connect(clientB);
		const result = await call("list_content_generations", { content_id: id });
		expect(result.isError).toBe(true);
		expect(result.text).toContain("Card não encontrado.");
	});
});
