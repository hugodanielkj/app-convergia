import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import {
	type ActorContext,
	acceptBrainstormSuggestion,
	approveItem,
	attachContentReference,
	cancelApprovalRequest,
	createContents,
	dismissBrainstormSuggestion,
	getApprovalItem,
	listApprovalItems,
	rejectItem,
	submitForApproval,
} from "@convergia/core";
import { eq, inArray, sql } from "drizzle-orm";
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
			approvalRequests,
			cardReferences,
			contentSources,
			savedReferences,
			ideas,
			contents,
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
			sql`grant select on brainstorm_suggestions,card_references,saved_references,content_sources to convergia_rls_probe`,
		);
		await withCompany(db, otherId, async (tx) => {
			await tx.execute(sql`set local role convergia_rls_probe`);
			for (const table of [
				ideas,
				cardReferences,
				savedReferences,
				contentSources,
			])
				expect(
					await tx
						.select({ id: table.id })
						.from(table)
						.where(eq(table.companyId, companyId)),
				).toEqual([]);
		});
	});
});
