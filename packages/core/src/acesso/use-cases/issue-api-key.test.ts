import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "../../shared/domain-error";
import { hashApiKey } from "../api-key";
import { InMemoryApiKeyRepository } from "../testing/in-memory-api-key-repository";
import { issueApiKey, MAX_ACTIVE_API_KEYS } from "./issue-api-key";

const input = { userId: "user-1", name: "Cursor", scopes: ["read" as const] };

describe("issueApiKey", () => {
	let apiKeys: InMemoryApiKeyRepository;

	beforeEach(() => {
		apiKeys = new InMemoryApiKeyRepository(new Map());
	});

	it("grava só o hash da chave, nunca a chave", async () => {
		const { token } = await issueApiKey({ apiKeys }, input);

		expect(apiKeys.keys).toHaveLength(1);
		expect(apiKeys.keys[0]?.keyHash).toBe(await hashApiKey(token));
		expect(JSON.stringify(apiKeys.keys)).not.toContain(token);
	});

	it("RN-024: grava as permissões sem repetição", async () => {
		await issueApiKey(
			{ apiKeys },
			{ ...input, scopes: ["read", "write", "read"] },
		);

		expect(apiKeys.keys[0]?.scopes).toEqual(["read", "write"]);
	});

	it("recusa chave sem nenhuma permissão", async () => {
		await expect(
			issueApiKey({ apiKeys }, { ...input, scopes: [] }),
		).rejects.toThrow(DomainError);
	});

	it("RN-025: até 10 chaves ativas por conta", async () => {
		for (let i = 0; i < MAX_ACTIVE_API_KEYS; i++) {
			await issueApiKey({ apiKeys }, input);
		}

		await expect(issueApiKey({ apiKeys }, input)).rejects.toThrow(
			"Você já tem 10 chaves de API ativas. Revogue uma antes de criar outra.",
		);
	});

	it("RN-025: chave revogada não conta no limite", async () => {
		for (let i = 0; i < MAX_ACTIVE_API_KEYS; i++) {
			await issueApiKey({ apiKeys }, input);
		}
		const first = apiKeys.keys[0];
		if (first) first.revoked = true;

		await expect(issueApiKey({ apiKeys }, input)).resolves.toMatchObject({
			token: expect.stringMatching(/^ag_mcp_/),
		});
	});
});
