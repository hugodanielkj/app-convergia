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
	// Q-04: OAuth 2.1, chave de API ou os dois. Sem decisão, nenhum token é aceito.
	throw new NotDecidedYet("Q-04");
};
