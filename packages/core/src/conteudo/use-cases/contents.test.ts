import { beforeEach, describe, expect, it } from "vitest";
import type { NewContentInput } from "../content";
import {
	agency,
	client,
	otherCompanyClient,
	readOnly,
} from "../testing/actors";
import { InMemoryContentRepository } from "../testing/in-memory-content-repository";
import { createContents } from "./create-contents";
import {
	deleteContent,
	duplicateContent,
	moveContent,
	restoreContent,
	scheduleContent,
} from "./organize-content";
import {
	getCalendar,
	getContent,
	listContents,
	listDeletedContents,
} from "./read-contents";
import { updateContent } from "./update-content";

const NOT_FOUND = "Card não encontrado.";
const DAY = 86_400_000;

describe("cards", () => {
	let now: Date;
	let contents: InMemoryContentRepository;
	let deps: { contents: InMemoryContentRepository; now: () => Date };

	const create = async (
		actor = client,
		input: Partial<NewContentInput> = {},
	) => {
		const [content] = await createContents(deps, actor, [
			{ title: "Post", ...input },
		]);
		if (!content) throw new Error("card não criado");
		return content;
	};

	beforeEach(() => {
		now = new Date("2026-11-12T12:00:00Z");
		contents = new InMemoryContentRepository(() => now);
		deps = { contents, now: () => now };
	});

	describe("criar", () => {
		it("RN-064: cria um card na coluna ideia, no fim, sem data", async () => {
			const first = await create();
			const second = await create();

			expect(first).toMatchObject({
				status: "idea",
				plannedDate: null,
				platform: "instagram",
				contentVersion: 1,
				createdByKind: "client",
				approvalStatus: "none",
			});
			expect(second.position).toBeGreaterThan(first.position);
		});

		it("RN-203: card criado pela agência nasce em preparo", async () => {
			expect((await create(agency)).approvalStatus).toBe("in_preparation");
		});

		it("RN-064: cria de 1 a 20 cards por vez", async () => {
			const many = Array.from({ length: 20 }, (_, i) => ({
				title: `Post ${i}`,
			}));
			expect(await createContents(deps, client, many)).toHaveLength(20);

			await expect(
				createContents(deps, client, [...many, { title: "21" }]),
			).rejects.toThrow("Crie de 1 a 20 cards por vez.");
			await expect(createContents(deps, client, [])).rejects.toThrow(
				"Crie de 1 a 20 cards por vez.",
			);
		});

		it("RN-024: conexão só de leitura não cria", async () => {
			await expect(
				createContents(deps, readOnly, [{ title: "x" }]),
			).rejects.toThrow(
				"Esta conexão é só de leitura. Reconecte com permissão de escrita.",
			);
		});
	});

	describe("isolamento", () => {
		it("RN-015: outra empresa não lê nem altera o card", async () => {
			const content = await create();

			await expect(
				getContent(deps, otherCompanyClient, content.id),
			).rejects.toThrow(NOT_FOUND);
			await expect(
				updateContent(deps, otherCompanyClient, content.id, { title: "x" }),
			).rejects.toThrow(NOT_FOUND);
			await expect(
				moveContent(deps, otherCompanyClient, content.id, { status: "draft" }),
			).rejects.toThrow(NOT_FOUND);
			await expect(
				deleteContent(deps, otherCompanyClient, content.id),
			).rejects.toThrow(NOT_FOUND);
			expect(await listContents(deps, otherCompanyClient)).toEqual([]);
		});
	});

	describe("editar", () => {
		it("RN-203: mudar título não é mexida de conteúdo", async () => {
			const content = await create(client);

			const updated = await updateContent(deps, agency, content.id, {
				title: "Novo",
			});

			expect(updated).toMatchObject({
				title: "Novo",
				contentVersion: 1,
				approvalStatus: "none",
			});
		});

		it("RN-203: a agência mexer no roteiro do cliente exige aprovação", async () => {
			const content = await create(client);

			const updated = await updateContent(deps, agency, content.id, {
				script: { hook: "Gancho" },
			});

			expect(updated).toMatchObject({
				script: { hook: "Gancho", body: null },
				contentVersion: 2,
				approvalStatus: "in_preparation",
			});
		});

		it("RN-204: o cliente edita o próprio roteiro sem aprovação", async () => {
			const content = await create(client);

			const updated = await updateContent(deps, client, content.id, {
				script: { body: "Corpo" },
			});

			expect(updated).toMatchObject({
				contentVersion: 2,
				approvalStatus: "none",
			});
		});

		it("roteiro igual ao atual não conta como mudança", async () => {
			const content = await create(client, { script: { hook: "Igual" } });

			const updated = await updateContent(deps, agency, content.id, {
				script: { hook: "Igual" },
			});

			expect(updated).toMatchObject({
				contentVersion: 1,
				approvalStatus: "none",
			});
		});

		it("Q-26: o cliente editar roteiro que a agência mexeu está em aberto", async () => {
			const content = await create(agency);

			await expect(
				updateContent(deps, client, content.id, { script: { hook: "x" } }),
			).rejects.toThrow("Q-26");
		});

		it("o cliente pode mudar o título de card da agência", async () => {
			const content = await create(agency);

			expect(
				(await updateContent(deps, client, content.id, { title: "T" })).title,
			).toBe("T");
		});
	});

	describe("kanban", () => {
		it("RN-061: move de coluna para o fim, sem mexer no conteúdo", async () => {
			const a = await create(client, { status: "draft" });
			const b = await create(client);

			const moved = await moveContent(deps, client, b.id, { status: "draft" });

			expect(moved).toMatchObject({ status: "draft", contentVersion: 1 });
			expect(moved.position).toBeGreaterThan(a.position);
		});

		it("reordena dentro da coluna pelo índice", async () => {
			const a = await create();
			const b = await create();
			const c = await create();

			await moveContent(deps, client, c.id, { status: "idea", index: 0 });
			await moveContent(deps, client, a.id, { status: "idea", index: 1 });

			const order = (await listContents(deps, client, { status: "idea" })).map(
				(x) => x.id,
			);
			expect(order).toEqual([c.id, a.id, b.id]);
		});

		it("RN-061: card só do cliente vai para publicado", async () => {
			const content = await create(client);

			expect(
				(await moveContent(deps, client, content.id, { status: "published" }))
					.status,
			).toBe("published");
		});

		it("RN-061: card com roteiro da agência não aprovado não vai para publicado", async () => {
			const content = await create(agency);

			await expect(
				moveContent(deps, agency, content.id, { status: "published" }),
			).rejects.toThrow(
				"Este card só pode ir para publicado depois que o cliente aprovar o roteiro.",
			);
			expect(
				(await moveContent(deps, agency, content.id, { status: "edited" }))
					.status,
			).toBe("edited");
		});

		it("RN-061: card com roteiro aprovado vai para publicado", async () => {
			const content = await create(agency);
			await contents.update("company-a", content.id, {
				approvalStatus: "approved",
			});

			expect(
				(await moveContent(deps, agency, content.id, { status: "published" }))
					.status,
			).toBe("published");
		});
	});

	describe("calendário", () => {
		it("RN-062: agendar só define a data", async () => {
			const content = await create();

			const scheduled = await scheduleContent(
				deps,
				client,
				content.id,
				"2026-11-20",
			);

			expect(scheduled).toMatchObject({
				plannedDate: "2026-11-20",
				status: "idea",
				contentVersion: 1,
			});
			expect(
				(await scheduleContent(deps, client, content.id, null)).plannedDate,
			).toBeNull();
		});

		it("lista os cards com data no intervalo", async () => {
			const inside = await create(client, { plannedDate: "2026-11-15" });
			await create(client, { plannedDate: "2026-12-15" });
			await create(client);

			const calendar = await getCalendar(deps, client, {
				from: "2026-11-01",
				to: "2026-11-30",
			});

			expect(calendar.map((c) => c.id)).toEqual([inside.id]);
		});
	});

	describe("duplicar", () => {
		it("RN-065: copia o conteúdo para o fim da coluna ideia, sem data", async () => {
			const original = await create(client, {
				status: "edited",
				plannedDate: "2026-11-20",
				script: { hook: "Gancho" },
			});

			const copy = await duplicateContent(deps, client, original.id);

			expect(copy).toMatchObject({
				title: "Post",
				script: { hook: "Gancho" },
				status: "idea",
				plannedDate: null,
				contentVersion: 1,
			});
			expect(copy.id).not.toBe(original.id);
		});
	});

	describe("lixeira", () => {
		it("RN-069: excluir manda para a lixeira e some das listas", async () => {
			const content = await create();

			await deleteContent(deps, client, content.id);

			expect(await listContents(deps, client)).toEqual([]);
			await expect(getContent(deps, client, content.id)).rejects.toThrow(
				NOT_FOUND,
			);
			expect(
				(await listDeletedContents(deps, client)).map((c) => c.id),
			).toEqual([content.id]);
		});

		it("RN-069: restaura em até 30 dias", async () => {
			const content = await create();
			await deleteContent(deps, client, content.id);
			now = new Date(now.getTime() + 29 * DAY);

			const restored = await restoreContent(deps, client, content.id);

			expect(restored.deletedAt).toBeNull();
			expect(await listContents(deps, client)).toHaveLength(1);
		});

		it("RN-069: depois de 30 dias não restaura nem aparece na lixeira", async () => {
			const content = await create();
			await deleteContent(deps, client, content.id);
			now = new Date(now.getTime() + 31 * DAY);

			expect(await listDeletedContents(deps, client)).toEqual([]);
			await expect(restoreContent(deps, client, content.id)).rejects.toThrow(
				"Este card ficou mais de 30 dias na lixeira e não pode mais ser restaurado.",
			);
		});

		it("RN-018: a agência exclui card criado pelo cliente", async () => {
			const content = await create(client);

			expect((await deleteContent(deps, agency, content.id)).deletedAt).toEqual(
				now,
			);
		});

		it("RN-018: o cliente não exclui card criado pela agência", async () => {
			const content = await create(agency);

			await expect(deleteContent(deps, client, content.id)).rejects.toThrow(
				"Só a agência pode excluir um card criado por ela.",
			);
		});

		it("RN-015: outra empresa não restaura", async () => {
			const content = await create();
			await deleteContent(deps, client, content.id);

			await expect(
				restoreContent(deps, otherCompanyClient, content.id),
			).rejects.toThrow(NOT_FOUND);
		});
	});
});
