import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyA, companyB } from "../../acesso/testing/fixtures";
import { InMemoryCompanyRepository } from "../../acesso/testing/in-memory-company-repository";
import { agency, client } from "../../conteudo/testing/actors";
import { InMemoryContentRepository } from "../../conteudo/testing/in-memory-content-repository";
import { createContents } from "../../conteudo/use-cases/create-contents";
import { getContent } from "../../conteudo/use-cases/read-contents";
import { InMemoryQuotaRepository } from "../../cotas/testing/in-memory-quota-repository";
import type { ActorContext } from "../../shared/actor-context";
import { FakeScriptAi } from "../testing/fake-script-ai";
import { InMemoryScriptRepository } from "../testing/in-memory-script-repository";
import type { ScriptDeps } from "./deps";
import { generateScriptOptions } from "./generate-script-options";

// ❓ Q-21: o limite das opções ainda não foi decidido (ver roteiros.test.ts). Aqui ele é
// simulado só para testar o resto do caso de uso; não é o valor da regra.
const TEST_LIMIT = 2;
vi.mock("../../policies/quota.policy", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../policies/quota.policy")>()),
	dailyLimit: () => TEST_LIMIT,
}));

describe("opções avulsas com o limite simulado (RN-071)", () => {
	let deps: ScriptDeps & {
		contents: InMemoryContentRepository;
		scripts: InMemoryScriptRepository;
		scriptAi: FakeScriptAi;
		quotas: InMemoryQuotaRepository;
	};

	const create = async (actor: ActorContext = client) => {
		const [content] = await createContents(deps, actor, [{ title: "Sofá" }]);
		if (!content) throw new Error("card não criado");
		return content;
	};

	beforeEach(() => {
		const now = () => new Date("2026-11-13T15:00:00Z");
		deps = {
			companies: new InMemoryCompanyRepository([companyA, companyB]),
			contents: new InMemoryContentRepository(now),
			scripts: new InMemoryScriptRepository(now),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			now,
		};
	});

	it("RN-071: devolve até 3 opções da parte pedida, com o card como contexto", async () => {
		const card = await create();
		const result = await generateScriptOptions(deps, client, card.id, "hook");

		expect(result).toEqual({
			contentId: card.id,
			field: "hook",
			options: [
				"Opção 1 de hook sobre Sofá",
				"Opção 2 de hook sobre Sofá",
				"Opção 3 de hook sobre Sofá",
			],
		});
		expect(deps.scriptAi.calls[0]).toMatchObject({
			kind: "options",
			field: "hook",
			meta: { companyId: "company-a", tool: "generate_hook_options" },
			brief: { companyName: "Empresa A", content: { title: "Sofá" } },
		});
	});

	it("RN-071: respeita a quantidade pedida", async () => {
		const card = await create();
		const result = await generateScriptOptions(
			deps,
			client,
			card.id,
			"caption",
			1,
		);
		expect(result.options).toEqual(["Opção 1 de caption sobre Sofá"]);
	});

	it("RN-071: não altera o roteiro, a versão nem a aprovação do card", async () => {
		const card = await create(client);
		await generateScriptOptions(deps, agency, card.id, "body");
		const after = await getContent(deps, client, card.id);
		expect(after.script).toEqual(card.script);
		expect(after.contentVersion).toBe(card.contentVersion);
		expect(after.approvalStatus).toBe("none");
	});

	it("RN-072: as opções ficam no histórico do card", async () => {
		const card = await create();
		await generateScriptOptions(deps, client, card.id, "cta", 2);
		expect(deps.scripts.optionSets).toEqual([
			{
				companyId: "company-a",
				contentId: card.id,
				field: "cta",
				options: ["Opção 1 de cta sobre Sofá", "Opção 2 de cta sobre Sofá"],
				createdByUserId: client.userId,
			},
		]);
	});

	it("RN-300, RN-301: cada parte do roteiro tem a própria cota da empresa", async () => {
		const card = await create();
		await generateScriptOptions(deps, client, card.id, "hook");
		await generateScriptOptions(deps, agency, card.id, "hook");
		await expect(
			generateScriptOptions(deps, client, card.id, "hook"),
		).rejects.toThrow(
			`A cota diária de opções de gancho desta empresa acabou (${TEST_LIMIT} por dia). Tente amanhã.`,
		);
		await expect(
			generateScriptOptions(deps, client, card.id, "body"),
		).resolves.toMatchObject({ field: "body" });
	});

	it("RN-305: se a IA falha, nada vai para o histórico e a cota volta", async () => {
		const card = await create();
		deps.scriptAi.failWith = new Error("IA fora do ar");
		await expect(
			generateScriptOptions(deps, client, card.id, "hook"),
		).rejects.toThrow("IA fora do ar");
		expect(deps.scripts.optionSets).toHaveLength(0);
		expect([...deps.quotas.used.values()]).toEqual([0]);
	});
});
