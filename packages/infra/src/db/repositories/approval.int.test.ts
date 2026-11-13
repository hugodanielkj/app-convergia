import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import {
	type ActorContext,
	approveItem,
	cancelApprovalRequest,
	createContents,
	getApprovalItem,
	listApprovalItems,
	rejectItem,
	submitForApproval,
	updateContent,
} from "@convergia/core";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import {
	agencies,
	approvalEvents,
	approvalRequests,
	companies,
	contents,
	users,
} from "../schema";
import { createApprovalRepository } from "./approval.repository";
import { createContentRepository } from "./content.repository";

describe("repositório de aprovações", () => {
	const db = createDb(loadEnv().DATABASE_URL);
	const deps = {
		contents: createContentRepository(db),
		approvals: createApprovalRepository(db),
		now: () => new Date(),
	};
	const run = randomUUID();
	const ids = {
		agency: "",
		companyA: "",
		companyB: "",
		member: "",
		client: "",
	};
	let agency: ActorContext;
	let client: ActorContext;
	let otherClient: ActorContext;

	beforeAll(async () => {
		const [agencyRow] = await db
			.insert(agencies)
			.values({ name: `Agência ${run}` })
			.returning();
		ids.agency = agencyRow?.id ?? "";
		const created = await db
			.insert(companies)
			.values([
				{ agencyId: ids.agency, name: "A" },
				{ agencyId: ids.agency, name: "B" },
			])
			.returning();
		ids.companyA = created[0]?.id ?? "";
		ids.companyB = created[1]?.id ?? "";
		const people = await db
			.insert(users)
			.values([
				{
					agencyId: ids.agency,
					kind: "agency_member",
					name: "Ana da Agência",
					email: `ana-${run}@exemplo.test`,
				},
				{
					agencyId: ids.agency,
					companyId: ids.companyA,
					kind: "client_user",
					name: "Carla Cliente",
					email: `carla-${run}@exemplo.test`,
				},
			])
			.returning();
		ids.member = people[0]?.id ?? "";
		ids.client = people[1]?.id ?? "";
		const scopes: ActorContext["scopes"] = ["read", "write"];
		agency = {
			userId: ids.member,
			kind: "agency_member",
			agencyId: ids.agency,
			companyId: ids.companyA,
			scopes,
		};
		client = {
			userId: ids.client,
			kind: "client_user",
			agencyId: ids.agency,
			companyId: ids.companyA,
			scopes,
		};
		otherClient = { ...client, companyId: ids.companyB };
	});

	afterAll(async () => {
		const companyIds = [ids.companyA, ids.companyB];
		await db
			.delete(approvalEvents)
			.where(inArray(approvalEvents.companyId, companyIds));
		await db
			.delete(approvalRequests)
			.where(inArray(approvalRequests.companyId, companyIds));
		await db.delete(contents).where(inArray(contents.companyId, companyIds));
		await db.delete(users).where(inArray(users.id, [ids.member, ids.client]));
		await db.delete(companies).where(inArray(companies.id, companyIds));
		await db.delete(agencies).where(eq(agencies.id, ids.agency));
		await db.$client.end();
	});

	const agencyCard = async () => {
		const [card] = await createContents(deps, agency, [
			{ title: `Post ${randomUUID()}`, script: { hook: "Gancho" } },
		]);
		if (!card) throw new Error("card não criado");
		return card;
	};

	it("envia, edita na pendência, aprova em nome do cliente e perde a aprovação", async () => {
		const card = await agencyCard();

		const sent = await submitForApproval(deps, agency, card.id);
		expect(sent.content).toMatchObject({
			approvalStatus: "pending",
			currentApprovalRequestId: sent.request?.id,
		});
		expect(
			(await listApprovalItems(deps, client, "pending")).map(
				(item) => item.content.id,
			),
		).toContain(card.id);

		const edited = await updateContent(deps, agency, card.id, {
			script: { hook: "Gancho novo" },
		});
		expect(edited.approvalStatus).toBe("pending");
		await expect(
			approveItem(deps, client, card.id, { version: card.contentVersion }),
		).rejects.toThrow("O item foi atualizado pela agência.");

		const approved = await approveItem(deps, agency, card.id, {
			version: edited.contentVersion,
			onBehalfReason: "Aprovou por WhatsApp",
		});
		expect(approved.request).toMatchObject({
			status: "approved",
			decidedOnBehalf: true,
			reason: "Aprovou por WhatsApp",
			itemVersion: edited.contentVersion,
			snapshot: { hook: "Gancho novo" },
		});

		await updateContent(deps, agency, card.id, { script: { cta: "Siga" } });
		const detail = await getApprovalItem(deps, client, card.id);
		expect(detail.content.approvalStatus).toBe("in_preparation");
		expect(
			detail.history.map((e) => [e.type, e.actorName, e.itemVersion]),
		).toEqual([
			["submitted", "Ana da Agência", 1],
			["updated_while_pending", "Ana da Agência", 2],
			["approved_on_behalf", "Ana da Agência", 2],
			["approval_lost", "Ana da Agência", 3],
		]);
	});

	it("recusa com motivo, cancela e reenvia", async () => {
		const card = await agencyCard();
		await submitForApproval(deps, agency, card.id);
		const rejected = await rejectItem(deps, client, card.id, {
			version: card.contentVersion,
			reason: "Muito longo",
		});
		expect(rejected.content.approvalStatus).toBe("rejected");
		expect(
			(await listApprovalItems(deps, agency, "rejected")).find(
				(item) => item.content.id === card.id,
			)?.request?.reason,
		).toBe("Muito longo");

		await updateContent(deps, agency, card.id, { script: { hook: "Curto" } });
		await submitForApproval(deps, agency, card.id);
		const cancelled = await cancelApprovalRequest(deps, agency, card.id);
		expect(cancelled.content.approvalStatus).toBe("in_preparation");
		expect(cancelled.request?.status).toBe("cancelled");
		await expect(
			submitForApproval(deps, agency, card.id),
		).resolves.toMatchObject({ content: { approvalStatus: "pending" } });
	});

	it("design §9: dois envios simultâneos abrem uma solicitação só", async () => {
		const card = await agencyCard();
		const results = await Promise.allSettled([
			submitForApproval(deps, agency, card.id),
			submitForApproval(deps, agency, card.id),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		const rows = await db
			.select()
			.from(approvalRequests)
			.where(eq(approvalRequests.contentId, card.id));
		expect(rows).toHaveLength(1);
	});

	it("RN-015: a empresa B não vê nem decide, e o RLS esconde as solicitações", async () => {
		const card = await agencyCard();
		const sent = await submitForApproval(deps, agency, card.id);
		await expect(
			approveItem(deps, otherClient, card.id, { version: 1 }),
		).rejects.toThrow("Card não encontrado.");
		expect(await listApprovalItems(deps, otherClient, "pending")).toEqual([]);

		// Superusuário ignora o RLS; um papel comum, como o do servidor em produção, não.
		await db.execute(sql`
			do $$ begin
				if not exists (select from pg_roles where rolname = 'convergia_rls_probe') then
					create role convergia_rls_probe nologin;
				end if;
			end $$`);
		await db.execute(sql`grant usage on schema public to convergia_rls_probe`);
		await db.execute(
			sql`grant select on approval_requests, approval_events to convergia_rls_probe`,
		);
		const readAs = (companyId: string) =>
			db.transaction(async (tx) => {
				await tx.execute(sql`set local role convergia_rls_probe`);
				await tx.execute(
					sql`select set_config('app.company_id', ${companyId}, true)`,
				);
				return {
					requests: await tx
						.select()
						.from(approvalRequests)
						.where(eq(approvalRequests.contentId, card.id)),
					events: await tx
						.select()
						.from(approvalEvents)
						.where(eq(approvalEvents.contentId, card.id)),
				};
			});

		const own = await readAs(ids.companyA);
		expect(own.requests.map((r) => r.id)).toEqual([sent.request?.id]);
		expect(own.events).toHaveLength(1);
		expect(await readAs(ids.companyB)).toEqual({ requests: [], events: [] });
	});
});
