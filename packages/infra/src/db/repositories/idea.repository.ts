import {
	type ContentRepository,
	type IdeaRepository,
	ideaApprovalSubject,
} from "@convergia/core";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import {
	approvalEvents,
	approvalRequests,
	companies,
	contents,
	ideas,
} from "../schema";
import { type Tx, withCompany } from "../with-company";
import { toContent } from "./content.repository";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function lockCompany(tx: Tx, companyId: string) {
	await tx
		.select({ id: companies.id })
		.from(companies)
		.where(eq(companies.id, companyId))
		.for("update");
}
/** Cancela a solicitação junto com o descarte: uma ideia substituída nunca pode ser aprovada. */
async function cancelPending(
	tx: Tx,
	companyId: string,
	rows: (typeof ideas.$inferSelect)[],
	actorId: string,
	actorKind: "agency" | "client",
	at: Date,
) {
	for (const row of rows) {
		if (row.approvalStatus !== "pending" || !row.currentApprovalRequestId)
			continue;
		await tx
			.update(approvalRequests)
			.set({ status: "cancelled", decidedBy: actorId, decidedAt: at })
			.where(
				and(
					eq(approvalRequests.companyId, companyId),
					eq(approvalRequests.id, row.currentApprovalRequestId),
					eq(approvalRequests.status, "pending"),
				),
			);
		await tx.insert(approvalEvents).values({
			companyId,
			ideaId: row.id,
			requestId: row.currentApprovalRequestId,
			type: "cancelled",
			actorId,
			actorKind,
			itemVersion: row.contentVersion,
			createdAt: at,
		});
	}
}
export function createIdeaRepository(db: Db): IdeaRepository {
	return {
		list: (companyId) =>
			withCompany(db, companyId, (tx) =>
				tx
					.select()
					.from(ideas)
					.where(and(eq(ideas.companyId, companyId), eq(ideas.state, "active")))
					.orderBy(ideas.createdAt, ideas.id),
			),
		find: (companyId, id) =>
			!uuid.test(id)
				? Promise.resolve(null)
				: withCompany(
						db,
						companyId,
						async (tx) =>
							(
								await tx
									.select()
									.from(ideas)
									.where(and(eq(ideas.companyId, companyId), eq(ideas.id, id)))
							)[0] ?? null,
					),
		replace: (actor, drafts, at) =>
			withCompany(db, actor.companyId, async (tx) => {
				await lockCompany(tx, actor.companyId);
				const old = await tx
					.update(ideas)
					.set({ state: "dismissed", updatedAt: at })
					.where(
						and(
							eq(ideas.companyId, actor.companyId),
							eq(ideas.state, "active"),
						),
					)
					.returning();
				await cancelPending(
					tx,
					actor.companyId,
					old,
					actor.userId,
					actor.kind === "agency_member" ? "agency" : "client",
					at,
				);
				if (!drafts.length) throw new Error("A IA não devolveu ideias.");
				return tx
					.insert(ideas)
					.values(
						drafts.map((d) => ({
							...d,
							companyId: actor.companyId,
							createdByUserId: actor.userId,
							createdByKind:
								actor.kind === "agency_member"
									? ("agency" as const)
									: ("client" as const),
							approvalStatus:
								actor.kind === "agency_member"
									? ("in_preparation" as const)
									: ("none" as const),
							createdAt: at,
							updatedAt: at,
						})),
					)
					.returning();
			}),
		accept: (actor, id, at) =>
			!uuid.test(id)
				? Promise.resolve(null)
				: withCompany(db, actor.companyId, async (tx) => {
						await lockCompany(tx, actor.companyId);
						const [idea] = await tx
							.select()
							.from(ideas)
							.where(
								and(eq(ideas.companyId, actor.companyId), eq(ideas.id, id)),
							)
							.for("update");
						if (!idea) return null;
						if (idea.state === "added" && idea.contentId) {
							const [card] = await tx
								.select()
								.from(contents)
								.where(
									and(
										eq(contents.companyId, actor.companyId),
										eq(contents.id, idea.contentId),
									),
								);
							return card ? toContent(card) : null;
						}
						if (
							idea.state !== "active" ||
							!["none", "approved"].includes(idea.approvalStatus)
						)
							return null;
						const [card] = await tx
							.insert(contents)
							.values({
								companyId: actor.companyId,
								createdByUserId: actor.userId,
								createdByKind:
									actor.kind === "agency_member" ? "agency" : "client",
								title: idea.title,
								idea: idea.text,
								position: Date.now(),
								status: "idea",
								approvalStatus:
									actor.kind === "agency_member" ? "in_preparation" : "none",
							})
							.returning({ id: contents.id });
						if (!card) throw new Error("O card não foi gravado.");
						await tx
							.update(ideas)
							.set({ state: "added", contentId: card.id, updatedAt: at })
							.where(
								and(eq(ideas.companyId, actor.companyId), eq(ideas.id, id)),
							);
						const [saved] = await tx
							.select()
							.from(contents)
							.where(
								and(
									eq(contents.companyId, actor.companyId),
									eq(contents.id, card.id),
								),
							);
						return saved ? toContent(saved) : null;
					}),
		dismiss: (actor, id, at) =>
			!uuid.test(id)
				? Promise.resolve(false)
				: withCompany(db, actor.companyId, async (tx) => {
						const companyId = actor.companyId;
						await lockCompany(tx, companyId);
						const rows = await tx
							.update(ideas)
							.set({ state: "dismissed", updatedAt: at })
							.where(
								and(
									eq(ideas.companyId, companyId),
									eq(ideas.id, id),
									eq(ideas.state, "active"),
								),
							)
							.returning();
						await cancelPending(
							tx,
							companyId,
							rows,
							actor.userId,
							actor.kind === "agency_member" ? "agency" : "client",
							at,
						);
						return rows.length > 0;
					}),
	};
}
/** Só as leituras de aprovação incluem ideias; o calendário e o kanban continuam sendo de cards. */
export function createApprovalSubjects(
	contentsRepo: ContentRepository,
	ideaRepo: IdeaRepository,
): ContentRepository {
	return {
		...contentsRepo,
		async find(companyId, id) {
			const card = await contentsRepo.find(companyId, id);
			if (card) return card;
			const idea = await ideaRepo.find(companyId, id);
			return idea && idea.state !== "dismissed"
				? ideaApprovalSubject(idea)
				: null;
		},
		async listActive(companyId, filter) {
			const [cards, rows] = await Promise.all([
				contentsRepo.listActive(companyId, filter),
				ideaRepo.list(companyId),
			]);
			return [
				...cards,
				...rows
					.filter(
						(i) =>
							!filter?.approvalStatuses ||
							filter.approvalStatuses.includes(i.approvalStatus),
					)
					.map(ideaApprovalSubject),
			];
		},
	};
}
