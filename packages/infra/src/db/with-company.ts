import { sql } from "drizzle-orm";
import type { Db } from "./client";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Roda `run` numa transação marcada com a empresa. O RLS das tabelas de negócio só mostra
 * as linhas dessa empresa: é a segunda barreira, além do filtro no código (RN-015).
 */
export function withCompany<T>(
	db: Db,
	companyId: string,
	run: (tx: Tx) => Promise<T>,
): Promise<T> {
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('app.company_id', ${companyId}, true)`,
		);
		return run(tx);
	});
}
