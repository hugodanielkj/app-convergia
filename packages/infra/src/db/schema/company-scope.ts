import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";

/** Empresa da transação atual (ver `withCompany`); sem ela, o RLS não mostra nenhuma linha. */
export const currentCompany = sql`nullif(current_setting('app.company_id', true), '')::uuid`;

/** Política de RLS que isola a tabela por empresa (RN-015). */
export function companyIsolation(name: string, companyId: AnyPgColumn) {
	return pgPolicy(name, {
		for: "all",
		using: sql`${companyId} = ${currentCompany}`,
		withCheck: sql`${companyId} = ${currentCompany}`,
	});
}
