import { DomainError, NotDecidedYet } from "@convergia/core";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
	InvalidCredentialError,
	MissingCredentialError,
} from "../auth/authenticate";

const UNEXPECTED_ERROR =
	"Ocorreu um erro inesperado. Tente de novo em instantes.";

const STATUS_BY_CODE: Record<string, ContentfulStatusCode> = {
	no_access: 403,
	company_required: 400,
};

export type AppErrorBody = {
	error: string;
	message: string;
	questionId?: string;
};

/** Erro da API do app: o app mostra `message` como veio (regra de negócio §7). */
export function toAppError(error: unknown): {
	status: ContentfulStatusCode;
	body: AppErrorBody;
} {
	if (
		error instanceof MissingCredentialError ||
		error instanceof InvalidCredentialError
	) {
		return {
			status: 401,
			body: { error: "unauthorized", message: error.message },
		};
	}
	if (error instanceof DomainError) {
		return {
			status: STATUS_BY_CODE[error.code] ?? 422,
			body: { error: error.code, message: error.message },
		};
	}
	if (error instanceof NotDecidedYet) {
		return {
			status: 501,
			body: {
				error: "not_decided_yet",
				message: `Esta funcionalidade depende de uma regra ainda não definida (${error.questionId}).`,
				questionId: error.questionId,
			},
		};
	}
	console.error(error);
	return {
		status: 500,
		body: { error: "unexpected", message: UNEXPECTED_ERROR },
	};
}
