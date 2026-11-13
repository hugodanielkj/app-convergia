import type { ScriptField } from "../conteudo/content";
import { DomainError, NotDecidedYet } from "../shared/domain-error";

/**
 * Limite diário padrão das ferramentas que já têm valor decidido, por empresa (✅ RN-303).
 * O limite definido pela agência para um cliente (RN-302) entra quando a tela de cotas existir.
 */
export const DEFAULT_DAILY_QUOTAS = {
	generate_scripts: 10,
	refine_content: 30,
} as const;

/** 📎 RN-071: gerar opções avulsas de cada parte do roteiro consome cota. */
export const OPTION_QUOTA_TOOLS = {
	hook: "generate_hook_options",
	body: "generate_body_options",
	cta: "generate_cta_options",
	caption: "generate_caption_options",
} as const satisfies Record<ScriptField, string>;

export type QuotaTool =
	| keyof typeof DEFAULT_DAILY_QUOTAS
	| (typeof OPTION_QUOTA_TOOLS)[ScriptField];

const QUOTA_LABEL: Record<QuotaTool, string> = {
	generate_scripts: "gerar roteiro",
	refine_content: "refinar roteiro",
	generate_hook_options: "opções de gancho",
	generate_body_options: "opções de corpo",
	generate_cta_options: "opções de CTA",
	generate_caption_options: "opções de legenda",
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

/** As ferramentas fora de `DEFAULT_DAILY_QUOTAS` ainda não têm limite decidido (❓ Q-21). */
export function dailyLimit(tool: QuotaTool): number {
	if (!hasDecidedLimit(tool)) throw new NotDecidedYet("Q-21");
	return DEFAULT_DAILY_QUOTAS[tool];
}

function hasDecidedLimit(
	tool: QuotaTool,
): tool is keyof typeof DEFAULT_DAILY_QUOTAS {
	return Object.hasOwn(DEFAULT_DAILY_QUOTAS, tool);
}

/** ✅ RN-301: a cota é da empresa; a mensagem vem da regra de negócio §7. */
export function quotaExhausted(tool: QuotaTool, limit: number): DomainError {
	return new DomainError(
		"quota_exhausted",
		`A cota diária de ${QUOTA_LABEL[tool]} desta empresa acabou (${limit} por dia). Tente amanhã.`,
	);
}
