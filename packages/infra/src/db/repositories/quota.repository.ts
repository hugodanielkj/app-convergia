import type { QuotaRepository } from "@convergia/core";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import { quotaUsage } from "../schema";
import { withCompany } from "../with-company";

export function createQuotaRepository(db: Db): QuotaRepository {
	return {
		reserve(companyId, tool, day, limit) {
			return withCompany(db, companyId, async (tx) => {
				// Uma instrução só: cria a linha do dia ou soma 1 enquanto estiver abaixo do limite.
				// Sem condição de corrida entre agência e cliente usando ao mesmo tempo (design §9).
				const rows = await tx
					.insert(quotaUsage)
					.values({ companyId, toolKey: tool, day, used: 1 })
					.onConflictDoUpdate({
						target: [quotaUsage.companyId, quotaUsage.toolKey, quotaUsage.day],
						set: { used: sql`${quotaUsage.used} + 1` },
						setWhere: sql`${quotaUsage.used} < ${limit}`,
					})
					.returning({ used: quotaUsage.used });
				const [row] = rows;
				return row !== undefined && row.used <= limit;
			});
		},

		async release(companyId, tool, day) {
			await withCompany(db, companyId, (tx) =>
				tx
					.update(quotaUsage)
					.set({ used: sql`greatest(${quotaUsage.used} - 1, 0)` })
					.where(
						and(
							eq(quotaUsage.companyId, companyId),
							eq(quotaUsage.toolKey, tool),
							eq(quotaUsage.day, day),
						),
					),
			);
		},
	};
}
