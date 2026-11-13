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
	content?: { id: string; approvalStatus: string; contentVersion: number };
	request?: { status: string } | null;
	items?: { content: { id: string } }[];
};

describe("contrato MCP: aprovação", () => {
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
					data: result.structuredContent as Structured,
				};
			},
		};
	}

	const sentCard = async () => {
		const { call } = await connect(agency);
		const created = await call("create_content", {
			company_id: "company-a",
			content: { title: "Reel", script: { hook: "Gancho" } },
		});
		const id = created.data.content?.id ?? "";
		const sent = await call("submit_for_approval", {
			company_id: "company-a",
			content_id: id,
		});
		expect(sent.isError).toBe(false);
		return { id, version: sent.data.content?.contentVersion ?? 0 };
	};

	beforeEach(() => {
		deps = {
			companies: new InMemoryCompanyRepository([
				{ id: "company-a", agencyId: "agency-1", name: "A" },
				{ id: "company-b", agencyId: "agency-1", name: "B" },
			]),
			...inMemoryContentDeps(),
			scripts: new InMemoryScriptRepository(),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			...testDiscoveryDeps(),
			now: () => new Date("2026-11-13T12:00:00Z"),
		};
	});

	it("cada lado só recebe as ferramentas que pode usar", async () => {
		const agencyTools = await (await connect(agency)).names();
		const clientTools = await (await connect(clientA)).names();
		const shared = [
			"list_pending_approvals",
			"get_approval_item",
			"get_approval_history",
			"approve_item",
		];

		expect(agencyTools).toEqual(
			expect.arrayContaining([
				...shared,
				"submit_for_approval",
				"cancel_approval_request",
				"list_items_to_submit",
				"list_rejected_items",
			]),
		);
		expect(agencyTools).not.toContain("reject_item");
		expect(clientTools).toEqual(
			expect.arrayContaining([...shared, "reject_item"]),
		);
		expect(clientTools).not.toContain("submit_for_approval");
		expect(clientTools).not.toContain("cancel_approval_request");
	});

	it("o cliente lista, vê e aprova, com o ID e a versão no texto", async () => {
		const { id, version } = await sentCard();
		const { call } = await connect(clientA);

		const pending = await call("list_pending_approvals", {});
		expect(pending.text).toContain(`ID: ${id}`);
		expect(pending.text).toContain(`versão ${version}`);
		const item = await call("get_approval_item", { content_id: id });
		expect(item.text).toContain("Gancho: Gancho");
		expect(item.text).toContain("enviado para aprovação");

		const approved = await call("approve_item", { content_id: id, version });
		expect(approved.isError).toBe(false);
		expect(approved.data.content?.approvalStatus).toBe("approved");
	});

	it("RN-214: a agência aprova em nome do cliente só com motivo", async () => {
		const { id, version } = await sentCard();
		const { call } = await connect(agency);

		const missing = await call("approve_item", {
			company_id: "company-a",
			content_id: id,
			version,
		});
		expect(missing.isError).toBe(true);
		expect(missing.text).toContain("Informe o motivo da aprovação");

		const approved = await call("approve_item", {
			company_id: "company-a",
			content_id: id,
			version,
			on_behalf_reason: "Aprovou por WhatsApp",
		});
		expect(approved.data.request?.status).toBe("approved");
		const history = await call("get_approval_history", {
			company_id: "company-a",
			content_id: id,
		});
		expect(history.text).toContain("aprovado pela agência em nome do cliente");
		expect(history.text).toContain("Aprovou por WhatsApp");
	});

	it("RN-212: o cliente recusa e a agência vê o motivo", async () => {
		const { id, version } = await sentCard();
		const rejected = await (await connect(clientA)).call("reject_item", {
			content_id: id,
			version,
			reason: "Gancho fraco",
		});
		expect(rejected.isError).toBe(false);

		const list = await (await connect(agency)).call("list_rejected_items", {
			company_id: "company-a",
		});
		expect(list.text).toContain("motivo: Gancho fraco");
	});

	it("RN-015: a empresa B não vê nem decide", async () => {
		const { id, version } = await sentCard();
		const { call } = await connect(clientB);

		const approved = await call("approve_item", { content_id: id, version });
		expect(approved.isError).toBe(true);
		expect(approved.text).toContain("Card não encontrado.");
		const pending = await call("list_pending_approvals", {});
		expect(pending.data.items).toEqual([]);
	});
});
