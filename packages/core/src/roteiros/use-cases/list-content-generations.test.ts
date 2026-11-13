import { beforeEach, describe, expect, it } from "vitest";
import { companyA, companyB } from "../../acesso/testing/fixtures";
import { InMemoryCompanyRepository } from "../../acesso/testing/in-memory-company-repository";
import {
	agency,
	client,
	otherCompanyClient,
	readOnly,
} from "../../conteudo/testing/actors";
import { InMemoryContentRepository } from "../../conteudo/testing/in-memory-content-repository";
import { createContents } from "../../conteudo/use-cases/create-contents";
import { deleteContent } from "../../conteudo/use-cases/organize-content";
import { InMemoryQuotaRepository } from "../../cotas/testing/in-memory-quota-repository";
import type { ActorContext } from "../../shared/actor-context";
import { NotDecidedYet } from "../../shared/domain-error";
import { HISTORY_LIMIT } from "../history";
import { FakeScriptAi } from "../testing/fake-script-ai";
import { InMemoryScriptRepository } from "../testing/in-memory-script-repository";
import type { ScriptDeps } from "./deps";
import { generateScripts } from "./generate-scripts";
import { listContentGenerations } from "./list-content-generations";

describe("histórico de gerações do card (RN-072)", () => {
	let deps: ScriptDeps & { scripts: InMemoryScriptRepository };

	const create = async (actor: ActorContext = client) => {
		const [content] = await createContents(deps, actor, [{ title: "Sofá" }]);
		if (!content) throw new Error("card não criado");
		return content;
	};
	const addOptions = (contentId: string, createdByKind: "agency" | "client") =>
		deps.scripts.addOptionSet("company-a", {
			contentId,
			field: "hook",
			options: ["Gancho 1", "Gancho 2"],
			createdByUserId:
				createdByKind === "agency" ? agency.userId : client.userId,
			createdByKind,
		});

	beforeEach(() => {
		let tick = 0;
		const now = () => new Date(Date.UTC(2026, 10, 13, 12, 0, tick++));
		deps = {
			companies: new InMemoryCompanyRepository([companyA, companyB]),
			contents: new InMemoryContentRepository(now),
			scripts: new InMemoryScriptRepository(now),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			now,
		};
	});

	it("RN-072: card sem gerações tem o histórico vazio", async () => {
		const card = await create();
		expect(await listContentGenerations(deps, client, card.id)).toEqual([]);
	});

	it("RN-072: roteiros completos e opções avulsas, das mais novas para as mais antigas", async () => {
		const card = await create();
		await generateScripts(deps, client, [card.id]);
		await addOptions(card.id, "client");

		const history = await listContentGenerations(deps, client, card.id);

		expect(history.map((entry) => entry.kind)).toEqual(["options", "script"]);
		expect(history[0]).toMatchObject({
			kind: "options",
			field: "hook",
			options: ["Gancho 1", "Gancho 2"],
			createdByKind: "client",
		});
		expect(history[1]).toMatchObject({
			kind: "script",
			contentId: card.id,
			createdByUserId: client.userId,
			createdByKind: "client",
			script: { hook: "Gancho sobre Sofá" },
		});
		const [newest, oldest] = history;
		expect(newest && oldest && newest.createdAt > oldest.createdAt).toBe(true);
	});

	it("RN-072: devolve só as gerações mais recentes até o limite", async () => {
		const card = await create();
		for (let i = 0; i <= HISTORY_LIMIT; i++)
			await addOptions(card.id, "client");
		const history = await listContentGenerations(deps, client, card.id);
		expect(history).toHaveLength(HISTORY_LIMIT);
		expect(history[0]?.id).toBe(`gen-${HISTORY_LIMIT + 1}`);
	});

	it("RN-072: conexão só de leitura também vê o histórico", async () => {
		const card = await create();
		await generateScripts(deps, client, [card.id]);
		expect(await listContentGenerations(deps, readOnly, card.id)).toHaveLength(
			1,
		);
	});

	it("RN-015: não mostra o histórico de card de outra empresa nem na lixeira", async () => {
		const card = await create();
		await expect(
			listContentGenerations(deps, otherCompanyClient, card.id),
		).rejects.toThrow("Card não encontrado.");
		await deleteContent(deps, client, card.id);
		await expect(listContentGenerations(deps, client, card.id)).rejects.toThrow(
			"Card não encontrado.",
		);
	});

	it("RN-231: a agência vê o histórico com o trabalho dela", async () => {
		const card = await create();
		await generateScripts(deps, agency, [card.id]);
		const history = await listContentGenerations(deps, agency, card.id);
		expect(history[0]?.createdByKind).toBe("agency");
	});

	it("Q-23: se o cliente vê o trabalho da agência no histórico está em aberto", async () => {
		const card = await create();
		await generateScripts(deps, client, [card.id]);
		await addOptions(card.id, "agency");
		await expect(listContentGenerations(deps, client, card.id)).rejects.toThrow(
			NotDecidedYet,
		);
	});
});
