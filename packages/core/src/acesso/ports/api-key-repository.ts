import type { ActorScope } from "../../shared/actor-context";
import type { AuthenticatedUser } from "../authenticated-user";

export type NewApiKey = {
	userId: string;
	name: string;
	keyHash: string;
	scopes: ActorScope[];
};

/**
 * Busca por hash atravessa empresas de propósito: é a autenticação que descobre a empresa.
 * Nada aqui devolve dados de negócio.
 */
export interface ApiKeyRepository {
	/** Dono da chave com esse hash, se ela existe e não foi revogada (RN-025). */
	findActiveOwnerByHash(keyHash: string): Promise<AuthenticatedUser | null>;
	countActiveByUser(userId: string): Promise<number>;
	insert(key: NewApiKey): Promise<{ id: string }>;
}
