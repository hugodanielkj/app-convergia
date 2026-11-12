import type {
	Content,
	ContentPatch,
	ContentRepository,
	NewContent,
} from "@convergia/core";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	isNotNull,
	isNull,
	lte,
	type SQL,
} from "drizzle-orm";
import type { Db } from "../client";
import { contents } from "../schema";
import { withCompany } from "../with-company";

type Row = typeof contents.$inferSelect;
type Insert = typeof contents.$inferInsert;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toContent(row: Row): Content {
	return {
		id: row.id,
		companyId: row.companyId,
		createdByUserId: row.createdByUserId,
		createdByKind: row.createdByKind,
		title: row.title,
		idea: row.idea,
		script: {
			hook: row.scriptHook,
			body: row.scriptBody,
			cta: row.scriptCta,
			caption: row.scriptCaption,
		},
		platform: "instagram",
		mediaType: row.mediaType,
		format: row.format,
		category: row.category,
		funnelStage: row.funnelStage,
		targetDurationSeconds: row.targetDurationSeconds,
		status: row.status,
		position: row.position,
		plannedDate: row.plannedDate,
		contentVersion: row.contentVersion,
		approvalStatus: row.approvalStatus,
		deletedAt: row.deletedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toColumns(patch: ContentPatch): Partial<Insert> {
	const { script, ...rest } = patch;
	return {
		...rest,
		...(script && {
			scriptHook: script.hook,
			scriptBody: script.body,
			scriptCta: script.cta,
			scriptCaption: script.caption,
		}),
	};
}

export function createContentRepository(db: Db): ContentRepository {
	return {
		listActive(companyId, filter = {}) {
			return withCompany(db, companyId, async (tx) => {
				const conditions: (SQL | undefined)[] = [
					eq(contents.companyId, companyId),
					isNull(contents.deletedAt),
					filter.status ? eq(contents.status, filter.status) : undefined,
					filter.plannedFrom
						? gte(contents.plannedDate, filter.plannedFrom)
						: undefined,
					filter.plannedTo
						? lte(contents.plannedDate, filter.plannedTo)
						: undefined,
				];
				const rows = await tx
					.select()
					.from(contents)
					.where(and(...conditions))
					.orderBy(asc(contents.status), asc(contents.position));
				return rows.map(toContent);
			});
		},

		listDeleted(companyId, since) {
			return withCompany(db, companyId, async (tx) => {
				const rows = await tx
					.select()
					.from(contents)
					.where(
						and(
							eq(contents.companyId, companyId),
							isNotNull(contents.deletedAt),
							gte(contents.deletedAt, since),
						),
					)
					.orderBy(desc(contents.deletedAt));
				return rows.map(toContent);
			});
		},

		async find(companyId, id) {
			// O ID vem do usuário; um texto fora do formato UUID faria o Postgres falhar.
			if (!UUID.test(id)) return null;
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.select()
					.from(contents)
					.where(and(eq(contents.companyId, companyId), eq(contents.id, id)))
					.limit(1);
				return row ? toContent(row) : null;
			});
		},

		insertMany(companyId, rows: NewContent[]) {
			return withCompany(db, companyId, async (tx) => {
				const inserted = await tx
					.insert(contents)
					.values(
						rows.map((row) => ({
							companyId,
							...toColumns(row),
							createdByUserId: row.createdByUserId,
							createdByKind: row.createdByKind,
							title: row.title,
							position: row.position,
							approvalStatus: row.approvalStatus,
						})),
					)
					.returning();
				return inserted.map(toContent);
			});
		},

		update(companyId, id, patch) {
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.update(contents)
					.set({ ...toColumns(patch), updatedAt: new Date() })
					.where(and(eq(contents.companyId, companyId), eq(contents.id, id)))
					.returning();
				if (!row) throw new Error(`Card ${id} não existe nesta empresa.`);
				return toContent(row);
			});
		},
	};
}
