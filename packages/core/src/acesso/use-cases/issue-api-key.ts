import type { ActorScope } from "../../shared/actor-context";
import { DomainError } from "../../shared/domain-error";
import { generateApiKey, hashApiKey } from "../api-key";
import type { ApiKeyRepository } from "../ports/api-key-repository";

/** 📎 RN-025: até 10 chaves de API ativas por conta. */
export const MAX_ACTIVE_API_KEYS = 10;

export type IssuedApiKey = {
	id: string;
	/** Mostrada uma única vez: só o hash fica gravado. */
	token: string;
};

/**
 * Emite uma chave de API para um usuário. Por enquanto só o script interno chama este caso
 * de uso, por isso ele não recebe ator. Quando a tela Conta do app web emitir chaves, passa a receber.
 */
export async function issueApiKey(
	deps: { apiKeys: ApiKeyRepository },
	input: { userId: string; name: string; scopes: ActorScope[] },
): Promise<IssuedApiKey> {
	if (input.scopes.length === 0) {
		throw new DomainError(
			"api_key_without_scope",
			"Informe ao menos uma permissão para a chave: leitura ou escrita.",
		);
	}
	const active = await deps.apiKeys.countActiveByUser(input.userId);
	if (active >= MAX_ACTIVE_API_KEYS) {
		throw new DomainError(
			"api_key_limit",
			`Você já tem ${MAX_ACTIVE_API_KEYS} chaves de API ativas. Revogue uma antes de criar outra.`,
		);
	}
	const token = generateApiKey();
	const { id } = await deps.apiKeys.insert({
		userId: input.userId,
		name: input.name,
		keyHash: await hashApiKey(token),
		scopes: [...new Set(input.scopes)],
	});
	return { id, token };
}
