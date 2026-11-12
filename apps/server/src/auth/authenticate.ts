import {
	type ApiKeyRepository,
	type AuthenticatedUser,
	authenticateApiKey,
	isApiKeyFormat,
	NotDecidedYet,
} from "@convergia/core";

/**
 * Valida a credencial da requisição e identifica o usuário (RN-020). A empresa só é
 * resolvida em cada ferramenta, porque o membro da agência a informa por chamada (RN-022).
 */
export type Authenticate = (request: Request) => Promise<AuthenticatedUser>;

export class MissingCredentialError extends Error {
	constructor() {
		super("Credencial ausente.");
		this.name = "MissingCredentialError";
	}
}

export class InvalidCredentialError extends Error {
	constructor() {
		super("Credencial inválida ou revogada.");
		this.name = "InvalidCredentialError";
	}
}

function bearerToken(header: string | null): string | null {
	const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
	return match?.[1] ?? null;
}

/** RN-023: aceita chave de API e OAuth 2.1. */
export function createAuthenticate(deps: {
	apiKeys: ApiKeyRepository;
}): Authenticate {
	return async (request) => {
		const token = bearerToken(request.headers.get("authorization"));
		if (!token) {
			throw new MissingCredentialError();
		}
		if (!isApiKeyFormat(token)) {
			// Token que não é chave de API é OAuth, que depende do fornecedor ainda não escolhido.
			throw new NotDecidedYet("Q-31");
		}
		const user = await authenticateApiKey(deps, token);
		if (!user) {
			throw new InvalidCredentialError();
		}
		return user;
	};
}
