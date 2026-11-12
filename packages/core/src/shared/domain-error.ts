/** Erro de negócio: a mensagem é mostrada ao usuário, em português. */
export class DomainError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "DomainError";
		this.code = code;
	}
}

/**
 * Regra de negócio ainda em aberto (❓ em rules/regra_de_negocio.md §8).
 * Lançado no lugar de uma suposição: falha nos testes em vez de virar regra escondida.
 */
export class NotDecidedYet extends Error {
	readonly questionId: string;

	constructor(questionId: string) {
		super(`Regra de negócio em aberto: ${questionId}`);
		this.name = "NotDecidedYet";
		this.questionId = questionId;
	}
}
