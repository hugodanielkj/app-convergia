import { randomUUID } from "node:crypto";
import type {
	ApprovalEvent,
	ApprovalRepository,
	ApprovalRequest,
} from "@convergia/core";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Db } from "../client";
import {
	approvalEvents,
	approvalRequests,
	contents,
	ideas,
	users,
} from "../schema";
import { withCompany } from "../with-company";

type RequestRow = typeof approvalRequests.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toRequest(row: RequestRow): ApprovalRequest {
	return {
		id: row.id,
		companyId: row.companyId,
		contentId: (row.contentId ?? row.ideaId) as string,
		itemType: row.itemType,
		submittedVersion: row.submittedVersion,
		itemVersion: row.itemVersion,
		snapshot: row.snapshot,
		status: row.status,
		submittedBy: row.submittedBy,
		submittedAt: row.submittedAt,
		decidedBy: row.decidedBy,
		decidedAt: row.decidedAt,
		decidedOnBehalf: row.decidedOnBehalf,
		reason: row.reason,
	};
}

/** Erro interno para desfazer a transação quando o card mudou no meio do caminho. */
class Changed extends Error {}

export function createApprovalRepository(db: Db): ApprovalRepository {
	return {
		async submit(companyId, input) {
			const requestId = randomUUID();
			const target = input.itemType === "idea" ? ideas : contents;
			const targetIds =
				input.itemType === "idea"
					? { ideaId: input.contentId }
					: { contentId: input.contentId };
			return withCompany(db, companyId, async (tx) => {
				// Primeiro o card, com a condição: se ele mudou desde a leitura, nada é gravado.
				const [content] = await tx
					.update(target)
					.set({
						approvalStatus: "pending",
						currentApprovalRequestId: requestId,
						updatedAt: input.at,
					})
					.where(
						and(
							eq(target.companyId, companyId),
							eq(target.id, input.contentId),
							input.itemType === "idea"
								? eq(ideas.state, "active")
								: isNull(contents.deletedAt),
							eq(target.contentVersion, input.expect.contentVersion),
							eq(target.approvalStatus, input.expect.approvalStatus),
						),
					)
					.returning({ id: target.id });
				if (!content) return null;
				const [request] = await tx
					.insert(approvalRequests)
					.values({
						id: requestId,
						companyId,
						...targetIds,
						itemType: input.itemType ?? "script",
						submittedVersion: input.expect.contentVersion,
						itemVersion: input.expect.contentVersion,
						snapshot: input.snapshot,
						status: "pending",
						submittedBy: input.event.actorId,
						submittedAt: input.at,
					})
					.returning();
				if (!request) throw new Error("A solicitação não foi gravada.");
				await tx.insert(approvalEvents).values({
					companyId,
					requestId,
					...targetIds,
					type: input.event.type,
					actorId: input.event.actorId,
					actorKind: input.event.actorKind,
					itemVersion: input.expect.contentVersion,
					createdAt: input.at,
				});
				return toRequest(request);
			});
		},

		async decide(companyId, input) {
			if (!UUID.test(input.requestId)) return null;
			const target = input.itemType === "idea" ? ideas : contents;
			const targetIds =
				input.itemType === "idea"
					? { ideaId: input.contentId }
					: { contentId: input.contentId };
			try {
				return await withCompany(db, companyId, async (tx) => {
					const [content] = await tx
						.update(target)
						.set({ approvalStatus: input.contentStatus, updatedAt: input.at })
						.where(
							and(
								eq(target.companyId, companyId),
								eq(target.id, input.contentId),
								eq(target.approvalStatus, "pending"),
								eq(target.currentApprovalRequestId, input.requestId),
								input.expectVersion === null
									? undefined
									: eq(target.contentVersion, input.expectVersion),
							),
						)
						.returning({ contentVersion: target.contentVersion });
					if (!content) return null;
					const [request] = await tx
						.update(approvalRequests)
						.set({
							status: input.outcome,
							decidedBy: input.event.actorId,
							decidedAt: input.at,
							decidedOnBehalf: input.onBehalf,
							reason: input.reason,
						})
						.where(
							and(
								eq(approvalRequests.companyId, companyId),
								eq(approvalRequests.id, input.requestId),
								eq(approvalRequests.status, "pending"),
							),
						)
						.returning();
					// O card apontava para esta solicitação pendente; se ela não está, desfaz tudo.
					if (!request) throw new Changed();
					await tx.insert(approvalEvents).values({
						companyId,
						requestId: input.requestId,
						...targetIds,
						type: input.event.type,
						actorId: input.event.actorId,
						actorKind: input.event.actorKind,
						itemVersion: content.contentVersion,
						reason: input.reason,
						createdAt: input.at,
					});
					return toRequest(request);
				});
			} catch (error) {
				if (error instanceof Changed) return null;
				throw error;
			}
		},

		findMany(companyId, ids) {
			const valid = ids.filter((id) => UUID.test(id));
			if (valid.length === 0) return Promise.resolve([]);
			return withCompany(db, companyId, async (tx) => {
				const rows = await tx
					.select()
					.from(approvalRequests)
					.where(
						and(
							eq(approvalRequests.companyId, companyId),
							inArray(approvalRequests.id, valid),
						),
					);
				return rows.map(toRequest);
			});
		},

		listEvents(companyId, contentId) {
			if (!UUID.test(contentId)) return Promise.resolve([]);
			return withCompany(db, companyId, async (tx) => {
				const rows = await tx
					.select({ event: approvalEvents, actorName: users.name })
					.from(approvalEvents)
					.leftJoin(users, eq(users.id, approvalEvents.actorId))
					.where(
						and(
							eq(approvalEvents.companyId, companyId),
							or(
								eq(approvalEvents.contentId, contentId),
								eq(approvalEvents.ideaId, contentId),
							),
						),
					)
					.orderBy(asc(approvalEvents.createdAt), asc(approvalEvents.id));
				return rows.map(
					({ event, actorName }): ApprovalEvent => ({
						id: event.id,
						requestId: event.requestId,
						contentId: (event.contentId ?? event.ideaId) as string,
						type: event.type,
						actorId: event.actorId,
						actorKind: event.actorKind,
						actorName,
						itemVersion: event.itemVersion,
						reason: event.reason,
						at: event.createdAt,
					}),
				);
			});
		},
	};
}
