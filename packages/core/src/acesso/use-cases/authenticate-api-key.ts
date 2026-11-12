import { hashApiKey, isApiKeyFormat } from "../api-key";
import type { AuthenticatedUser } from "../authenticated-user";
import type { ApiKeyRepository } from "../ports/api-key-repository";

/** Valida uma chave de API (RN-023). Devolve null para chave desconhecida ou revogada. */
export async function authenticateApiKey(
	deps: { apiKeys: ApiKeyRepository },
	token: string,
): Promise<AuthenticatedUser | null> {
	if (!isApiKeyFormat(token)) {
		return null;
	}
	return deps.apiKeys.findActiveOwnerByHash(await hashApiKey(token));
}
