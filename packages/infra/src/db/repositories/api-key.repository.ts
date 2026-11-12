import type {
	ApiKeyRepository,
	AuthenticatedUser,
	NewApiKey,
} from "@convergia/core";
import { and, count, eq, isNull } from "drizzle-orm";
import type { Db } from "../client";
import { apiKeys, users } from "../schema";

export function createApiKeyRepository(db: Db): ApiKeyRepository {
	return {
		async findActiveOwnerByHash(keyHash) {
			const [row] = await db
				.select({
					userId: users.id,
					kind: users.kind,
					agencyId: users.agencyId,
					companyId: users.companyId,
					scopes: apiKeys.scopes,
				})
				.from(apiKeys)
				.innerJoin(users, eq(apiKeys.userId, users.id))
				.where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
				.limit(1);
			return row ? toAuthenticatedUser(row) : null;
		},

		async countActiveByUser(userId) {
			const [row] = await db
				.select({ total: count() })
				.from(apiKeys)
				.where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
			return row?.total ?? 0;
		},

		async insert(key: NewApiKey) {
			const [row] = await db
				.insert(apiKeys)
				.values(key)
				.returning({ id: apiKeys.id });
			if (!row) {
				throw new Error("A chave de API não foi gravada.");
			}
			return row;
		},
	};
}

function toAuthenticatedUser(row: {
	userId: string;
	kind: AuthenticatedUser["kind"];
	agencyId: string;
	companyId: string | null;
	scopes: AuthenticatedUser["scopes"];
}): AuthenticatedUser {
	const base = {
		userId: row.userId,
		agencyId: row.agencyId,
		scopes: row.scopes,
	};
	if (row.kind === "agency_member") {
		return { kind: "agency_member", ...base };
	}
	// A restrição users_company_matches_kind garante a empresa do usuário do cliente.
	if (!row.companyId) {
		throw new Error(`Usuário do cliente ${row.userId} sem empresa.`);
	}
	return { kind: "client_user", companyId: row.companyId, ...base };
}
