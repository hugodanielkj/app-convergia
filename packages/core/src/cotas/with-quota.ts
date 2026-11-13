import {
	dailyLimit,
	type QuotaTool,
	quotaDay,
	quotaExhausted,
} from "../policies/quota.policy";
import type { ActorContext } from "../shared/actor-context";
import type { QuotaRepository } from "./ports/quota-repository";

/**
 * Reserva uma unidade da cota da empresa antes de `run` (RN-300, RN-301) e devolve a reserva
 * se `run` falhar (✅ RN-305). O uso da agência conta na cota do cliente, porque a reserva é
 * pela empresa do contexto.
 */
export async function withQuota<T>(
	deps: { quotas: QuotaRepository; now: () => Date },
	actor: ActorContext,
	tool: QuotaTool,
	run: () => Promise<T>,
): Promise<T> {
	const day = quotaDay(deps.now());
	const limit = dailyLimit(tool);
	if (!(await deps.quotas.reserve(actor.companyId, tool, day, limit))) {
		throw quotaExhausted(tool, limit);
	}
	try {
		return await run();
	} catch (error) {
		await deps.quotas.release(actor.companyId, tool, day);
		throw error;
	}
}
