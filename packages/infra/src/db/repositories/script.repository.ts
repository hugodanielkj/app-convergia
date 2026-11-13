import type {
	HistoryEntry,
	RefineMessage,
	ScriptRepository,
} from "@convergia/core";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import {
	contentGenerations,
	contentOptionSets,
	refineMessages,
} from "../schema";
import { withCompany } from "../with-company";

type Row = typeof refineMessages.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toMessage(row: Row): RefineMessage {
	return {
		id: row.id,
		companyId: row.companyId,
		contentId: row.contentId,
		role: row.role,
		text: row.text,
		preview: row.preview,
		previewBaseVersion: row.previewBaseVersion,
		previewStatus: row.previewStatus,
		createdByUserId: row.createdByUserId,
		createdAt: row.createdAt,
	};
}

export function createScriptRepository(db: Db): ScriptRepository {
	return {
		async addGeneration(companyId, generation) {
			await withCompany(db, companyId, (tx) =>
				tx.insert(contentGenerations).values({ companyId, ...generation }),
			);
		},

		async addOptionSet(companyId, optionSet) {
			await withCompany(db, companyId, (tx) =>
				tx.insert(contentOptionSets).values({ companyId, ...optionSet }),
			);
		},

		listHistory(companyId, contentId, limit) {
			return withCompany(db, companyId, async (tx) => {
				// As duas tabelas do histórico, cada uma com as `limit` mais novas.
				const scripts = await tx
					.select()
					.from(contentGenerations)
					.where(
						and(
							eq(contentGenerations.companyId, companyId),
							eq(contentGenerations.contentId, contentId),
						),
					)
					.orderBy(desc(contentGenerations.createdAt))
					.limit(limit);
				const optionSets = await tx
					.select()
					.from(contentOptionSets)
					.where(
						and(
							eq(contentOptionSets.companyId, companyId),
							eq(contentOptionSets.contentId, contentId),
						),
					)
					.orderBy(desc(contentOptionSets.createdAt))
					.limit(limit);
				const entries: HistoryEntry[] = [
					...scripts.map(({ companyId: _, ...row }) => ({
						...row,
						kind: "script" as const,
					})),
					...optionSets.map(({ companyId: _, ...row }) => ({
						...row,
						kind: "options" as const,
					})),
				];
				return entries
					.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
					.slice(0, limit);
			});
		},

		listRefineMessages(companyId, contentId, limit) {
			return withCompany(db, companyId, async (tx) => {
				const rows = await tx
					.select()
					.from(refineMessages)
					.where(
						and(
							eq(refineMessages.companyId, companyId),
							eq(refineMessages.contentId, contentId),
						),
					)
					.orderBy(desc(refineMessages.seq))
					.limit(limit);
				return rows.reverse().map(toMessage);
			});
		},

		addRefineExchange(companyId, contentId, exchange) {
			return withCompany(db, companyId, async (tx) => {
				// Só a prévia mais nova pode ser aplicada.
				await tx
					.update(refineMessages)
					.set({ previewStatus: "discarded" })
					.where(
						and(
							eq(refineMessages.companyId, companyId),
							eq(refineMessages.contentId, contentId),
							eq(refineMessages.previewStatus, "pending"),
						),
					);
				const base = {
					companyId,
					contentId,
					createdByUserId: exchange.userId,
				};
				const rows = await tx
					.insert(refineMessages)
					.values([
						{ ...base, role: "user" as const, text: exchange.request },
						{
							...base,
							role: "assistant" as const,
							text: exchange.reply,
							preview: exchange.preview,
							previewBaseVersion: exchange.previewBaseVersion,
							previewStatus: "pending" as const,
						},
					])
					.returning();
				return rows.sort((a, b) => a.seq - b.seq).map(toMessage);
			});
		},

		async findRefineMessage(companyId, contentId, id) {
			if (!UUID.test(id)) return null;
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.select()
					.from(refineMessages)
					.where(
						and(
							eq(refineMessages.companyId, companyId),
							eq(refineMessages.contentId, contentId),
							eq(refineMessages.id, id),
						),
					)
					.limit(1);
				return row ? toMessage(row) : null;
			});
		},

		setPreviewStatus(companyId, id, status) {
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.update(refineMessages)
					.set({ previewStatus: status })
					.where(
						and(
							eq(refineMessages.companyId, companyId),
							eq(refineMessages.id, id),
						),
					)
					.returning();
				if (!row) throw new Error(`Mensagem ${id} não existe nesta empresa.`);
				return toMessage(row);
			});
		},
	};
}
