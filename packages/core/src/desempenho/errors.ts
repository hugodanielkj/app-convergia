import { DomainError } from "../shared/domain-error";

export function onlyClientConnects(): DomainError {
	return new DomainError(
		"agency_connect_instagram",
		"Só o cliente conecta o Instagram da empresa. Peça para ele conectar pelo app.",
	);
}

export function instagramNotConfigured(): DomainError {
	return new DomainError(
		"instagram_not_configured",
		"A conexão com o Instagram ainda não foi configurada neste ambiente. Peça para a equipe técnica configurar o app da Meta.",
	);
}

export function connectLinkExpired(): DomainError {
	return new DomainError(
		"instagram_link_expired",
		"O link de conexão expirou. Volte ao app e conecte de novo.",
	);
}

export function connectCancelled(): DomainError {
	return new DomainError(
		"instagram_cancelled",
		"A conexão foi cancelada no Instagram. Tente de novo quando quiser.",
	);
}

/** 📎 RN-036. */
export function notProfessionalAccount(): DomainError {
	return new DomainError(
		"instagram_not_professional",
		"Esta conta não é Profissional. No Instagram, mude para conta Comercial ou de Criador de conteúdo e conecte de novo.",
	);
}

/** ✅ RN-035: entra a conta que o cliente informou, não outra. */
export function wrongAccount(connected: string, expected: string): DomainError {
	return new DomainError(
		"instagram_wrong_account",
		`Você entrou com @${connected}, mas informou @${expected}. Entre com a conta da empresa ou informe o @ certo.`,
	);
}

export function instagramUnavailable(): DomainError {
	return new DomainError(
		"instagram_unavailable",
		"O Instagram não respondeu. Tente de novo em instantes.",
	);
}
