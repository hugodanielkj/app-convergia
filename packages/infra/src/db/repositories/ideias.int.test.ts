import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import {
	type ActorContext,
	acceptBrainstormSuggestion,
	approveItem,
	attachContentReference,
	cancelApprovalRequest,
	createContents,
	deleteSavedReference,
	dismissBrainstormSuggestion,
	getApprovalItem,
	listApprovalItems,
	rejectItem,
	runCreatorDeepAnalysis,
	runReferenceJob,
	saveReferenceByUrl,
	submitForApproval,
} from "@convergia/core";
import {
	FakeReferenceAi,
	FakeReferenceProvider,
	FakeReferenceQueue,
} from "@convergia/core/testing";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import {
	agencies,
	approvalEvents,
	approvalRequests,
	cardReferences,
	companies,
	contentSources,
	contents,
	ideas,
	quotaUsage,
	referenceJobs,
	savedReferences,
	users,
} from "../schema";
import { withCompany } from "../with-company";
import { createApprovalRepository } from "./approval.repository";
import { createContentRepository } from "./content.repository";
import {
	createApprovalSubjects,
	createIdeaRepository,
} from "./idea.repository";
import { createKnowledgeRepository } from "./knowledge.repository";

describe("Ideias e aprovação no Postgres", () => {
	const db = createDb(loadEnv().DATABASE_URL);
	let agencyId = "",
		companyId = "",
		otherId = "";
	let member: ActorContext, client: ActorContext;
	const contentsRepo = createContentRepository(db);
	const ideasRepo = createIdeaRepository(db);
	const deps = {
		contents: contentsRepo,
		ideas: ideasRepo,
		approvals: createApprovalRepository(db),
		approvalSubjects: createApprovalSubjects(contentsRepo, ideasRepo),
		knowledge: createKnowledgeRepository(db),
		now: () => new Date(),
	};
	beforeAll(async () => {
		const [ag] = await db
			.insert(agencies)
			.values({ name: `Ideias ${randomUUID()}` })
			.returning();
		agencyId = ag?.id ?? "";
		const cs = await db
			.insert(companies)
			.values([
				{ agencyId, name: "A" },
				{ agencyId, name: "B" },
			])
			.returning();
		companyId = cs[0]?.id ?? "";
		otherId = cs[1]?.id ?? "";
		const us = await db
			.insert(users)
			.values([
				{
					agencyId,
					kind: "agency_member",
					name: "Agência",
					email: `agency-${randomUUID()}@example.test`,
				},
				{
					agencyId,
					companyId,
					kind: "client_user",
					name: "Cliente",
					email: `client-${randomUUID()}@example.test`,
				},
			])
			.returning();
		member = {
			agencyId,
			companyId,
			userId: us[0]?.id ?? "",
			kind: "agency_member",
			scopes: ["read", "write"],
		};
		client = { ...member, userId: us[1]?.id ?? "", kind: "client_user" };
	});
	afterAll(async () => {
		const ids = [companyId, otherId];
		for (const table of [
			approvalEvents,
			referenceJobs,
			approvalRequests,
			cardReferences,
			contentSources,
			savedReferences,
			ideas,
			contents,
			quotaUsage,
		])
			await db.delete(table).where(inArray(table.companyId, ids));
		await db.delete(users).where(eq(users.agencyId, agencyId));
		await db.delete(companies).where(eq(companies.agencyId, agencyId));
		await db.delete(agencies).where(eq(agencies.id, agencyId));
		await db.$client.end();
	});
	const draft = {
		title: "Bastidores",
		text: "Mostre os bastidores do produto",
		reason: "Aproxima o público",
	};
	async function generated() {
		const [i] = await ideasRepo.replace(member, [draft], new Date());
		if (!i) throw Error();
		return i;
	}
	it("RN-083, RN-084, RN-230: aprovação registra ideia e não cria card automaticamente", async () => {
		const idea = await generated();
		const before = (await contentsRepo.listActive(companyId)).length;
		await expect(
			acceptBrainstormSuggestion(deps, client, idea.id),
		).rejects.toThrow("aprovação");
		const submitted = await submitForApproval(deps, member, idea.id);
		expect(submitted.request?.itemType).toBe("idea");
		expect(submitted.request?.snapshot.body).toBe(draft.text);
		expect(
			(await listApprovalItems(deps, client, "pending")).some(
				(i) => i.content.id === idea.id,
			),
		).toBe(true);
		await approveItem(deps, client, idea.id, { version: 1 });
		expect((await contentsRepo.listActive(companyId)).length).toBe(before);
		const [a, b] = await Promise.all([
			acceptBrainstormSuggestion(deps, client, idea.id),
			acceptBrainstormSuggestion(deps, client, idea.id),
		]);
		expect(a.id).toBe(b.id);
		expect(a.status).toBe("idea");
		expect(a.script.body).toBeNull();
		expect((await contentsRepo.listActive(companyId)).length).toBe(before + 1);
		expect((await getApprovalItem(deps, client, idea.id)).request?.status).toBe(
			"approved",
		);
		const events = await deps.approvals.listEvents(companyId, idea.id);
		expect(events.map((e) => e.type)).toEqual(["submitted", "approved"]);
	});
	it("RN-212, RN-214, RN-218: cliente recusa, agência cancela ou aprova com motivo", async () => {
		let idea = await generated();
		await submitForApproval(deps, member, idea.id);
		await expect(
			rejectItem(deps, member, idea.id, { version: 1 }),
		).rejects.toThrow("Só o cliente");
		await rejectItem(deps, client, idea.id, {
			version: 1,
			reason: "Mudar tema",
		});
		expect((await ideasRepo.find(companyId, idea.id))?.approvalStatus).toBe(
			"rejected",
		);
		idea = await generated();
		await submitForApproval(deps, member, idea.id);
		await cancelApprovalRequest(deps, member, idea.id);
		expect((await ideasRepo.find(companyId, idea.id))?.approvalStatus).toBe(
			"in_preparation",
		);
		await submitForApproval(deps, member, idea.id);
		await expect(
			approveItem(deps, member, idea.id, { version: 1 }),
		).rejects.toThrow("motivo");
		await approveItem(deps, member, idea.id, {
			version: 1,
			onBehalfReason: "Cliente aprovou por WhatsApp",
		});
		expect(
			(await getApprovalItem(deps, client, idea.id)).request?.decidedOnBehalf,
		).toBe(true);
	});
	it("RN-080: substituir cancela os envios antigos e preserva o histórico", async () => {
		const old = await generated();
		await submitForApproval(deps, member, old.id);
		await generated();
		expect((await ideasRepo.find(companyId, old.id))?.state).toBe("dismissed");
		expect(
			(await deps.approvals.listEvents(companyId, old.id)).map((e) => e.type),
		).toEqual(["submitted", "cancelled"]);
		await expect(
			approveItem(deps, client, old.id, { version: 1 }),
		).rejects.toThrow();
	});
	it("RN-015: outra empresa não lê, converte, envia ou descarta a ideia", async () => {
		const idea = await generated();
		const other = { ...client, companyId: otherId };
		expect(await ideasRepo.find(otherId, idea.id)).toBeNull();
		expect(await ideasRepo.list(otherId)).toEqual([]);
		await expect(
			submitForApproval(deps, { ...member, companyId: otherId }, idea.id),
		).rejects.toThrow();
		await expect(
			acceptBrainstormSuggestion(deps, other, idea.id),
		).rejects.toThrow();
		await expect(
			dismissBrainstormSuggestion(deps, other, idea.id),
		).rejects.toThrow();
	});
	it("RN-068, RN-076: referência do card é isolada e não altera aprovação ou versão", async () => {
		const [card] = await createContents(deps, member, [
			{ title: "Fonte", script: { hook: "Gancho" } },
		]);
		if (!card) throw Error();
		await submitForApproval(deps, member, card.id);
		await approveItem(deps, client, card.id, { version: 1 });
		await attachContentReference(deps, member, card.id, {
			title: "Referência",
			url: "https://example.com/artigo",
			kind: "link",
		});
		expect(await deps.knowledge.listAttached(otherId, card.id)).toEqual([]);
		expect(await contentsRepo.find(companyId, card.id)).toMatchObject({
			contentVersion: 1,
			approvalStatus: "approved",
		});
	});
	it("RN-015: RLS protege ideias, fontes e referências sem superusuário", async () => {
		await generated();
		await db.execute(
			sql`do $$ begin if not exists(select from pg_roles where rolname='convergia_rls_probe') then create role convergia_rls_probe nologin; end if; end $$`,
		);
		await db.execute(sql`grant usage on schema public to convergia_rls_probe`);
		await db.execute(
			sql`grant select on reference_jobs,brainstorm_suggestions,card_references,saved_references,content_sources to convergia_rls_probe`,
		);
		await withCompany(db, otherId, async (tx) => {
			await tx.execute(sql`set local role convergia_rls_probe`);
			for (const table of [
				ideas,
				cardReferences,
				savedReferences,
				contentSources,
				referenceJobs,
			])
				expect(
					await tx
						.select({ id: table.id })
						.from(table)
						.where(eq(table.companyId, companyId)),
				).toEqual([]);
		});
	});
	it("RN-090, RN-093, RN-301: início concorrente reserva um criador e reutiliza tarefas", async () => {
		const d = {
			...deps,
			referenceProvider: new FakeReferenceProvider(),
			referenceAi: new FakeReferenceAi(),
			referenceQueue: new FakeReferenceQueue(),
			now: () => new Date("2026-11-13T15:00:00Z"),
		};
		const created = await Promise.allSettled(
			["um", "dois", "tres"].map((handle) =>
				saveReferenceByUrl(d, client, {
					url: `https://instagram.com/${handle}/`,
				}),
			),
		);
		expect(created.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		const result = created.find((r) => r.status === "fulfilled");
		if (result?.status !== "fulfilled") throw Error();
		const ref = result.value.reference;
		const duplicate = await saveReferenceByUrl(d, member, {
			url: `${ref.url}?igsh=abc`,
		});
		expect(duplicate.reference.id).toBe(ref.id);
		expect(duplicate.started).toBe(false);
		await runReferenceJob(d, companyId, result.value.job?.id ?? "");
		expect((await d.knowledge.findSaved(companyId, ref.id))?.summary).toContain(
			"simulado",
		);
		await runCreatorDeepAnalysis(d, client, ref.id);
		const next = d.referenceQueue.jobs.at(-1);
		await runReferenceJob(d, companyId, next?.id ?? "");
		expect(
			(await runCreatorDeepAnalysis(d, member, ref.id)).analysis,
		).toContain("simulada");
		const [usage] = await db
			.select()
			.from(quotaUsage)
			.where(
				and(
					eq(quotaUsage.companyId, companyId),
					eq(quotaUsage.toolKey, "run_creator_deep_analysis"),
				),
			);
		expect(usage?.used).toBe(1);
		const other = { ...client, companyId: otherId };
		expect(await d.knowledge.findSaved(otherId, ref.id)).toBeNull();
		await expect(runCreatorDeepAnalysis(d, other, ref.id)).rejects.toThrow(
			"não encontrada",
		);
		await deleteSavedReference(d, client, ref.id);
	});
	it("RN-303, RN-305: limite é atômico e falha ou exclusão devolve a reserva só uma vez", async () => {
		const d = {
			...deps,
			referenceProvider: new FakeReferenceProvider(),
			referenceAi: new FakeReferenceAi(),
			referenceQueue: new FakeReferenceQueue(),
			now: () => new Date("2026-11-14T15:00:00Z"),
		};
		const outcomes = await Promise.allSettled(
			[1, 2, 3, 4, 5].map((n) =>
				saveReferenceByUrl(d, client, {
					url: `https://instagram.com/p/teste${n}/`,
				}),
			),
		);
		expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(3);
		const first = outcomes.find((r) => r.status === "fulfilled");
		if (first?.status !== "fulfilled") throw Error();
		d.referenceProvider.fail = true;
		await runReferenceJob(d, companyId, first.value.job?.id ?? "");
		await runReferenceJob(d, companyId, first.value.job?.id ?? "");
		expect(d.referenceProvider.calls).toBe(1);
		const another = await saveReferenceByUrl(d, client, {
			url: "https://instagram.com/p/novo/",
		});
		await deleteSavedReference(d, client, another.reference.id);
		await d.knowledge.finishReferenceJob(companyId, another.job?.id ?? "", {
			error: "Tardia",
		});
		const [usage] = await db
			.select()
			.from(quotaUsage)
			.where(
				and(
					eq(quotaUsage.companyId, companyId),
					eq(quotaUsage.toolKey, "save_reference_by_url"),
					eq(quotaUsage.day, "2026-11-14"),
				),
			);
		expect(usage?.used).toBe(2);
	});
});
