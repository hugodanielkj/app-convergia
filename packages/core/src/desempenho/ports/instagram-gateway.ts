import type { InstagramPost, InstagramProfile } from "../instagram";

export type InstagramToken = { accessToken: string; expiresAt: Date };

/** Falha ao falar com o Instagram; o caso de uso traduz em mensagem para o usuário. */
export class InstagramGatewayError extends Error {
	constructor(
		readonly kind: "not_professional" | "unauthorized" | "unavailable",
		message: string,
	) {
		super(message);
		this.name = "InstagramGatewayError";
	}
}

/**
 * API oficial do Instagram com o login do Instagram (✅ RN-035). Implementada em
 * `packages/infra/src/instagram/`: a da Meta e a simulada, só fora de produção.
 */
export interface InstagramGateway {
	/** Sem o app da Meta configurado, a conexão não está disponível. */
	readonly configured: boolean;
	/** Instagram simulado do ambiente de desenvolvimento: os dados não são reais. */
	readonly simulated: boolean;
	/** Endereço da tela de autorização da Meta. `username` é o @ que o cliente informou. */
	authorizeUrl(input: { state: string; username: string }): string;
	/** Troca o código da Meta pelo token de longa duração (60 dias). */
	exchangeCode(code: string): Promise<InstagramToken & { igUserId: string }>;
	refreshToken(accessToken: string): Promise<InstagramToken>;
	/** ✅ RN-039: perfil e os `limit` posts mais recentes. */
	fetchSnapshot(
		accessToken: string,
		limit: number,
	): Promise<{ profile: InstagramProfile; posts: InstagramPost[] }>;
}
