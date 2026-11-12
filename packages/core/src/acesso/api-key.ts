/**
 * Chave de API (RN-023): prefixo próprio, guardada só como hash (stack.md §3).
 * A chave tem 256 bits aleatórios, então um SHA-256 simples basta; não precisa de hash lento.
 */
export const API_KEY_PREFIX = "ag_mcp_";

const RANDOM_BYTES = 32;

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export function isApiKeyFormat(token: string): boolean {
	return token.startsWith(API_KEY_PREFIX);
}

export function generateApiKey(): string {
	return (
		API_KEY_PREFIX + toHex(crypto.getRandomValues(new Uint8Array(RANDOM_BYTES)))
	);
}

export async function hashApiKey(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return toHex(new Uint8Array(digest));
}
