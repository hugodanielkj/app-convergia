import { beforeEach, describe, expect, it } from "vitest";
import { companyA, companyB } from "../../acesso/testing/fixtures";
import { InMemoryCompanyRepository } from "../../acesso/testing/in-memory-company-repository";
import type { Citation, Content } from "../../conteudo/content";
import {
	agency,
	client,
	otherCompanyClient,
	readOnly,
} from "../../conteudo/testing/actors";
import { InMemoryContentRepository } from "../../conteudo/testing/in-memory-content-repository";
import { createContents } from "../../conteudo/use-cases/create-contents";
import {
	deleteContent,
	duplicateContent,
} from "../../conteudo/use-cases/organize-content";
import { updateContent } from "../../conteudo/use-cases/update-content";
import { InMemoryQuotaRepository } from "../../cotas/testing/in-memory-quota-repository";
import type { ActorContext } from "../../shared/actor-context";
import { NotDecidedYet } from "../../shared/domain-error";
import { FakeScriptAi } from "../testing/fake-script-ai";
import { InMemoryScriptRepository } from "../testing/in-memory-script-repository";
import type { ScriptDeps } from "./deps";
import { generateScriptOptions } from "./generate-script-options";
import { generateScripts } from "./generate-scripts";
import {
	getRefineChat,
	refineContent,
	reviewContentRefinement,
} from "./refine-content";

const NOT_FOUND = "Card não encontrado.";

