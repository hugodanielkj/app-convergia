import { type ActorContext, NotDecidedYet } from "@convergia/core";

/** Valida a credencial da requisição e monta o contexto do ator (RN-020). */
export type ResolveActor = (request: Request) => Promise<ActorContext>;

export class MissingCredentialError extends Error {
	constructor() {
		super("Credencial ausente.");
		this.name = "MissingCredentialError";
	}
}

export const resolveActor: ResolveActor = async (request) => {
	if (!request.headers.get("authorization")) {
		throw new MissingCredentialError();
	}
	// RN-023: aceita OAuth 2.1 e chave de API. A validação da chave de API chega com a
	// tabela de chaves; o token OAuth depende do fornecedor (Q-31). Até lá, nenhum token é aceito.
	throw new NotDecidedYet("Q-31");
};
