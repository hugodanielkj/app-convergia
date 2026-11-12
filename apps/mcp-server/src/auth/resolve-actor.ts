import {
	type ActorContext,
	type ApiKeyRepository,
	authenticateApiKey,
	buildActorContext,
	isApiKeyFormat,
	NotDecidedYet,
} from "@convergia/core";

/** Valida a credencial da requisição e monta o contexto do ator (RN-020). */
export type ResolveActor = (request: Request) => Promise<ActorContext>;

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
export function createResolveActor(deps: {
	apiKeys: ApiKeyRepository;
}): ResolveActor {
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
		return buildActorContext(user);
	};
}
