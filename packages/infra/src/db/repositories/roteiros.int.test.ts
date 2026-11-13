import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import {
	type ActorContext,
	createContents,
	generateScriptOptions,
	generateScripts,
	getRefineChat,
	listContentGenerations,
	NotDecidedYet,
	quotaDay,
	refineContent,
	reviewContentRefinement,
} from "@convergia/core";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFakeLlm } from "../../ai/fake-llm";
import { createLlmGateway, type LlmClient } from "../../ai/llm-gateway";
import { createScriptAi } from "../../ai/script-ai";
import { createDb } from "../client";
import {
	agencies,
	aiCallLog,
	companies,
	contentGenerations,
	contentOptionSets,
	contents,
	quotaUsage,
	refineMessages,
	users,
} from "../schema";
import { withCompany } from "../with-company";
import { createCompanyRepository } from "./company.repository";
import { createContentRepository } from "./content.repository";
import { createQuotaRepository } from "./quota.repository";
import { createScriptRepository } from "./script.repository";

describe("roteiros e cotas no Postgres", () => {
	const db = createDb(loadEnv().DATABASE_URL);
	const quotas = createQuotaRepository(db);
	const deps = {
		companies: createCompanyRepository(db),
		contents: createContentRepository(db),
		scripts: createScriptRepository(db),
		scriptAi: createScriptAi(createLlmGateway(db, createFakeLlm())),
		quotas,
		now: () => new Date(),
	};
	const run = randomUUID();
	const ids = {
		agency: "",
		companyA: "",
		companyB: "",
		clientA: "",
		clientB: "",
	};
	let actorA: ActorContext;
	let actorB: ActorContext;

	const newCard = async (title = "Sofá retrátil") => {
		const [card] = await createContents(deps, actorA, [{ title }]);
		if (!card) throw new Error("card não criado");
		return card;
	};

	beforeAll(async () => {
		const [agency] = await db
			.insert(agencies)
			.values({ name: `Agência ${run}` })
			.returning();
		ids.agency = agency?.id ?? "";
		const created = await db
			.insert(companies)
			.values([
				{ agencyId: ids.agency, name: "Móveis A" },
				{ agencyId: ids.agency, name: "B" },
			])
			.returning();
		ids.companyA = created[0]?.id ?? "";
		ids.companyB = created[1]?.id ?? "";
		const people = await db
			.insert(users)
			.values(
				[ids.companyA, ids.companyB].map((companyId, i) => ({
					agencyId: ids.agency,
					companyId,
					kind: "client_user" as const,
					name: `Cliente ${i}`,
					email: `roteiro-${i}-${run}@exemplo.test`,
				})),
			)
			.returning();
		ids.clientA = people[0]?.id ?? "";
		ids.clientB = people[1]?.id ?? "";
		const base = {
			kind: "client_user" as const,
			agencyId: ids.agency,
			scopes: ["read" as const, "write" as const],
		};
		actorA = { ...base, userId: ids.clientA, companyId: ids.companyA };
		actorB = { ...base, userId: ids.clientB, companyId: ids.companyB };
	});

	afterAll(async () => {
		const companyIds = [ids.companyA, ids.companyB];
		for (const companyId of companyIds) {
			await withCompany(db, companyId, async (tx) => {
				for (const table of [
					refineMessages,
					contentGenerations,
					contentOptionSets,
					quotaUsage,
					aiCallLog,
					contents,
				]) {
					await tx.delete(table).where(eq(table.companyId, companyId));
				}
			});
		}
		await db.delete(users).where(inArray(users.id, [ids.clientA, ids.clientB]));
		await db.delete(companies).where(inArray(companies.id, companyIds));
		await db.delete(agencies).where(eq(agencies.id, ids.agency));
		await db.$client.end();
	});

	it("RN-070, RN-072: gera o roteiro, grava no card e no histórico, e registra a chamada", async () => {
		const card = await newCard();
		const [updated] = await generateScripts(deps, actorA, [card.id]);

		expect(updated?.script.hook).toContain("sofá retrátil");
		expect(updated?.contentVersion).toBe(2);
		const [history, log] = await withCompany(db, ids.companyA, async (tx) => [
			await tx
				.select()
				.from(contentGenerations)
				.where(eq(contentGenerations.contentId, card.id)),
			await tx
				.select()
				.from(aiCallLog)
				.where(eq(aiCallLog.companyId, ids.companyA)),
		]);
		expect(history).toHaveLength(1);
		expect(log).toContainEqual(
			expect.objectContaining({
				tool: "generate_scripts",
				model: "simulado-local",
				success: true,
			}),
		);
	});

	it("RN-073, RN-074: refina em prévia, aplica uma vez e recusa prévia velha", async () => {
		const card = await newCard("Mesa de jantar");
		const first = await refineContent(deps, actorA, card.id, "mais curto");
		const second = await refineContent(deps, actorA, card.id, "mais divertido");

		const chat = await getRefineChat(deps, actorA, card.id);
		expect(chat.map((m) => [m.role, m.previewStatus])).toEqual([
			["user", null],
			["assistant", "discarded"],
			["user", null],
			["assistant", "pending"],
		]);

		const latest = second[1]?.id ?? "";
		const { content } = await reviewContentRefinement(
			deps,
			actorA,
			card.id,
			latest,
			"apply",
		);
		expect(content.script.hook).toContain("(ajustado)");
		await expect(
			reviewContentRefinement(
				deps,
				actorA,
				card.id,
				first[1]?.id ?? "",
				"apply",
			),
		).rejects.toThrow(
			"Esta prévia não está mais disponível. Peça um novo refino.",
		);
	});

	it("RN-075: refino com pesquisa grava as fontes e aplicar soma às citações do card", async () => {
		const card = await newCard("Poltrona");
		const existing = { title: "Antiga", url: "https://example.com/antiga" };
		await deps.contents.update(ids.companyA, card.id, {
			citations: [existing],
		});

		const messages = await refineContent(deps, actorA, card.id, "com dados", {
			webSearch: true,
		});
		const source = {
			title: "Fonte simulada",
			url: "https://example.com/fonte-simulada",
		};
		expect(messages[1]?.text).toContain('"com dados"');
		const chat = await getRefineChat(deps, actorA, card.id);
		expect(chat.map((m) => m.sources)).toEqual([[], [source]]);

		const { content } = await reviewContentRefinement(
			deps,
			actorA,
			card.id,
			messages[1]?.id ?? "",
			"apply",
		);
		expect(content.citations).toEqual([existing, source]);
		const [row] = await withCompany(db, ids.companyA, (tx) =>
			tx.select().from(contents).where(eq(contents.id, card.id)),
		);
		expect(row?.citations).toEqual([existing, source]);
	});

	it("RN-075: sem pedir a pesquisa, a prévia vem sem fontes", async () => {
		const card = await newCard("Puff");
		const messages = await refineContent(deps, actorA, card.id, "pedido");
		expect(messages[1]?.sources).toEqual([]);
	});

	it("RN-015: a empresa B não lê o refino nem aplica a prévia da A", async () => {
		const card = await newCard("Cadeira");
		const messages = await refineContent(deps, actorA, card.id, "pedido");
		await expect(getRefineChat(deps, actorB, card.id)).rejects.toThrow(
			"Card não encontrado.",
		);
		await expect(
			deps.scripts.findRefineMessage(
				ids.companyB,
				card.id,
				messages[1]?.id ?? "",
			),
		).resolves.toBeNull();
	});

	it("RN-300, RN-301: a reserva é atômica mesmo com chamadas simultâneas", async () => {
		const day = "2026-01-01";
		const results = await Promise.all(
			Array.from({ length: 15 }, () =>
				quotas.reserve(ids.companyA, "generate_scripts", day, 10),
			),
		);
		expect(results.filter(Boolean)).toHaveLength(10);
		await quotas.release(ids.companyA, "generate_scripts", day);
		expect(
			await quotas.reserve(ids.companyA, "generate_scripts", day, 10),
		).toBe(true);
		// A cota da B é outra linha.
		expect(
			await quotas.reserve(ids.companyB, "generate_scripts", day, 10),
		).toBe(true);
	});

	it("RN-305: falha da IA não consome cota e vira mensagem amigável", async () => {
		const failing: LlmClient = {
			model: "falha",
			complete: async () => {
				throw new Error("timeout");
			},
		};
		const card = await newCard("Estante");
		const before = await usedToday();
		await expect(
			generateScripts(
				{ ...deps, scriptAi: createScriptAi(createLlmGateway(db, failing)) },
				actorA,
				[card.id],
			),
		).rejects.toThrow(
			"A IA não conseguiu responder agora. Tente de novo em instantes.",
		);
		expect(await usedToday()).toBe(before);
		const failures = await withCompany(db, ids.companyA, (tx) =>
			tx.select().from(aiCallLog).where(eq(aiCallLog.model, "falha")),
		);
		expect(failures).toEqual([
			expect.objectContaining({ success: false, error: "timeout" }),
		]);
	});

	async function usedToday(): Promise<number> {
		const rows = await withCompany(db, ids.companyA, (tx) =>
			tx
				.select()
				.from(quotaUsage)
				.where(eq(quotaUsage.day, quotaDay(new Date()))),
		);
		return rows.find((r) => r.toolKey === "generate_scripts")?.used ?? 0;
	}

	it("Q-21: opções avulsas (RN-071) ficam bloqueadas sem chamar a IA nem reservar cota", async () => {
		const card = await newCard();
		await expect(
			generateScriptOptions(deps, actorA, card.id, "hook"),
		).rejects.toThrow(NotDecidedYet);
		const logged = await withCompany(db, ids.companyA, (tx) =>
			tx
				.select()
				.from(aiCallLog)
				.where(eq(aiCallLog.tool, "generate_hook_options")),
		);
		expect(logged).toHaveLength(0);
	});

	it("RN-071: a IA devolve opções pelo gateway e registra a chamada", async () => {
		const card = await newCard("Mesa dobrável");
		const options = await deps.scriptAi.suggestOptions(
			{ companyId: ids.companyA, tool: "generate_cta_options" },
			{ companyName: "Móveis A", content: card },
			"cta",
		);
		expect(options).toHaveLength(3);
		const [logged] = await withCompany(db, ids.companyA, (tx) =>
			tx
				.select()
				.from(aiCallLog)
				.where(eq(aiCallLog.tool, "generate_cta_options")),
		);
		expect(logged).toMatchObject({ success: true, model: "simulado-local" });
	});

	it("RN-072, RN-015: as opções vão para o histórico e o RLS só as mostra à própria empresa", async () => {
		const card = await newCard();
		await deps.scripts.addOptionSet(ids.companyA, {
			contentId: card.id,
			field: "caption",
			options: ["Legenda 1", "Legenda 2"],
			createdByUserId: ids.clientA,
			createdByKind: "client",
		});
		// Superusuário ignora o RLS; um papel comum, como o do servidor em produção, não.
		await db.execute(sql`
			do $$ begin
				if not exists (select from pg_roles where rolname = 'convergia_rls_probe') then
					create role convergia_rls_probe nologin;
				end if;
			end $$`);
		await db.execute(sql`grant usage on schema public to convergia_rls_probe`);
		await db.execute(
			sql`grant select on content_option_sets to convergia_rls_probe`,
		);
		const readAs = (companyId: string) =>
			db.transaction(async (tx) => {
				await tx.execute(sql`set local role convergia_rls_probe`);
				await tx.execute(
					sql`select set_config('app.company_id', ${companyId}, true)`,
				);
				return tx
					.select()
					.from(contentOptionSets)
					.where(eq(contentOptionSets.contentId, card.id));
			});

		expect(await readAs(ids.companyA)).toMatchObject([
			{ field: "caption", options: ["Legenda 1", "Legenda 2"] },
		]);
		expect(await readAs(ids.companyB)).toEqual([]);
	});

	it("RN-072: o histórico junta roteiros e opções, das mais novas para as mais antigas", async () => {
		const card = await newCard("Poltrona");
		await generateScripts(deps, actorA, [card.id]);
		await deps.scripts.addOptionSet(ids.companyA, {
			contentId: card.id,
			field: "hook",
			options: ["Gancho 1"],
			createdByUserId: ids.clientA,
			createdByKind: "client",
		});

		const history = await listContentGenerations(deps, actorA, card.id);

		expect(history.map((entry) => entry.kind)).toEqual(["options", "script"]);
		expect(history[1]).toMatchObject({
			kind: "script",
			contentId: card.id,
			createdByUserId: ids.clientA,
			createdByKind: "client",
		});
		await expect(listContentGenerations(deps, actorB, card.id)).rejects.toThrow(
			"Card não encontrado.",
		);
	});
});
