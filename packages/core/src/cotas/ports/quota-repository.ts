import type { QuotaTool } from "../../policies/quota.policy";

/** Contador de uso por empresa, ferramenta e dia (design §5.4). */
export interface QuotaRepository {
	/**
	 * Soma 1 ao uso do dia se ele ainda estiver abaixo de `limit`, numa só operação atômica.
	 * Devolve `false` quando a cota acabou.
	 */
	reserve(
		companyId: string,
		tool: QuotaTool,
		day: string,
		limit: number,
	): Promise<boolean>;
	/** Desfaz uma reserva (✅ RN-305). */
	release(companyId: string, tool: QuotaTool, day: string): Promise<void>;
}
