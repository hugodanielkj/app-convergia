import type { KnowledgeRepository } from "@convergia/core";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { cardReferences, savedReferences } from "../schema";
import { withCompany } from "../with-company";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createKnowledgeRepository(db: Db): KnowledgeRepository {
	return {
		listSaved: (companyId) =>
			withCompany(db, companyId, (tx) =>
				tx
					.select()
					.from(savedReferences)
					.where(eq(savedReferences.companyId, companyId)),
			),
		findSaved: (companyId, id) =>
			!uuid.test(id)
				? Promise.resolve(null)
				: withCompany(
						db,
						companyId,
						async (tx) =>
							(
								await tx
									.select()
									.from(savedReferences)
									.where(
										and(
											eq(savedReferences.companyId, companyId),
											eq(savedReferences.id, id),
										),
									)
							)[0] ?? null,
					),
		deleteSaved: (companyId, id) =>
			!uuid.test(id)
				? Promise.resolve(false)
				: withCompany(
						db,
						companyId,
						async (tx) =>
							(
								await tx
									.delete(savedReferences)
									.where(
										and(
											eq(savedReferences.companyId, companyId),
											eq(savedReferences.id, id),
										),
									)
									.returning()
							).length > 0,
					),
		listAttached: (companyId, contentId) =>
			withCompany(db, companyId, (tx) =>
				tx
					.select()
					.from(cardReferences)
					.where(
						and(
							eq(cardReferences.companyId, companyId),
							eq(cardReferences.contentId, contentId),
						),
					),
			),
		attach: (companyId, contentId, input) =>
			withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.insert(cardReferences)
					.values({ ...input, companyId, contentId })
					.returning();
				if (!row) throw new Error("Referência não gravada.");
				return row;
			}),
		detach: (companyId, contentId, id) =>
			!uuid.test(id)
				? Promise.resolve(false)
				: withCompany(
						db,
						companyId,
						async (tx) =>
							(
								await tx
									.delete(cardReferences)
									.where(
										and(
											eq(cardReferences.companyId, companyId),
											eq(cardReferences.contentId, contentId),
											eq(cardReferences.id, id),
										),
									)
									.returning()
							).length > 0,
					),
	};
}
