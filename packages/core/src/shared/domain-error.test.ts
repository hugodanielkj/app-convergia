import { describe, expect, it } from "vitest";
import { DomainError, NotDecidedYet } from "./domain-error";

describe("erros de domínio", () => {
	it("DomainError carrega código e mensagem para o usuário", () => {
		const error = new DomainError(
			"no_access",
			"Você não tem acesso a esta empresa.",
		);

		expect(error.code).toBe("no_access");
		expect(error.message).toBe("Você não tem acesso a esta empresa.");
	});

	it("NotDecidedYet identifica a pergunta em aberto", () => {
		const error = new NotDecidedYet("Q-04");

		expect(error.questionId).toBe("Q-04");
		expect(error.message).toContain("Q-04");
	});
});
