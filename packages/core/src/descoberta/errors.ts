import { DomainError } from "../shared/domain-error";
import type { ProviderErrorKind } from "./ports/video-provider";
import type { VideoPlatform } from "./video";

/** Pesquisa de outra empresa ou inexistente (RN-015). */
export function searchNotFound(): DomainError {
	return new DomainError("search_not_found", "Pesquisa não encontrada.");
}

/** ✅ RN-118: mensagem da regra de negócio §7. */
export function tooManySearches(): DomainError {
	return new DomainError(
		"rate_limited",
		"Muitas pesquisas em pouco tempo. Tente de novo em um minuto.",
	);
}

export const NOT_CONFIGURED_MESSAGE =
	"A busca de vídeos ainda não foi configurada neste ambiente. Peça para a equipe técnica configurar o provedor de dados.";

const PLATFORM_LABEL: Record<VideoPlatform, string> = {
	instagram: "Instagram",
	tiktok: "TikTok",
};

/** ✅ RN-119: aviso por plataforma, sem esconder os resultados das outras. */
export function platformFailureMessage(
	platform: VideoPlatform,
	kind: ProviderErrorKind | null,
): string {
	const name = PLATFORM_LABEL[platform];
	switch (kind) {
		case "not_configured":
			return `A busca no ${name} não está configurada.`;
		case "out_of_credits":
		case "unauthorized":
			return `A busca no ${name} está indisponível por um problema na conta do provedor de dados.`;
		case "rate_limited":
			return `O ${name} recebeu pesquisas demais agora. Tente de novo em alguns minutos.`;
		default:
			return `Não foi possível buscar no ${name} agora. Mostrando o que foi encontrado nas outras plataformas.`;
	}
}
