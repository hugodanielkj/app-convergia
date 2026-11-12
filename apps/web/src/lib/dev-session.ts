/**
 * Entrada de desenvolvimento: guarda a chave de API do `pnpm db:seed` só nesta aba.
 * Some quando o login de verdade chegar (Q-31, Q-32).
 */
const KEY = "convergia.devApiKey";

export function getDevApiKey(): string | null {
	try {
		return sessionStorage.getItem(KEY);
	} catch {
		return null;
	}
}

export function setDevApiKey(value: string): void {
	try {
		sessionStorage.setItem(KEY, value);
	} catch {
		// Sem armazenamento (modo privado): a entrada vale só até recarregar.
	}
}

export function clearDevApiKey(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// Nada a limpar.
	}
}
