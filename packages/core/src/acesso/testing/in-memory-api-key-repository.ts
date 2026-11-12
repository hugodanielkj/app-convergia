import type { AuthenticatedUser } from "../authenticated-user";
import type { ApiKeyRepository, NewApiKey } from "../ports/api-key-repository";

type StoredKey = NewApiKey & { id: string; revoked: boolean };

/** Dublê do repositório para testes unitários. */
export class InMemoryApiKeyRepository implements ApiKeyRepository {
	readonly keys: StoredKey[] = [];

	constructor(private readonly users: Map<string, AuthenticatedUser>) {}

	async findActiveOwnerByHash(
		keyHash: string,
	): Promise<AuthenticatedUser | null> {
		const key = this.keys.find((k) => k.keyHash === keyHash && !k.revoked);
		const user = key && this.users.get(key.userId);
		return key && user ? { ...user, scopes: [...key.scopes] } : null;
	}

	async countActiveByUser(userId: string): Promise<number> {
		return this.keys.filter((k) => k.userId === userId && !k.revoked).length;
	}

	async insert(key: NewApiKey): Promise<{ id: string }> {
		const id = `key-${this.keys.length + 1}`;
		this.keys.push({ ...key, id, revoked: false });
		return { id };
	}
}
