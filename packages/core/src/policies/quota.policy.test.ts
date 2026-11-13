import { describe, expect, it } from "vitest";
import { agency, client } from "../conteudo/testing/actors";
import { InMemoryQuotaRepository } from "../cotas/testing/in-memory-quota-repository";
import { withQuota } from "../cotas/with-quota";
import { NotDecidedYet } from "../shared/domain-error";
import {
	DEFAULT_DAILY_QUOTAS,
	dailyLimit,
	OPTION_QUOTA_TOOLS,
	quotaDay,
} from "./quota.policy";

describe("política de cota", () => {
	const setup = (now = new Date("2026-11-12T15:00:00Z")) => {
		const quotas = new InMemoryQuotaRepository();
		return { quotas, deps: { quotas, now: () => now } };
	};
	const ok = async () => "ok";

	it("RN-303: gerar roteiro tem 10 por dia e refinar tem 30", () => {
		expect(DEFAULT_DAILY_QUOTAS).toEqual({
			generate_scripts: 10,
			refine_content: 30,
		});
	});

	it("Q-21: as opções avulsas (RN-071) ainda não têm limite e não reservam cota", async () => {
		const { deps, quotas } = setup();
		for (const tool of Object.values(OPTION_QUOTA_TOOLS)) {
			expect(() => dailyLimit(tool)).toThrow(NotDecidedYet);
			await expect(withQuota(deps, client, tool, ok)).rejects.toThrow(
				"Regra de negócio em aberto: Q-21",
			);
		}
		expect(quotas.used.size).toBe(0);
	});

	it("RN-304: o dia da cota vira à meia-noite de São Paulo", () => {
		// 02:59 UTC ainda é 23:59 do dia anterior em São Paulo (UTC-3).
		expect(quotaDay(new Date("2026-11-13T02:59:00Z"))).toBe("2026-11-12");
		expect(quotaDay(new Date("2026-11-13T03:00:00Z"))).toBe("2026-11-13");
	});

	it("RN-300: depois do limite do dia, a chamada é recusada com a mensagem do §7", async () => {
		const { deps } = setup();
		for (let i = 0; i < 10; i++) {
			await withQuota(deps, client, "generate_scripts", ok);
		}
		await expect(
			withQuota(deps, client, "generate_scripts", ok),
		).rejects.toThrow(
			"A cota diária de gerar roteiro desta empresa acabou (10 por dia). Tente amanhã.",
		);
	});

	it("RN-301: o uso da agência dentro do cliente conta na cota do cliente", async () => {
		const { deps, quotas } = setup();
		await withQuota(deps, client, "refine_content", ok);
		await withQuota(deps, agency, "refine_content", ok);
		expect(
			quotas.used.get(
				InMemoryQuotaRepository.key(
					"company-a",
					"refine_content",
					"2026-11-12",
				),
			),
		).toBe(2);
	});

	it("RN-304: no dia seguinte a cota está cheia de novo", async () => {
		let now = new Date("2026-11-12T15:00:00Z");
		const quotas = new InMemoryQuotaRepository();
		const deps = { quotas, now: () => now };
		for (let i = 0; i < 10; i++) {
			await withQuota(deps, client, "generate_scripts", ok);
		}
		now = new Date("2026-11-13T03:00:00Z");
		await expect(withQuota(deps, client, "generate_scripts", ok)).resolves.toBe(
			"ok",
		);
	});

	it("RN-305: uma chamada que falha devolve a cota", async () => {
		const { deps, quotas } = setup();
		await expect(
			withQuota(deps, client, "generate_scripts", async () => {
				throw new Error("IA fora do ar");
			}),
		).rejects.toThrow("IA fora do ar");
		expect(
			quotas.used.get(
				InMemoryQuotaRepository.key(
					"company-a",
					"generate_scripts",
					"2026-11-12",
				),
			),
		).toBe(0);
	});
});
