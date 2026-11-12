import { DomainError, NotDecidedYet } from "@convergia/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const UNEXPECTED_ERROR =
	"Ocorreu um erro inesperado. Tente de novo em instantes.";

function errorResult(text: string): CallToolResult {
	return { isError: true, content: [{ type: "text", text }] };
}

/** Erro de negócio volta como resultado da ferramenta, não como erro HTTP. */
export function toMcpResult(error: unknown): CallToolResult {
	if (error instanceof DomainError) {
		return errorResult(error.message);
	}
	if (error instanceof NotDecidedYet) {
		return errorResult(
			`Esta funcionalidade depende de uma regra ainda não definida (${error.questionId}).`,
		);
	}
	console.error(error);
	return errorResult(UNEXPECTED_ERROR);
}

export async function withMcpErrors(
	run: () => CallToolResult | Promise<CallToolResult>,
): Promise<CallToolResult> {
	try {
		return await run();
	} catch (error) {
		return toMcpResult(error);
	}
}
