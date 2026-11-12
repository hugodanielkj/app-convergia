import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../authenticated-user";
import type { ApiKeyRepository } from "../ports/api-key-repository";
import { InMemoryApiKeyRepository } from "../testing/in-memory-api-key-repository";
import { authenticateApiKey } from "./authenticate-api-key";
import { issueApiKey } from "./issue-api-key";

const client: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-1",
	agencyId: "agency-1",
	companyId: "company-1",
	scopes: [],
};

describe("authenticateApiKey", () => {
	let apiKeys: InMemoryApiKeyRepository;

	beforeEach(() => {
		apiKeys = new InMemoryApiKeyRepository(new Map([[client.userId, client]]));
	});

	it("RN-023: chave válida identifica o dono e as permissões da chave", async () => {
		const { token } = await issueApiKey(
			{ apiKeys },
			{ userId: "user-1", name: "Cursor", scopes: ["read"] },
		);

		expect(await authenticateApiKey({ apiKeys }, token)).toEqual({
			...client,
			scopes: ["read"],
		});
	});

	it("chave desconhecida não autentica", async () => {
		expect(
			await authenticateApiKey({ apiKeys }, `ag_mcp_${"0".repeat(64)}`),
		).toBeNull();
	});

	it("RN-025: chave revogada não autentica", async () => {
		const { id, token } = await issueApiKey(
			{ apiKeys },
			{ userId: "user-1", name: "Cursor", scopes: ["read"] },
		);
		const stored = apiKeys.keys.find((key) => key.id === id);
		if (stored) stored.revoked = true;

		expect(await authenticateApiKey({ apiKeys }, token)).toBeNull();
	});

	it("token fora do formato de chave nem chega ao repositório", async () => {
		const failing: ApiKeyRepository = {
			findActiveOwnerByHash: () => {
				throw new Error("não deveria consultar");
			},
			countActiveByUser: async () => 0,
			insert: async () => ({ id: "x" }),
		};

		expect(
			await authenticateApiKey({ apiKeys: failing }, "token-oauth"),
		).toBeNull();
	});
});
