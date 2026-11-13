import { DomainError } from "../shared/domain-error";

/**
 * Ferramentas que consomem cota e o limite diário padrão de cada uma, por empresa (✅ RN-303).
 * O limite definido pela agência para um cliente (RN-302) entra quando a tela de cotas existir.
 * As outras ferramentas ainda não têm valor decidido (❓ Q-21).
 */
export const DEFAULT_DAILY_QUOTAS = {
	generate_scripts: 10,
	refine_content: 30,
} as const;

export type QuotaTool = keyof typeof DEFAULT_DAILY_QUOTAS;

const QUOTA_LABEL: Record<QuotaTool, string> = {
	generate_scripts: "gerar roteiro",
	refine_content: "refinar roteiro",
};

/** ✅ RN-304: a cota zera à meia-noite de São Paulo. */
export const QUOTA_TIME_ZONE = "America/Sao_Paulo";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
	timeZone: QUOTA_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** Dia da cota (AAAA-MM-DD) no fuso de São Paulo. */
export function quotaDay(now: Date): string {
	return dayFormat.format(now);
}

export function dailyLimit(tool: QuotaTool): number {
	return DEFAULT_DAILY_QUOTAS[tool];
}

/** ✅ RN-301: a cota é da empresa; a mensagem vem da regra de negócio §7. */
export function quotaExhausted(tool: QuotaTool, limit: number): DomainError {
	return new DomainError(
		"quota_exhausted",
		`A cota diária de ${QUOTA_LABEL[tool]} desta empresa acabou (${limit} por dia). Tente amanhã.`,
	);
}
