import type { ActorContext } from "@convergia/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { buildMcpServer } from "../registry";

const actor: ActorContext = {
	userId: "user-1",
	kind: "agency_member",
	agencyId: "agency-1",
	companyId: "company-9",
	scopes: ["read"],
};

async function connect(as: ActorContext) {
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "contract-test", version: "0.0.0" });
	await Promise.all([
		buildMcpServer(as).connect(serverTransport),
		client.connect(clientTransport),
	]);
	return client;
}

describe("contrato MCP", () => {
	it("toda ferramenta tem nome em snake_case, descrição e schema de entrada", async () => {
		const { tools } = await (await connect(actor)).listTools();

		expect(tools.length).toBeGreaterThan(0);
		for (const tool of tools) {
			expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
			expect(tool.description?.length ?? 0).toBeGreaterThan(20);
			expect(tool.inputSchema.type).toBe("object");
		}
	});

	it("whoami devolve o contexto do ator em texto e em dados estruturados", async () => {
		const result = await (await connect(actor)).callTool({ name: "whoami" });

		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toEqual(actor);
		expect(result.content).toEqual([
			{
				type: "text",
				text: "Você é membro da agência (usuário user-1), operando na empresa company-9. Permissões: leitura.",
			},
		]);
	});
});
