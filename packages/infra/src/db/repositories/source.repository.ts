import type { SourceRepository } from "@convergia/core";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { contentSources } from "../schema";
import { withCompany } from "../with-company";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createSourceRepository(db: Db): SourceRepository {
	return {
		list: (companyId, contentId) =>
			withCompany(db, companyId, (tx) =>
				tx
					.select()
					.from(contentSources)
					.where(
						and(
							eq(contentSources.companyId, companyId),
							eq(contentSources.contentId, contentId),
						),
					),
			),
		find: (companyId, contentId, id) =>
			!uuid.test(id)
				? Promise.resolve(null)
				: withCompany(
						db,
						companyId,
						async (tx) =>
							(
								await tx
									.select()
									.from(contentSources)
									.where(
										and(
											eq(contentSources.companyId, companyId),
											eq(contentSources.contentId, contentId),
											eq(contentSources.id, id),
										),
									)
							)[0] ?? null,
					),
	};
}
