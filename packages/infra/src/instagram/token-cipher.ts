import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Criptografa os tokens do Instagram no banco (stack §5), com AES-256-GCM. */
export type TokenCipher = {
	encrypt(token: string): string;
	decrypt(stored: string): string;
};

const VERSION = "v1";

export function createTokenCipher(base64Key: string): TokenCipher {
	const key = Buffer.from(base64Key, "base64");
	if (key.length !== 32) {
		throw new Error("A chave dos tokens do Instagram precisa ter 32 bytes.");
	}
	return {
		encrypt(token) {
			const iv = randomBytes(12);
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			const data = Buffer.concat([
				cipher.update(token, "utf8"),
				cipher.final(),
			]);
			const payload = Buffer.concat([iv, cipher.getAuthTag(), data]);
			return `${VERSION}:${payload.toString("base64")}`;
		},
		decrypt(stored) {
			const [version, encoded] = stored.split(":");
			if (version !== VERSION || !encoded) {
				throw new Error("Token do Instagram em formato desconhecido.");
			}
			const payload = Buffer.from(encoded, "base64");
			const decipher = createDecipheriv(
				"aes-256-gcm",
				key,
				payload.subarray(0, 12),
			);
			decipher.setAuthTag(payload.subarray(12, 28));
			return Buffer.concat([
				decipher.update(payload.subarray(28)),
				decipher.final(),
			]).toString("utf8");
		},
	};
}
