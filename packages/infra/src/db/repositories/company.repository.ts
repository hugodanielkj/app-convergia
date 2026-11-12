import type { Company, CompanyRepository } from "@convergia/core";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { companies } from "../schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const columns = {
	id: companies.id,
	agencyId: companies.agencyId,
	name: companies.name,
};

export function createCompanyRepository(db: Db): CompanyRepository {
	return {
		async findInAgency(companyId, agencyId): Promise<Company | null> {
			// company_id vem do usuário; um texto fora do formato UUID faria o Postgres falhar.
			if (!UUID.test(companyId)) {
				return null;
			}
			const [row] = await db
				.select(columns)
				.from(companies)
				.where(
					and(eq(companies.id, companyId), eq(companies.agencyId, agencyId)),
				)
				.limit(1);
			return row ?? null;
		},

		async listByAgency(agencyId): Promise<Company[]> {
			return db
				.select(columns)
				.from(companies)
				.where(eq(companies.agencyId, agencyId))
				.orderBy(asc(companies.name));
		},
	};
}