describe("roteiros", () => {
	let deps: ScriptDeps & {
		contents: InMemoryContentRepository;
		scripts: InMemoryScriptRepository;
		scriptAi: FakeScriptAi;
		quotas: InMemoryQuotaRepository;
	};

	const create = async (actor: ActorContext = client, title = "Sofá novo") => {
		const [content] = await createContents(deps, actor, [{ title }]);
		if (!content) throw new Error("card não criado");
		return content;
	};
	const setCitations = (citations: Citation[]) => {
		const [row] = deps.contents.rows;
		if (!row) throw new Error("card não criado");
		row.citations = citations;
	};
	const latestPreview = (messages: { id: string; role: string }[]) => {
		const reply = messages.find((m) => m.role === "assistant");
		if (!reply) throw new Error("sem resposta da IA");
		return reply.id;
	};

	beforeEach(() => {
		const now = () => new Date("2026-11-12T15:00:00Z");
		deps = {
			companies: new InMemoryCompanyRepository([companyA, companyB]),
			contents: new InMemoryContentRepository(now),
			scripts: new InMemoryScriptRepository(now),
			scriptAi: new FakeScriptAi(),
			quotas: new InMemoryQuotaRepository(),
			now,
		};
	});

	describe("gerar roteiro", () => {
		it("RN-070: grava gancho, corpo, CTA e legenda no card e incrementa a versão", async () => {
			const card = await create();
			const [updated] = await generateScripts(deps, client, [card.id]);

			expect(updated?.script).toEqual({
				hook: "Gancho sobre Sofá novo",
				body: "Corpo sobre Sofá novo",
				cta: "Salve este post",
				caption: "Legenda sobre Sofá novo",
			});
			expect(updated?.contentVersion).toBe(card.contentVersion + 1);
		});

		it("RN-076: a IA recebe o card e o nome da empresa como contexto", async () => {
			const card = await create();
			await generateScripts(deps, client, [card.id]);
			expect(deps.scriptAi.calls[0]?.brief).toMatchObject({
				companyName: "Empresa A",
				content: { title: "Sofá novo" },
			});
			expect(deps.scriptAi.calls[0]?.meta).toEqual({
				companyId: "company-a",
				tool: "generate_scripts",
			});
		});

		it("RN-072: cada geração fica no histórico do card", async () => {
			const card = await create();
			await generateScripts(deps, client, [card.id]);
			await generateScripts(deps, client, [card.id]);
			expect(deps.scripts.generations).toHaveLength(2);
			expect(deps.scripts.generations[0]).toMatchObject({
				companyId: "company-a",
				contentId: card.id,
				createdByUserId: client.userId,
			});
		});

		it("RN-070: gera de 1 a 5 cards por chamada, com uma unidade de cota", async () => {
			const cards = await Promise.all(
				["a", "b", "c", "d", "e"].map((t) => create(client, t)),
			);
			const updated = await generateScripts(
				deps,
				client,
				cards.map((c) => c.id),
			);
			expect(updated).toHaveLength(5);
			expect([...deps.quotas.used.values()]).toEqual([1]);

			const sixth = await create(client, "f");
			await expect(
				generateScripts(deps, client, [...cards.map((c) => c.id), sixth.id]),
			).rejects.toThrow("Gere roteiros para 1 a 5 cards por vez.");
			await expect(generateScripts(deps, client, [])).rejects.toThrow(
				"Gere roteiros para 1 a 5 cards por vez.",
			);
		});

		it("RN-203: roteiro gerado pela agência fica em preparo", async () => {
			const card = await create(client);
			const [updated] = await generateScripts(deps, agency, [card.id]);
			expect(updated?.approvalStatus).toBe("in_preparation");
		});

		it("RN-204: roteiro gerado pelo cliente no próprio card não pede aprovação", async () => {
			const card = await create(client);
			const [updated] = await generateScripts(deps, client, [card.id]);
			expect(updated?.approvalStatus).toBe("none");
		});

		it("RN-217: o cliente não gera roteiro em item enviado pela agência", async () => {
			const card = await create(agency);
			deps.contents.rows[0] = {
				...(deps.contents.rows[0] as Content),
				approvalStatus: "pending",
			};
			await expect(generateScripts(deps, client, [card.id])).rejects.toThrow(
				"Este item foi enviado pela agência. Aprove ou recuse com um comentário.",
			);
			expect(deps.scriptAi.calls).toHaveLength(0);
		});

		it("Q-26: o cliente gerar roteiro em card mexido pela agência está em aberto", async () => {
			const card = await create(agency);
			await expect(generateScripts(deps, client, [card.id])).rejects.toThrow(
				NotDecidedYet,
			);
		});

		it("RN-015: não gera roteiro em card de outra empresa nem na lixeira", async () => {
			const card = await create();
			await expect(
				generateScripts(deps, otherCompanyClient, [card.id]),
			).rejects.toThrow(NOT_FOUND);
			await deleteContent(deps, client, card.id);
			await expect(generateScripts(deps, client, [card.id])).rejects.toThrow(
				NOT_FOUND,
			);
			expect(deps.scriptAi.calls).toHaveLength(0);
		});

		it("RN-024: conexão só de leitura não gera", async () => {
			const card = await create();
			await expect(generateScripts(deps, readOnly, [card.id])).rejects.toThrow(
				"Esta conexão é só de leitura. Reconecte com permissão de escrita.",
			);
		});

		it("RN-305: se a IA falha, nada é gravado e a cota volta", async () => {
			const card = await create();
			deps.scriptAi.failWith = new Error("IA fora do ar");
			await expect(generateScripts(deps, client, [card.id])).rejects.toThrow(
				"IA fora do ar",
			);
			expect(deps.contents.rows[0]?.contentVersion).toBe(card.contentVersion);
			expect(deps.scripts.generations).toHaveLength(0);
			expect([...deps.quotas.used.values()]).toEqual([0]);
		});

		it("RN-300: depois de 10 gerações no dia, a 11ª é recusada sem chamar a IA", async () => {
			const card = await create();
			for (let i = 0; i < 10; i++) {
				await generateScripts(deps, client, [card.id]);
			}
			await expect(generateScripts(deps, agency, [card.id])).rejects.toThrow(
				"A cota diária de gerar roteiro desta empresa acabou (10 por dia). Tente amanhã.",
			);
			expect(deps.scriptAi.calls).toHaveLength(10);
		});
	});

	describe("refinar", () => {
		it("RN-073: o refino gera uma prévia e não altera o roteiro", async () => {
			const card = await create();
			const messages = await refineContent(
				deps,
				client,
				card.id,
				"gancho mais curto",
			);

			expect(messages.map((m) => [m.role, m.text])).toEqual([
				["user", "gancho mais curto"],
				["assistant", "Ajustei: gancho mais curto"],
			]);
			expect(messages[1]).toMatchObject({
				previewStatus: "pending",
				previewBaseVersion: card.contentVersion,
				preview: { hook: "Novo gancho (gancho mais curto)" },
			});
			expect(deps.contents.rows[0]?.script.hook).toBeNull();
			expect(deps.contents.rows[0]?.contentVersion).toBe(card.contentVersion);
		});

		it("RN-006: a conversa continua com o histórico e a prévia anterior", async () => {
			const card = await create();
			await refineContent(deps, client, card.id, "primeiro");
			await refineContent(deps, client, card.id, "segundo");

			const history = deps.scriptAi.calls[1]?.history ?? [];
			expect(history.map((t) => t.text)).toEqual([
				"primeiro",
				"Ajustei: primeiro",
			]);
			expect(history[1]?.preview?.hook).toBe("Novo gancho (primeiro)");

			const chat = await getRefineChat(deps, client, card.id);
			expect(chat).toHaveLength(4);
			// Só a prévia mais nova continua pendente.
			expect(chat.map((m) => m.previewStatus)).toEqual([
				null,
				"discarded",
				null,
				"pending",
			]);
		});

		it("RN-303: refinar consome a cota de refino, 30 por dia", async () => {
			const card = await create();
			for (let i = 0; i < 30; i++) {
				await refineContent(deps, client, card.id, `pedido ${i}`);
			}
			await expect(
				refineContent(deps, client, card.id, "mais um"),
			).rejects.toThrow(
				"A cota diária de refinar roteiro desta empresa acabou (30 por dia). Tente amanhã.",
			);
		});

		it("RN-305: refino que falha não grava mensagem e devolve a cota", async () => {
			const card = await create();
			deps.scriptAi.failWith = new Error("IA fora do ar");
			await expect(
				refineContent(deps, client, card.id, "pedido"),
			).rejects.toThrow("IA fora do ar");
			expect(deps.scripts.messages).toHaveLength(0);
			expect([...deps.quotas.used.values()]).toEqual([0]);
		});

		it("RN-015: não refina nem lê o refino de card de outra empresa", async () => {
			const card = await create();
			await refineContent(deps, client, card.id, "pedido");
			await expect(
				refineContent(deps, otherCompanyClient, card.id, "pedido"),
			).rejects.toThrow(NOT_FOUND);
			await expect(
				getRefineChat(deps, otherCompanyClient, card.id),
			).rejects.toThrow(NOT_FOUND);
		});
	});

	describe("aplicar ou descartar a prévia", () => {
		it("RN-073: aplicar troca o roteiro sem nova chamada de IA", async () => {
			const card = await create();
			const messages = await refineContent(deps, client, card.id, "pedido");
			const { content, message } = await reviewContentRefinement(
				deps,
				client,
				card.id,
				latestPreview(messages),
				"apply",
			);
			expect(content.script.hook).toBe("Novo gancho (pedido)");
			expect(content.contentVersion).toBe(card.contentVersion + 1);
			expect(message.previewStatus).toBe("applied");
			expect(deps.scriptAi.calls).toHaveLength(1);
		});

		it("RN-203: prévia aplicada pela agência deixa o roteiro em preparo", async () => {
			const card = await create(client);
			const messages = await refineContent(deps, agency, card.id, "pedido");
			const { content } = await reviewContentRefinement(
				deps,
				agency,
				card.id,
				latestPreview(messages),
				"apply",
			);
			expect(content.approvalStatus).toBe("in_preparation");
		});

		it("RN-073: descartar não muda o card", async () => {
			const card = await create();
			const messages = await refineContent(deps, client, card.id, "pedido");
			const { content, message } = await reviewContentRefinement(
				deps,
				client,
				card.id,
				latestPreview(messages),
				"discard",
			);
			expect(message.previewStatus).toBe("discarded");
			expect(content.contentVersion).toBe(card.contentVersion);
			expect(content.script.hook).toBeNull();
		});

		it("RN-074: aplicar é recusado se o card mudou depois da prévia", async () => {
			const card = await create();
			const messages = await refineContent(deps, client, card.id, "pedido");
			await updateContent(deps, client, card.id, {
				script: { cta: "Comente aqui" },
			});
			await expect(
				reviewContentRefinement(
					deps,
					client,
					card.id,
					latestPreview(messages),
					"apply",
				),
			).rejects.toThrow("O card mudou depois desta prévia. Gere uma nova.");
		});

		it("prévia já usada ou substituída não pode ser aplicada", async () => {
			const card = await create();
			const first = await refineContent(deps, client, card.id, "primeiro");
			await refineContent(deps, client, card.id, "segundo");
			await expect(
				reviewContentRefinement(
					deps,
					client,
					card.id,
					latestPreview(first),
					"apply",
				),
			).rejects.toThrow(
				"Esta prévia não está mais disponível. Peça um novo refino.",
			);
		});

		it("RN-015: não aplica prévia de card de outra empresa", async () => {
			const card = await create();
			const messages = await refineContent(deps, client, card.id, "pedido");
			await expect(
				reviewContentRefinement(
					deps,
					otherCompanyClient,
					card.id,
					latestPreview(messages),
					"apply",
				),
			).rejects.toThrow(NOT_FOUND);
		});
	});

	describe("refino com pesquisa na web (RN-075)", () => {
		const source = {
			title: "Fonte sobre pedido",
			url: "https://example.com/fonte",
		};

		it("RN-075: sem pedir, o refino não pesquisa nem devolve fontes", async () => {
			const card = await create();
			const messages = await refineContent(deps, client, card.id, "pedido");
			expect(deps.scriptAi.calls[0]?.webSearch).toBe(false);
			expect(messages.map((m) => m.sources)).toEqual([[], []]);
		});

		it("RN-075: com pesquisa, a prévia traz as fontes e não altera o card", async () => {
			const card = await create();
			const messages = await refineContent(deps, client, card.id, "pedido", {
				webSearch: true,
			});
			expect(deps.scriptAi.calls[0]?.webSearch).toBe(true);
			expect(messages[1]?.sources).toEqual([source]);
			expect(deps.contents.rows[0]?.citations).toEqual([]);
		});

		it("RN-075: a IA recebe as citações do card e as fontes da conversa", async () => {
			const card = await create();
			setCitations([{ title: "Antiga", url: "https://example.com/antiga" }]);
			await refineContent(deps, client, card.id, "pedido", { webSearch: true });
			await refineContent(deps, client, card.id, "outro");

			const second = deps.scriptAi.calls[1];
			expect(second?.brief.content.citations).toEqual([
				{ title: "Antiga", url: "https://example.com/antiga" },
			]);
			expect(second?.history?.[1]?.sources).toEqual([source]);
		});

		it("RN-075: aplicar soma as fontes novas e preserva as citações existentes", async () => {
			const card = await create();
			const existing = [
				{ title: "Antiga", url: "https://example.com/antiga" },
				{ title: "Mesma fonte", url: "https://example.com/fonte/" },
			];
			setCitations(existing);
			deps.scriptAi.sources = [
				source,
				{ title: "Nova", url: "https://example.com/nova" },
			];
			const messages = await refineContent(deps, client, card.id, "pedido", {
				webSearch: true,
			});
			const { content } = await reviewContentRefinement(
				deps,
				client,
				card.id,
				latestPreview(messages),
				"apply",
			);
			expect(content.citations).toEqual([
				...existing,
				{ title: "Nova", url: "https://example.com/nova" },
			]);
		});

		it("RN-075: aplicar prévia sem fontes mantém as citações do card", async () => {
			const card = await create();
			const existing = [{ title: "Antiga", url: "https://example.com/antiga" }];
			setCitations(existing);
			const messages = await refineContent(deps, client, card.id, "pedido");
			const { content } = await reviewContentRefinement(
				deps,
				client,
				card.id,
				latestPreview(messages),
				"apply",
			);
			expect(content.citations).toEqual(existing);
		});

		it("RN-075: descartar a prévia não leva as fontes para o card", async () => {
			const card = await create();
			const messages = await refineContent(deps, client, card.id, "pedido", {
				webSearch: true,
			});
			const { content } = await reviewContentRefinement(
				deps,
				client,
				card.id,
				latestPreview(messages),
				"discard",
			);
			expect(content.citations).toEqual([]);
		});

		it("RN-065: duplicar o card copia as citações", async () => {
			const card = await create();
			setCitations([{ title: "Antiga", url: "https://example.com/antiga" }]);
			const copy = await duplicateContent(deps, client, card.id);
			expect(copy.citations).toEqual(deps.contents.rows[0]?.citations);
		});
	});

	describe("opções avulsas (RN-071)", () => {
		it("Q-21: a cota das opções ainda não foi decidida, então nada é gerado", async () => {
			const card = await create();
			await expect(
				generateScriptOptions(deps, client, card.id, "hook"),
			).rejects.toThrow(NotDecidedYet);
			expect(deps.scriptAi.calls).toHaveLength(0);
			expect(deps.scripts.optionSets).toHaveLength(0);
			expect([...deps.quotas.used.values()]).toEqual([]);
		});

		it("RN-015: não gera opções em card de outra empresa nem na lixeira", async () => {
			const card = await create();
			await expect(
				generateScriptOptions(deps, otherCompanyClient, card.id, "hook"),
			).rejects.toThrow(NOT_FOUND);
			await deleteContent(deps, client, card.id);
			await expect(
				generateScriptOptions(deps, client, card.id, "hook"),
			).rejects.toThrow(NOT_FOUND);
		});

		it("RN-024: conexão só de leitura não gera opções", async () => {
			const card = await create();
			await expect(
				generateScriptOptions(deps, readOnly, card.id, "cta"),
			).rejects.toThrow(
				"Esta conexão é só de leitura. Reconecte com permissão de escrita.",
			);
		});

		it("RN-071: pede de 1 a 3 opções por vez", async () => {
			const card = await create();
			for (const count of [0, 4, 1.5]) {
				await expect(
					generateScriptOptions(deps, client, card.id, "hook", count),
				).rejects.toThrow("Peça de 1 a 3 opções por vez.");
			}
		});
	});
});
