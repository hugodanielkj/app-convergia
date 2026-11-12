import { describe, expect, it } from "vitest";
import {
	API_KEY_PREFIX,
	generateApiKey,
	hashApiKey,
	isApiKeyFormat,
} from "./api-key";

describe("chave de API", () => {
	it("RN-023: a chave gerada tem o prefixo próprio e 256 bits aleatórios", () => {
		const token = generateApiKey();

		expect(token).toMatch(/^ag_mcp_[0-9a-f]{64}$/);
		expect(isApiKeyFormat(token)).toBe(true);
	});

	it("cada chave gerada é diferente", () => {
		expect(generateApiKey()).not.toBe(generateApiKey());
	});

	it("reconhece o formato pelo prefixo", () => {
		expect(isApiKeyFormat(`${API_KEY_PREFIX}abc`)).toBe(true);
		expect(isApiKeyFormat("token-oauth-qualquer")).toBe(false);
	});

	it("o hash é SHA-256 em hexadecimal, estável e diferente da chave", async () => {
		const token = generateApiKey();
		const hash = await hashApiKey(token);

		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		expect(hash).toBe(await hashApiKey(token));
		expect(hash).not.toContain(token.slice(API_KEY_PREFIX.length));
	});

	it("o hash corresponde ao SHA-256 conhecido", async () => {
		expect(await hashApiKey("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});
});
