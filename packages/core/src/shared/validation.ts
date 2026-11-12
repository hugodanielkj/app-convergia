import { z } from "zod";
import { DomainError } from "./domain-error";

// Mensagens de validação em português, nos dois canais e no app.
z.config(z.locales.ptBR());

/** Valida a entrada de um canal (API do app ou MCP) e devolve um erro de negócio legível. */
export function parseInput<T extends z.ZodType>(
	schema: T,
	value: unknown,
): z.infer<T> {
	const result = schema.safeParse(value);
	if (result.success) {
		return result.data;
	}
	const issue = result.error.issues[0];
	const field = issue?.path.join(".");
	throw new DomainError(
		"invalid_input",
		`Confira os dados enviados${field ? ` (${field})` : ""}: ${issue?.message ?? "valor inválido"}.`,
	);
}
