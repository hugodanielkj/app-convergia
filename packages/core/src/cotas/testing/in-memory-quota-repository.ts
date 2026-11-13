import type { QuotaTool } from "../../policies/quota.policy";
import type { QuotaRepository } from "../ports/quota-repository";

/** Dublê do contador de cota para testes unitários. */
export class InMemoryQuotaRepository implements QuotaRepository {
	readonly used = new Map<string, number>();

	static key(companyId: string, tool: QuotaTool, day: string): string {
		return `${companyId}|${tool}|${day}`;
	}

	async reserve(
		companyId: string,
		tool: QuotaTool,
		day: string,
		limit: number,
	): Promise<boolean> {
		const key = InMemoryQuotaRepository.key(companyId, tool, day);
		const used = this.used.get(key) ?? 0;
		if (used >= limit) return false;
		this.used.set(key, used + 1);
		return true;
	}

	async release(
		companyId: string,
		tool: QuotaTool,
		day: string,
	): Promise<void> {
		const key = InMemoryQuotaRepository.key(companyId, tool, day);
		this.used.set(key, Math.max((this.used.get(key) ?? 0) - 1, 0));
	}
}
