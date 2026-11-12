import { DomainError, NotDecidedYet } from "@convergia/core";
import { describe, expect, it, vi } from "vitest";
import { toMcpResult, withMcpErrors } from "./to-mcp-result";

describe("toMcpResult", () => {
	it("erro de negócio vira resultado com isError e a mensagem em português", () => {
		const result = toMcpResult(
			new DomainError("no_access", "Você não tem acesso a esta empresa."),
		);

		expect(result).toEqual({
			isError: true,
			content: [{ type: "text", text: "Você não tem acesso a esta empresa." }],
		});
	});

	it("regra em aberto cita a pergunta", () => {
		const result = toMcpResult(new NotDecidedYet("Q-16"));

		expect(result.isError).toBe(true);
		expect(result.content[0]).toMatchObject({
			text: expect.stringContaining("Q-16"),
		});
	});

	it("erro inesperado vira mensagem genérica, sem detalhes internos", () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = toMcpResult(new Error("connection refused at 10.0.0.1"));

		expect(result).toEqual({
			isError: true,
			content: [
				{
					type: "text",
					text: "Ocorreu um erro inesperado. Tente de novo em instantes.",
				},
			],
		});
		expect(log).toHaveBeenCalledOnce();
		log.mockRestore();
	});
});

describe("withMcpErrors", () => {
	it("converte exceção lançada pela ferramenta", async () => {
		const result = await withMcpErrors(() => {
			throw new DomainError("x", "Mensagem ao usuário.");
		});

		expect(result.isError).toBe(true);
	});
});
